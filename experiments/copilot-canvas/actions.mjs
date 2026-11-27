import {readFile} from "node:fs/promises";
import {layoutContract} from "./layout-contract.mjs";
import {readAuthoringAssets} from "./assets.mjs";
const obj=(properties={},required=[])=>({type:"object",properties,required,additionalProperties:false});
const commandSchema={type:"object",required:["command"],properties:{command:{enum:["object.upsert","object.update","object.move","object.resize","object.delete","object.visibility","behaviour.upsert","behaviour.delete","camera.focus","camera.overview","camera.set"]}},additionalProperties:true};
const empty=obj();
const stateSchema=obj();
const batchSchema=obj({commands:{type:"array",minItems:1,maxItems:100,items:commandSchema},expectedRevision:{type:"integer",minimum:0},expectedEpoch:{type:"string",minLength:1,maxLength:128}},["commands","expectedRevision","expectedEpoch"]);
const sceneDocument=obj({
  version:{const:1},title:{type:"string"},objects:{type:"array",maxItems:250},
  behaviours:{type:"array"},sources:{type:"object"},camera:{type:"object"}
},["version","title","objects","behaviours","sources","camera"]);
const sceneSchema=obj({scene:sceneDocument},["scene"]);
const layoutSample=obj({
  width:{type:"integer",minimum:320,maximum:1920},
  height:{type:"integer",minimum:360,maximum:1200},
  focus:{type:"string",pattern:"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$"},
  zoom:{type:"number",minimum:0.002,maximum:16},
  minTextPx:{type:"number",minimum:0,maximum:24}
},["width","height"]);
const layoutSchema=obj({
  expectedRevision:{type:"integer",minimum:0},
  expectedEpoch:{type:"string",minLength:1,maxLength:128},
  candidateScene:sceneDocument,
  samples:{type:"array",minItems:1,maxItems:6,items:layoutSample}
},["expectedRevision","expectedEpoch"]);
export function makeActions(getInstance){
  const call=(ctx,operation)=>getInstance(ctx.instanceId).broker.call(operation,ctx.input||{});
  return [
    {name:"inspect_workspace",description:"Read authoritative browser workspace, object geometry, camera, revision and bridgeEpoch. Call before editing.",inputSchema:stateSchema,handler:ctx=>call(ctx,"state")},
    {name:"validate_layout",description:"Measure rendered clipping, heading obstructions, overlap and readability. Pass a fresh revision and epoch. Supply samples to check narrow viewports or semantic variants. Optionally include candidateScene with samples to check a proposed scene before publishing.",inputSchema:layoutSchema,handler:ctx=>call(ctx,"layout")},
    {name:"apply_commands",description:"Apply validated declarative Contextarium batch. Pass expectedRevision and expectedEpoch from fresh inspect_workspace. Camera may be vetoed by human. Do not use arbitrary HTML or JS.",inputSchema:batchSchema,handler:ctx=>call(ctx,"batch")},
    {name:"load_scene",description:"Intentionally replace entire workspace; only for initialization or explicitly requested reset. Use Contextarium v1 JSON.",inputSchema:sceneSchema,handler:ctx=>call(ctx,"load")},
    {name:"recent_events",description:"Read recent UI and camera events; no automatic model invocation from passive telemetry.",inputSchema:empty,handler:ctx=>getInstance(ctx.instanceId).broker.events()},
    {name:"authoring_guide",description:"Read Contextarium command contract, component sizing, design guidance, and examples before creating a workspace.",inputSchema:empty,handler:async()=>({layoutContract,guide:await readFile(new URL("AUTHORING.md",import.meta.url),"utf8"),...await readAuthoringAssets()})}
  ];
}
