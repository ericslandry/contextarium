import {readFile} from "node:fs/promises";
import {layoutContract} from "../core/layout-contract.mjs";
import {workspaceInputs} from "../core/contracts.mjs";

const readDoc=name=>readFile(new URL("../docs/"+name,import.meta.url),"utf8");

export function makeActions(getInstance){
  const call=(ctx,operation)=>getInstance(ctx.instanceId).broker.call(operation,ctx.input||{});
  return [
    {name:"inspect_workspace",description:"Read authoritative browser workspace, object geometry, camera, revision and bridgeEpoch. Call before editing.",inputSchema:workspaceInputs.empty,handler:ctx=>call(ctx,"state")},
    {name:"validate_layout",description:"Measure rendered clipping, heading obstructions, overlap and readability. Pass a fresh revision and epoch. Supply samples to check narrow viewports or semantic variants. Optionally include candidateScene with samples to check a proposed scene before publishing.",inputSchema:workspaceInputs.layout,handler:ctx=>call(ctx,"layout")},
    {name:"apply_commands",description:"Apply validated declarative Contextarium batch. Pass expectedRevision and expectedEpoch from fresh inspect_workspace. Camera may be vetoed by human. Do not use arbitrary HTML or JS.",inputSchema:workspaceInputs.batch,handler:ctx=>call(ctx,"batch")},
    {name:"load_scene",description:"Intentionally replace entire workspace; only for initialization or explicitly requested reset. Use Contextarium v1 JSON.",inputSchema:workspaceInputs.scene,handler:ctx=>call(ctx,"load")},
    {name:"recent_events",description:"Read recent UI and camera events; no automatic model invocation from passive telemetry.",inputSchema:workspaceInputs.empty,handler:ctx=>getInstance(ctx.instanceId).broker.events()},
    {name:"authoring_guide",description:"Read Contextarium command contract, component sizing, design guidance, and examples before creating a workspace.",inputSchema:workspaceInputs.empty,handler:async()=>({layoutContract,guide:await readDoc("AUTHORING.md"),runtimeContract:await readDoc("SCENE-CONTRACT.md"),design:await readDoc("DESIGN.md")})}
  ];
}
