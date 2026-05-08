import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { buildPlate } from "../../shared/cad/parts/plate.js";

// Import measureVolume from the repo-root replicad instance so it shares the
// same OC registration as plate.js (cad-mcp has its own node_modules/replicad).
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const replicadUrl = pathToFileURL(
  join(repoRoot, "node_modules", "replicad", "dist", "replicad.js"),
).href;
const { measureVolume } = await import(replicadUrl);

const UNIT = 19.05;

export function measure(query, keys, state) {
  const { kind } = query;
  switch (kind) {
    case "boundingBox":      return boundingBox(query, keys, state);
    case "partVolume":       return partVolume(query, keys, state);
    case "keyPositions":     return keyPositions(keys);
    case "cutoutPositions":  return cutoutPositions(keys, state);
    default: throw new Error(`unknown measure kind: ${kind}`);
  }
}

function getPart(part, keys, state) {
  if (part !== "plate") throw new Error(`unknown part: ${part}`);
  return buildPlate(keys, state.plate);
}

function boundingBox(query, keys, state) {
  const solid = getPart(query.part || "plate", keys, state);
  const bb = solid.boundingBox;
  const [minX, minY, minZ] = bb.bounds[0];
  const [maxX, maxY, maxZ] = bb.bounds[1];
  return {
    kind: "boundingBox",
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function partVolume(query, keys, state) {
  const solid = getPart(query.part || "plate", keys, state);
  return { kind: "partVolume", volume: measureVolume(solid) };
}

function keyPositions(keys) {
  const positions = keys.map((k) => {
    const kw = k.w || 1, kh = k.h || 1;
    const cx = (k.x + kw / 2) * UNIT;
    const cy = (k.y + kh / 2) * UNIT;
    return { id: k.id, label: k.label, center: { x: cx, y: cy }, w: kw, h: kh };
  });
  return { kind: "keyPositions", positions };
}

function cutoutPositions(keys, state) {
  const cutoutSize = state.plate.cutoutSize;
  const positions = keys.map((k) => {
    const kw = k.w || 1, kh = k.h || 1;
    const cx = (k.x + kw / 2) * UNIT;
    const cy = (k.y + kh / 2) * UNIT;
    return { id: k.id, center: { x: cx, y: cy }, size: cutoutSize };
  });
  return { kind: "cutoutPositions", positions };
}
