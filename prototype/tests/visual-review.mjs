import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [output, checkout = fileURLToPath(new URL('../../', import.meta.url))] = process.argv.slice(2);
const browserPath = process.env.CONTEXTARIUM_BROWSER ||
  (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : null);
if (!output || !browserPath) throw new Error('Run visual-review.mjs <output-dir> [checkout] with Edge or CONTEXTARIUM_BROWSER');

const runtime = pathToFileURL(resolve(checkout, 'prototype/runtime') + '/');
const { Workspace } = await import(new URL('workspace.mjs', runtime));
const { startWorkspaceServer } = await import(new URL('server.mjs', runtime));
const fixture = async name => JSON.parse(await readFile(new URL('../examples/' + name + '.json', import.meta.url), 'utf8'));
const relay = await fixture('relay');
const reading = await fixture('reading');
const document = compositions => ({ format: 'contextarium-workspace', version: 1, compositions });
const specimen = document([{
  id: 'specimen', title: 'Where the signal goes', x: 0, y: 0, width: 690, height: 405,
  html: '<article><h1>Where the signal goes</h1><p>A relay takes bursts of samples from the shoreline and sends a steady stream to the monitor.</p>' +
    '<hr><p>At saturation, the buffer begins to hold samples across ticks.</p><p><code>arrival rate &gt; service rate</code></p></article>',
  css: 'article { padding: 25px 42px; } h1 { font-size: 48px; margin: 0 0 20px; } p { font-size: 23px; } hr { margin-block: 24px; }',
}]);

async function eventually(check, description) {
  for (const end = Date.now() + 9_000; Date.now() < end;) {
    const value = await check();
    if (value) return value;
    await wait(40);
  }
  throw new Error('Timed out: ' + description);
}

const workspace = new Workspace('visual-review');
const server = await startWorkspaceServer({
  workspace, activity: () => ({ kind: 'idle', text: '' }), onImport() {}, onPresentation() {},
});
const profile = await mkdtemp(join(tmpdir(), 'contextarium-visual-'));
const browser = spawn(browserPath, ['--headless=new', '--disable-background-networking', '--no-first-run',
  '--no-proxy-server', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const errors = [];
browser.on('error', error => errors.push(error));
let socket;
try {
  const debuggerUrl = await eventually(async () => {
    if (errors.length) throw errors[0];
    try {
      const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim();
      const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      return tabs.find(page => page.type === 'page')?.webSocketDebuggerUrl;
    } catch { return false; }
  }, 'browser debug target');
  socket = new WebSocket(debuggerUrl);
  await once(socket, 'open');
  let sequence = 0;
  let motionFrames;
  const pending = new Map();
  const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener('message', ({ data }) => {
    const event = JSON.parse(data);
    if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.text);
    if (event.method === 'Page.screencastFrame') {
      motionFrames?.push({ image: event.params.data, time: event.params.metadata.timestamp });
      void rpc('Page.screencastFrameAck', { sessionId: event.params.sessionId }).catch(error => errors.push(error));
    }
    const reply = pending.get(event.id);
    if (reply) {
      pending.delete(event.id);
      if (event.error) reply.reject(new Error(event.error.message));
      else reply.resolve(event.result);
    }
  });
  const evaluate = async expression => {
    const reply = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
    return reply.result.value;
  };
  const load = value => workspace.import(value, workspace.ticket());
  const present = selector => evaluate('Boolean(document.querySelector(' + JSON.stringify(selector) + '))');
  const focus = id => evaluate(`document.querySelector('#jump').value = ${JSON.stringify(id)};
    document.querySelector('#jump').dispatchEvent(new Event('change'))`);

  await rpc('Runtime.enable');
  await rpc('Page.enable');
  for (const [name, width, height] of [['wide', 1280, 800], ['narrow', 430, 660]]) {
    const directory = resolve(output, name);
    const motionDirectory = join(directory, 'motion');
    await mkdir(motionDirectory, { recursive: true });
    const screenshot = async name => {
      await evaluate('document.fonts.ready.then(() => new Promise(requestAnimationFrame))');
      const { data } = await rpc('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(directory, name + '.png'), Buffer.from(data, 'base64'));
    };

    load(document([]));
    await rpc('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await rpc('Page.navigate', { url: server.open(name) });
    await eventually(() => present('#empty:not([hidden])'), 'empty workspace');
    await screenshot('empty');

    load(relay);
    await eventually(() => present('#surface-verified'), 'relay overview');
    await screenshot('overview');
    await focus('relay');
    await wait(2800);
    await screenshot('focused');

    motionFrames = [];
    await rpc('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 920, maxHeight: 700 });
    await eventually(() => motionFrames.length > 0, 'initial screencast frame');
    const samples = await evaluate(`new Promise(resolve => {
      const trace = [];
      const started = performance.now();
      document.querySelector('#jump').value = 'buffer';
      document.querySelector('#jump').dispatchEvent(new Event('change'));
      function sample(now) {
        const camera = new DOMMatrix(document.querySelector('#world').style.transform);
        trace.push({ ms: Math.round(now - started), zoom: camera.a, x: camera.e, y: camera.f });
        if (now - started < 2800) requestAnimationFrame(sample);
        else resolve(trace);
      }
      requestAnimationFrame(sample);
    })`);
    await rpc('Page.stopScreencast');
    const frames = motionFrames;
    motionFrames = undefined;
    assert.ok(frames.length >= 5, 'camera flight produces screencast frames');
    await Promise.all(frames.map(({ image }, index) => writeFile(
      join(motionDirectory, String(index).padStart(3, '0') + '.jpg'), Buffer.from(image, 'base64'))));
    await writeFile(join(motionDirectory, 'trace.json'), JSON.stringify({ timestamps: frames.map(frame => frame.time), samples }));
    assert.equal(await evaluate("document.querySelector('#jump').value"), 'buffer');
    await evaluate("document.querySelector('[data-step]').click(); document.querySelector('[data-step]').click()");
    assert.equal(await evaluate("document.querySelector('[data-queue]').value"), '2');
    await evaluate("Promise.all(document.querySelector('[data-fill]').getAnimations().map(animation => animation.finished))");
    await screenshot('interactive');

    load(reading);
    await eventually(() => present('#surface-essay'), 'reading room');
    await focus('essay');
    await wait(2800);
    await screenshot('reading');

    load(specimen);
    await eventually(() => present('#surface-specimen'), 'default typography sample');
    await screenshot('theme');
    console.log(`${name} ${width} × ${height}: 6 stills and ${frames.length} motion frames`);
  }
  assert.deepEqual(errors, []);
} finally {
  socket?.close();
  server.close();
  workspace.close();
  browser.kill();
  if (browser.exitCode === null && browser.pid) await Promise.race([once(browser, 'exit'), wait(2000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 300 }).catch(() => {});
}
