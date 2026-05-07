import opencascade from "replicad-opencascadejs/src/replicad_single.js";
import opencascadeWasm from "replicad-opencascadejs/src/replicad_single.wasm?url";
import { setOC } from "replicad";

let initPromise = null;

// Lazy, single-shot OpenCascade loader. ~12 MB WASM — first call kicks off
// download + compile; subsequent calls reuse the same promise.
export function initCad() {
  if (!initPromise) {
    initPromise = opencascade({ locateFile: () => opencascadeWasm }).then((OC) => {
      setOC(OC);
      return OC;
    });
  }
  return initPromise;
}
