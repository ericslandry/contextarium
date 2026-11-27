// Host-facing input schemas. The browser validates the full scene and applies commands.
const obj=(properties={},required=[])=>({type:"object",properties,required,additionalProperties:false});
const command={type:"object",required:["command"],properties:{command:{enum:[
  "object.upsert","object.update","object.move","object.resize","object.delete","object.visibility",
  "behaviour.upsert","behaviour.delete","camera.focus","camera.overview","camera.set"
]}},additionalProperties:true};
const scene=obj({
  version:{const:1},title:{type:"string"},objects:{type:"array",maxItems:250},
  behaviours:{type:"array"},sources:{type:"object"},camera:{type:"object"}
},["version","title","objects","behaviours","sources","camera"]);
const sample=obj({
  width:{type:"integer",minimum:320,maximum:1920},
  height:{type:"integer",minimum:360,maximum:1200},
  focus:{type:"string",pattern:"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$"},
  zoom:{type:"number",minimum:0.002,maximum:16},
  minTextPx:{type:"number",minimum:0,maximum:24}
},["width","height"]);
const revision={
  expectedRevision:{type:"integer",minimum:0},
  expectedEpoch:{type:"string",minLength:1,maxLength:128}
};
const revisionKeys=Object.keys(revision);

export const workspaceInputs={
  empty:obj(),
  scene:obj({scene},["scene"]),
  batch:obj({...revision,commands:{type:"array",minItems:1,maxItems:100,items:command}},[...revisionKeys,"commands"]),
  layout:obj({...revision,candidateScene:scene,samples:{
    type:"array",minItems:1,maxItems:6,items:sample
  }},revisionKeys)
};
