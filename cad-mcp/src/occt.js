// Loads OpenCascade WASM in Node and registers it with replicad.
// Lazy + memoized: first call kicks off the ~12MB WASM compile, subsequent
// calls reuse the same promise.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { setOC } from "./replicad.js";

// Resolve the repo root (two dirs up from cad-mcp/src/).
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

let initPromise = null;

export function initOCCT() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  // Resolve the WASM file from the repo-root replicad-opencascadejs install.
  const wasmDir = join(
    repoRoot,
    "node_modules",
    "replicad-opencascadejs",
    "src",
  );
  const wasmPath = join(wasmDir, "replicad_single.wasm");

  // Pre-read the bytes so the Emscripten loader doesn't need to locate the
  // file itself (avoids filesystem race conditions).
  const wasmBinary = readFileSync(wasmPath);

  // replicad-opencascadejs ships a CJS Emscripten bundle that references
  // `__dirname` unconditionally inside its factory body. When loaded via
  // dynamic `import()` from an ESM module the CJS globals are absent, causing
  // a ReferenceError. Polyfilling on `globalThis` before the import makes the
  // factory's scope-chain lookup succeed without modifying the bundle.
  globalThis.__dirname = wasmDir;
  globalThis.__filename = join(wasmDir, "replicad_single.js");

  try {
    const opencascade = (
      await import(pathToFileURL(join(wasmDir, "replicad_single.js")).href)
    ).default;
    const OC = await opencascade({ wasmBinary });
    setOC(OC);
    return OC;
  } finally {
    delete globalThis.__dirname;
    delete globalThis.__filename;
  }
}
