import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_STATE, validateParam, setAtPath } from "../../shared/cad/schema.js";

export function createStateStore(filePath) {
  function read() {
    if (!existsSync(filePath)) {
      writeAtomic(filePath, DEFAULT_STATE);
      return structuredClone(DEFAULT_STATE);
    }
    const raw = readFileSync(filePath, "utf8");
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`cad-state.json is not valid JSON: ${e.message}`);
    }
  }

  function write(state) {
    writeAtomic(filePath, state);
  }

  function setParam(path, value) {
    const v = validateParam(path, value);
    if (!v.ok) return v;
    const next = read();
    setAtPath(next, path, value);
    write(next);
    return { ok: true, state: next };
  }

  return { read, write, setParam, filePath };
}

function writeAtomic(filePath, obj) {
  const tmp = join(dirname(filePath), `.${Math.random().toString(36).slice(2)}.tmp`);
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, filePath);
}
