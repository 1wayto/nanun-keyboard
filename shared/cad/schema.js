export const DEFAULT_STATE = {
  schemaVersion: 1,
  plate: { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14.0 },
  parts: ["plate"],
  electrical: {
    board: "esp32-s3-devkitc-1",
    diodeDirection: "col2row",
    rowGpios: "auto",
    colGpios: "auto",
  },
};

const SPECS = {
  "plate.thickness":   { type: "number", min: 0.5, max: 6 },
  "plate.margin":      { type: "number", min: 0,   max: 30 },
  "plate.cornerRadius":{ type: "number", min: 0,   max: 10 },
  "plate.cutoutSize":  { type: "number", min: 12,  max: 16 },
  "electrical.board":           { type: "enum", values: ["esp32-s3-devkitc-1"] },
  "electrical.diodeDirection":  { type: "enum", values: ["col2row", "row2col"] },
  "electrical.rowGpios":        { type: "auto-or-pins" },
  "electrical.colGpios":        { type: "auto-or-pins" },
};

export const PARAM_PATHS = Object.keys(SPECS);

export function validateParam(path, value) {
  const spec = SPECS[path];
  if (!spec) return { ok: false, error: `unknown param path: ${path}` };

  switch (spec.type) {
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        return { ok: false, error: `expected number, got ${typeof value}` };
      }
      if (value < spec.min) return { ok: false, error: `below min ${spec.min}` };
      if (value > spec.max) return { ok: false, error: `above max ${spec.max}` };
      return { ok: true };

    case "enum":
      if (!spec.values.includes(value)) {
        return { ok: false, error: `invalid ${path}: ${value} (allowed: ${spec.values.join(", ")})` };
      }
      return { ok: true };

    case "auto-or-pins":
      if (value === "auto") return { ok: true };
      if (!Array.isArray(value)) {
        return { ok: false, error: `expected 'auto' or integer array, got ${typeof value}` };
      }
      if (!value.every((v) => Number.isInteger(v))) {
        return { ok: false, error: `array must contain only integers` };
      }
      return { ok: true };
  }
  return { ok: false, error: `unsupported spec type for ${path}` };
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
