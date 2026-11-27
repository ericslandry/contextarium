import {mkdir,copyFile,cp,stat} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {homedir} from "node:os";
const source=dirname(fileURLToPath(import.meta.url));
const root=resolve(source,"../..");
const dest=process.argv.includes("--install")
  ? join(process.env.COPILOT_HOME||join(homedir(),".copilot"),"extensions","contextarium-experiment")
  : join(source,"assets");
if(process.argv.includes("--install")){
  try{await stat(dest);throw Error("Destination exists; remove or rename it explicitly before reinstalling: "+dest);}
  catch(e){if(e.code!=="ENOENT")throw e;}
  await mkdir(dest,{recursive:true});
  for(const f of ["extension.mjs","server.mjs","broker.mjs","browser.mjs","actions.mjs","AUTHORING.md","README.md"])await copyFile(join(source,f),join(dest,f));
}
const assets=process.argv.includes("--install")?join(dest,"assets"):dest;
await mkdir(assets,{recursive:true});
for(const f of ["index.html","scene.json","scene-http.json","risk-details.json","risk-click.json","README.md"])await copyFile(join(root,f),join(assets,f));
await copyFile(join(root,"docs","DESIGN.md"),join(assets,"DESIGN.md"));
console.log("Prepared read-only-source copies at "+assets);
