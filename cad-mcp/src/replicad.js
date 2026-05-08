// Re-exports replicad APIs from the repo-root install so this package and the
// shared/cad/parts/* modules share the same module instance — `setOC`'s OC
// registration is module-level state and must be visible to both sides.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const replicadUrl = pathToFileURL(
  join(repoRoot, "node_modules", "replicad", "dist", "replicad.js"),
).href;

const replicad = await import(replicadUrl);

export const setOC         = replicad.setOC;
export const measureVolume = replicad.measureVolume;
