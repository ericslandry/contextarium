import {createServer} from "node:http";
import {randomBytes} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createBroker} from "./broker.mjs";

const here=new URL("./",import.meta.url);
const assetNames=["index.html","scene.json","scene-http.json","risk-details.json","risk-click.json"];
const eventsAllowed=new Set(["scene.ready","scene.changed","widget.action","camera.enter","camera.leave","camera.arrived","camera.interrupted","data.loaded"]);
const json=(res,code,value)=>{res.writeHead(code,{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(value));};
async function body(req){
  if(!String(req.headers["content-type"]).startsWith("application/json"))throw Error("JSON required");
  let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw Error("request too large");parts.push(chunk);}
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
export async function startCanvas({onPrompt=async()=>{throw Error("No Copilot session; use standalone demo");},allowPrompts=true,assetRoot=new URL("./assets/",here),timeoutMs=12000}={}){
  const assets=Object.fromEntries(await Promise.all(assetNames.map(async name=>[name,await readFile(new URL(name,assetRoot),"utf8")])));
  const bridge=await readFile(new URL("browser.mjs",here),"utf8");
  // Only alter the served experimental copy. Canonical Contextarium HTML stays unchanged.
  if(!assets["index.html"].includes("</body>"))throw Error("unsupported runtime HTML");
  const html=assets["index.html"].replace("</body>",'<script type="module" src="./browser.mjs"></script></body>')
    .replace("script-src 'unsafe-inline'","script-src 'self' 'unsafe-inline'");
  const token=randomBytes(24).toString("hex"), broker=createBroker({timeoutMs});
  let stream=null, origin="", lastPrompt=0, promptBusy=false, closed=false;
  const server=createServer(async(req,res)=>{
    try{
      if(req.headers.host!==new URL(origin).host)return json(res,403,{error:"invalid host"});
      const url=new URL(req.url,origin), base="/"+token+"/";
      if(!url.pathname.startsWith(base))return json(res,404,{error:"unknown route"});
      const path=url.pathname.slice(base.length);
      if(req.method==="GET"){
        if(path==="events"){
          const client=url.searchParams.get("client");
          if(!client||!/^[a-z0-9-]{8,80}$/i.test(client))return json(res,400,{error:"invalid client"});
          if(stream)stream.end();
          res.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-store","Connection":"keep-alive","X-Accel-Buffering":"no","Referrer-Policy":"no-referrer"});
          stream=res;
          const release=broker.attach(client,msg=>res.write("data: "+JSON.stringify(msg)+"\n\n"));
          res.write("event: ready\ndata: {}\n\n");
          const keep=setInterval(()=>res.write(": keepalive\n\n"),15000);
          res.on("close",()=>{clearInterval(keep);release();if(stream===res)stream=null;});return;
        }
        const content=path===""||path==="index.html"?html:path==="browser.mjs"?bridge:Object.hasOwn(assets,path)?assets[path]:null;
        if(content===null)return json(res,404,{error:"unknown asset"});
        res.writeHead(200,{"Content-Type":path==="browser.mjs"?"text/javascript; charset=utf-8":path.endsWith(".json")?"application/json":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});return res.end(content);
      }
      if(req.method!=="POST"||!["ack","event","prompt"].includes(path))return json(res,405,{error:"unsupported method"});
      // Require the exact same origin, including port. No CORS and no external bind.
      if(req.headers.origin!==origin)return json(res,403,{error:"invalid origin"});
      const data=await body(req);
      if(!broker.connected(data.client))return json(res,409,{error:"renderer not connected"});
      if(path==="ack")return json(res,broker.ack(data.client,data)?200:409,{ok:true});
      if(path==="event"){
        if(!eventsAllowed.has(data.event?.type))return json(res,400,{error:"unsupported event"});
        broker.record(data.client,data.event);return json(res,200,{ok:true});
      }
      if(!allowPrompts)return json(res,403,{error:"prompts disabled"});
      // Explicit Ask Copilot or opt-in manual-zoom affordance; passive telemetry never prompts.
      if(promptBusy||Date.now()-lastPrompt<2500)return json(res,429,{error:"prompt already pending or rate limited"});
      if(typeof data.target!=="string"||!/^[a-z][a-z0-9_-]{0,63}$/i.test(data.target))return json(res,400,{error:"invalid target"});
      promptBusy=true;lastPrompt=Date.now();
      try{const result=await onPrompt(data.target);return json(res,200,{ok:true,result});}
      finally{promptBusy=false;}
    }catch(e){if(!res.headersSent)json(res,400,{error:String(e.message).slice(0,500)});else res.end();}
  });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  origin="http://127.0.0.1:"+server.address().port;
  return {url:origin+"/"+token+"/",broker,
    async close(){if(closed)return;closed=true;broker.close();stream?.end();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});}
  };
}
