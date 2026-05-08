import { buildPlate } from "../../shared/cad/parts/plate.js";
import { measureVolume } from "./replicad.js";

const UNIT = 19.05;

export function validate(keys, state) {
  const issues = [];

  if (!keys.length) {
    issues.push({ severity: "error", code: "empty_layout", msg: "layout has zero keys" });
    return issues;
  }

  // Geometric prechecks before building the solid (cheaper).
  issues.push(...checkOverlappingCutouts(keys, state));
  issues.push(...checkPlateDimensions(keys, state));

  // If precheck found dimension errors, skip the solid build (it would crash).
  if (issues.some((i) => i.code === "invalid_dimensions")) return issues;

  // Build the solid; failures are converted to issues.
  let solid;
  try {
    solid = buildPlate(keys, state.plate);
  } catch (e) {
    issues.push({ severity: "error", code: "build_failed", msg: String(e.message || e) });
    return issues;
  }

  // Volume sanity: a valid plate must have positive volume.
  const vol = measureVolume(solid);
  if (!(vol > 0)) {
    issues.push({ severity: "error", code: "cutout_outside_plate", msg: "cutouts removed all material" });
  }

  return issues;
}

function checkOverlappingCutouts(keys, state) {
  const cs = state.plate.cutoutSize;
  const out = [];
  const rects = keys.map((k) => {
    const kw = k.w || 1, kh = k.h || 1;
    const cx = (k.x + kw / 2) * UNIT;
    const cy = (k.y + kh / 2) * UNIT;
    return { id: k.id, x0: cx - cs / 2, x1: cx + cs / 2, y0: cy - cs / 2, y1: cy + cs / 2 };
  });
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) {
        out.push({
          severity: "error",
          code: "overlapping_cutouts",
          msg: `cutouts for ${a.id} and ${b.id} overlap`,
        });
      }
    }
  }
  return out;
}

function checkPlateDimensions(keys, state) {
  const margin = state.plate.margin;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const kw = k.w || 1, kh = k.h || 1;
    minX = Math.min(minX, k.x * UNIT);
    minY = Math.min(minY, k.y * UNIT);
    maxX = Math.max(maxX, (k.x + kw) * UNIT);
    maxY = Math.max(maxY, (k.y + kh) * UNIT);
  }
  const w = maxX - minX + 2 * margin;
  const h = maxY - minY + 2 * margin;
  if (w <= 0 || h <= 0) {
    return [{ severity: "error", code: "invalid_dimensions", msg: `plate dimensions are non-positive: ${w} x ${h}` }];
  }
  return [];
}
