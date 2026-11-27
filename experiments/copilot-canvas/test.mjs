import {test} from "node:test";
import assert from "node:assert/strict";
import {createBroker} from "./broker.mjs";
import {startCanvas} from "./server.mjs";
import {makeActions} from "./actions.mjs";
test("broker correlates replies and rejects stale clients",async()=>{
 const b=createBroker({timeoutMs:100});let message;const drop=b.attach("client-a",m=>message=m);
 const result=b.call("state");assert.equal(b.ack("client-b",{id:message.id,ok:true}),false);
 assert.equal(b.ack("client-a",{id:message.id,ok:true,result:{revision:1}}),true);
 assert.deepEqual(await result,{revision:1});drop();await assert.rejects(b.call("state"),/not connected/);b.close();
});
test("broker reports rejection and timeout without claiming success",async()=>{
 const b=createBroker({timeoutMs:20});let m;b.attach("client",v=>m=v);
 const p=b.call("batch");b.ack("client",{id:m.id,ok:false,error:"invalid"});await assert.rejects(p,/invalid/);
 await assert.rejects(b.call("state"),/timed out/);b.close();
});
test("loopback server serves experimental HTML and round trips SSE command / HTTP ack",async()=>{
 const instance=await startCanvas({timeoutMs:1000});const client="test-client", origin=new URL(instance.url).origin;
 let reader;
 try{
   const html=await (await fetch(instance.url)).text();assert.match(html,/src="\.\/browser\.mjs"/);
   assert.match(html,/frame-src 'self'/);
   const preview=await (await fetch(instance.url+"layout-preview")).text();
   assert.match(preview,/container-type: size/);
   assert.doesNotMatch(preview,/src="\.\/browser\.mjs"/);
   assert.match((await fetch(instance.url+"layout-browser.mjs")).headers.get("content-type"),/javascript/);
   assert.equal((await fetch(origin+"/")).status,404);
   const events=await fetch(instance.url+"events?client="+client);reader=events.body.getReader();
   const decoder=new TextDecoder();let pending="";
   async function frame(){while(!pending.includes("\n\n")){const r=await reader.read();if(r.done)throw Error("stream ended");pending+=decoder.decode(r.value,{stream:true});}const i=pending.indexOf("\n\n");const f=pending.slice(0,i);pending=pending.slice(i+2);return f;}
   assert.match(await frame(),/event: ready/);
   const result=instance.broker.call("state");const message=JSON.parse((await frame()).slice(6));
   const payload={client,id:message.id,ok:true,result:{revision:3}};
   const invalid=await fetch(instance.url+"ack",{method:"POST",headers:{"Content-Type":"application/json","Origin":"http://example.invalid"},body:JSON.stringify(payload)});assert.equal(invalid.status,403);
   const ack=await fetch(instance.url+"ack",{method:"POST",headers:{"Content-Type":"application/json","Origin":origin},body:JSON.stringify(payload)});assert.equal(ack.status,200);assert.deepEqual(await result,{revision:3});
   const actions=makeActions(()=>instance);
   const guide=await actions.find(a=>a.name==="authoring_guide").handler();
   assert.deepEqual(guide.layoutContract.components.metric.minimum,[320,220]);
   const validate=actions.find(a=>a.name==="validate_layout");
   assert.equal(validate.inputSchema.properties.samples.maxItems,6);
   const input={expectedRevision:3,expectedEpoch:"fixture:0",samples:[{width:440,height:650,focus:"risk"}]};
   const validation=validate.handler({instanceId:"fixture",input});
   const request=JSON.parse((await frame()).slice(6));
   assert.equal(request.operation,"layout");
   assert.deepEqual(request.input,input);
   const measured={layoutVersion:1,revision:3,bridgeEpoch:"fixture:0",samples:[{
     findings:[{type:"content_overflow",objectId:"risk",measurements:{occupiedBounds:{h:218}},suggestion:"Increase available height."}]
   }]};
   const layoutAck=await fetch(instance.url+"ack",{method:"POST",headers:{"Content-Type":"application/json","Origin":origin},
     body:JSON.stringify({client,id:request.id,ok:true,result:measured})});
   assert.equal(layoutAck.status,200);
   assert.deepEqual(await validation,measured);
 }finally{await reader?.cancel();await instance.close();}
});
