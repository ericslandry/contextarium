import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const json = name => JSON.parse(read(name));
const html = read('index.html');
const embedded = JSON.parse(html.match(/<script type="application\/json" id="demo">([\s\S]*?)<\/script>/)[1]);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,1);
new Script(scripts[0][1]);
const scene = json('scene.json');
assert.deepEqual(scene,embedded);
assert.equal(scene.version,1);
assert.equal(new Set(scene.objects.map(o=>o.id)).size,scene.objects.length);
for(const o of scene.objects) if(o.parent) assert.ok(scene.objects.some(p=>p.id===o.parent));
const http=json('scene-http.json');
for(const key of ['risk-details','risk-click']){
  assert.deepEqual(json(key+'.json'),scene.sources[key].commands);
  assert.deepEqual(http.sources[key],{kind:'http',url:'./'+key+'.json'});
  http.sources[key]=scene.sources[key];
}
assert.deepEqual(http,scene);
console.log('PASS: JavaScript syntax, embedded scene, IDs, parent references and HTTP fixtures');
