export function createBroker({timeoutMs=12000,maxPending=32}={}) {
  let channel=null, pending=new Map(), seq=0, events=[], closed=false;
  function detach(reason="renderer disconnected") {
    channel=null; for(const [id,p] of pending){clearTimeout(p.timer);p.reject(new Error(reason));pending.delete(id);}
  }
  return {
    attach(client,send){if(closed)throw Error("broker closed");detach("renderer replaced");const marker={client,send};channel=marker;return ()=>{if(channel===marker)detach();};},
    call(operation,input={}){if(!channel)return Promise.reject(Error("renderer not connected"));if(pending.size>=maxPending)return Promise.reject(Error("too many pending operations"));const id=String(++seq);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error("renderer acknowledgement timed out; outcome unknown"));},timeoutMs);pending.set(id,{resolve,reject,timer});try{channel.send({id,operation,input});}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}});},
    ack(client,msg){if(channel?.client!==client)return false;const p=pending.get(msg.id);if(!p)return false;pending.delete(msg.id);clearTimeout(p.timer);if(msg.ok===true)p.resolve(msg.result);else p.reject(Error(String(msg.error||"renderer rejected").slice(0,500)));return true;},
    record(client,event){if(channel?.client!==client)return false;events.push(event);if(events.length>100)events.shift();return true;},
    events(){return structuredClone(events);},
    connected(client){return !!channel&&(!client||channel.client===client);},
    close(){closed=true;detach("instance closed");}
  };
}
