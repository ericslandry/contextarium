// Experimental adapter; the original Contextarium runtime is unmodified.
import { validateLayout } from "./layout-browser.mjs";
import { layoutContract } from "./layout-contract.mjs";

const fw=window.contextarium;
if(!fw)throw Error("Contextarium runtime missing");
const client=crypto.randomUUID?.()??Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,"0")).join("");
const post=async(path,data)=>{
  const r=await fetch("./"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client,...data})});
  const result=await r.json();if(!r.ok)throw Error(result.error||"HTTP "+r.status);return result;
};
const label=document.createElement("div");
Object.assign(label.style,{position:"fixed",right:"8px",top:"48px",zIndex:"10000",background:"#121a26",color:"#ece5d6",padding:"8px",font:"12px system-ui",border:"1px solid #8d97a8",maxWidth:"min(260px, 75vw)"});
const status=document.createElement("div"),button=document.createElement("button");
button.textContent="Ask Copilot about selection";button.disabled=true;label.append(status,button);document.body.append(label);
let target="risk",ready=false,serial=Promise.resolve(),epoch=0,zoomGesture=0;
const stamp=()=>client+":"+epoch;
const opt=document.createElement("input");opt.type="checkbox";const optLabel=document.createElement("label");optLabel.style.display="block";optLabel.append(opt," Experimental: ask on manual zoom");label.append(optLabel);
window.addEventListener("wheel",e=>{if(e.isTrusted&&!label.contains(e.target)&&(!e.target.closest?.(".table-wrap")||e.ctrlKey))zoomGesture=performance.now();},{capture:true,passive:true});
window.addEventListener("keydown",e=>{if(e.isTrusted&&["+","-","="].includes(e.key)&&!e.target.closest?.("input,button,textarea,select"))zoomGesture=performance.now();},{capture:true});
function say(text){status.textContent=text;}
const connection=new EventSource("./events?client="+encodeURIComponent(client));
connection.addEventListener("ready",()=>{ready=true;button.disabled=false;say("Canvas connected");});
connection.onerror=()=>{ready=false;button.disabled=true;epoch++;say("Canvas reconnecting");};
button.onclick=async()=>{button.disabled=true;try{say("Sending selected object to Copilot…");await post("prompt",{target});say("Prompt submitted; awaiting agent action");}catch(e){say(e.message);}finally{button.disabled=!ready;}};
for(const type of ["scene.ready","scene.changed","widget.action","camera.enter","camera.leave","camera.arrived","camera.interrupted","data.loaded"]){
  fw.events.addEventListener(type,e=>{
    if(type==="widget.action"&&e.detail?.target)target=e.detail.target;
    if(type==="scene.ready"){epoch++;zoomGesture=0;}
    if(type==="scene.changed")zoomGesture=0;
    if(ready)post("event",{event:e.detail}).catch(()=>{});
    // Explicitly declared user affordance only. Never auto-prompt on camera events.
    if(ready&&type==="widget.action"&&e.detail?.name==="ask-copilot")button.click();
    if(ready&&opt.checked&&type==="camera.enter"&&zoomGesture&&performance.now()-zoomGesture<2000&&!fw.getState().follow){zoomGesture=0;target=e.detail.target;button.click();}
  });
}
connection.onmessage=e=>{
  let m;try{m=JSON.parse(e.data);}catch{return;}
  const receivedEpoch=epoch;
  serial=serial.then(async()=>{
    let result,ok=false,error;
    try{
      if(!ready||receivedEpoch!==epoch)throw Error("stale renderer operation");
      const input=m.input||{};
      const state=fw.getState();
      if(m.operation==="state")result={...state,bridgeEpoch:stamp()};
      else if(m.operation==="layout"){
        if(input.expectedRevision!==state.revision||input.expectedEpoch!==stamp())throw Error("stale workspace; inspect again");
        if(input.candidateScene&&!input.samples?.length)throw Error("candidateScene requires viewport samples");
        const samples=await validateLayout(input.candidateScene||state.scene,input.samples);
        if(receivedEpoch!==epoch||state.revision!==fw.getState().revision)throw Error("workspace changed during layout validation; inspect again");
        result={layoutVersion:layoutContract.version,source:input.candidateScene?"candidate":"workspace",revision:state.revision,bridgeEpoch:stamp(),samples};
      }
      else if(m.operation==="batch"){
        if(input.expectedRevision!==undefined&&(input.expectedRevision!==state.revision||input.expectedEpoch!==stamp()))throw Error("stale workspace; inspect again");
        const vetoes=[];const handler=e=>vetoes.push(e.detail);
        fw.events.addEventListener("camera.interrupted",handler);
        try{result={...fw.batch(input.commands),bridgeEpoch:stamp(),cameraVetoes:vetoes,follow:fw.getState().follow};}
        finally{fw.events.removeEventListener("camera.interrupted",handler);}
      }else if(m.operation==="load"){
        fw.loadScene(input.scene);result={revision:fw.getState().revision,bridgeEpoch:stamp()};
      }else throw Error("unknown operation");
      ok=true;
    }catch(e){error=String(e.message);}
    await post("ack",{id:m.id,ok,result,error}).catch(e=>say("Acknowledgement failed: "+e.message));
  }).catch(e=>say(e.message));
};
