// Experimental adapter; the original Fieldwork runtime is unmodified.
const fw=window.fieldwork;
if(!fw)throw Error("Fieldwork runtime missing");
const client=crypto.randomUUID();
const post=async(path,data)=>{
  const r=await fetch("./"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client,...data})});
  const result=await r.json();if(!r.ok)throw Error(result.error||"HTTP "+r.status);return result;
};
const label=document.createElement("div");
Object.assign(label.style,{position:"fixed",right:"8px",top:"48px",zIndex:"10000",background:"#121a26",color:"#ece5d6",padding:"8px",font:"12px system-ui",border:"1px solid #8d97a8",maxWidth:"min(260px, 75vw)"});
const status=document.createElement("div"),button=document.createElement("button");
button.textContent="Ask Copilot about selection";button.disabled=true;label.append(status,button);document.body.append(label);
let target="risk",ready=false,serial=Promise.resolve(),epoch=0;
function say(text){status.textContent=text;}
const connection=new EventSource("./events?client="+encodeURIComponent(client));
connection.addEventListener("ready",()=>{ready=true;button.disabled=false;say("Canvas connected");});
connection.onerror=()=>{ready=false;button.disabled=true;epoch++;say("Canvas reconnecting");};
button.onclick=async()=>{button.disabled=true;try{say("Sending selected object to Copilot…");await post("prompt",{target});say("Prompt submitted; awaiting agent action");}catch(e){say(e.message);}finally{button.disabled=!ready;}};
for(const type of ["scene.ready","scene.changed","widget.action","camera.enter","camera.leave","camera.arrived","camera.interrupted","data.loaded"]){
  fw.events.addEventListener(type,e=>{
    if(type==="widget.action"&&e.detail?.target)target=e.detail.target;
    if(type==="scene.ready")epoch++;
    if(ready)post("event",{event:e.detail}).catch(()=>{});
    // Explicitly declared user affordance only. Never auto-prompt on camera events.
    if(ready&&type==="widget.action"&&e.detail?.name==="ask-copilot")button.click();
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
      if(m.operation==="state")result={...state,bridgeEpoch:epoch};
      else if(m.operation==="batch"){
        if(input.expectedRevision!==undefined&&(input.expectedRevision!==state.revision||input.expectedEpoch!==epoch))throw Error("stale workspace; inspect again");
        const vetoes=[];const handler=e=>vetoes.push(e.detail);
        fw.events.addEventListener("camera.interrupted",handler);
        try{result={...fw.batch(input.commands),bridgeEpoch:epoch,cameraVetoes:vetoes,follow:fw.getState().follow};}
        finally{fw.events.removeEventListener("camera.interrupted",handler);}
      }else if(m.operation==="load"){
        fw.loadScene(input.scene);result={revision:fw.getState().revision,bridgeEpoch:epoch};
      }else throw Error("unknown operation");
      ok=true;
    }catch(e){error=String(e.message);}
    await post("ack",{id:m.id,ok,result,error}).catch(e=>say("Acknowledgement failed: "+e.message));
  }).catch(e=>say(e.message));
};
