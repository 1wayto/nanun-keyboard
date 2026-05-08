export const DEFAULT_STATE = {
  schemaVersion: 1,
  plate: { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14.0 },
  parts: ["plate"],
};

const SPECS = {
  "plate.thickness":   { type: "number", min: 0.5, max: 6 },
  "plate.margin":      { type: "number", min: 0,   max: 30 },
  "plate.cornerRadius":{ type: "number", min: 0,   max: 10 },
  "plate.cutoutSize":  { type: "number", min: 12,  max: 16 },
};

export const PARAM_PATHS = Object.keys(SPECS);

export function validateParam(path, value) {
  const spec = SPECS[path];
  if (!spec) return { ok: false, error: `unknown param path: ${path}` };
  if (spec.type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { ok: false, error: `expected number, got ${typeof value}` };
    }
    if (value < spec.min) return { ok: false, error: `below min ${spec.min}` };
    if (value > spec.max) return { ok: false, error: `above max ${spec.max}` };
  }
  return { ok: true };
}

export function getAtPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

export function setAtPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cur = obj;
  for (const k of keys) {
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
  return obj;
}
