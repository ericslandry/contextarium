import { access, readFile } from "node:fs/promises";

const prepared = new URL("./assets/", import.meta.url);
const repository = new URL("../../", import.meta.url);

export async function resolveAssetRoot() {
  try {
    await access(new URL("index.html", prepared));
    return prepared;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // The native marketplace installs the repository root as the plugin.
    return repository;
  }
}

export async function readAuthoringAssets() {
  const root = await resolveAssetRoot();
  const designPath = root === repository ? "docs/DESIGN.md" : "DESIGN.md";
  const [runtimeContract, design] = await Promise.all([
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL(designPath, root), "utf8")
  ]);
  return { runtimeContract, design };
}
