// Cheap geometric validation that runs in both Node and the browser without
// loading OCCT. The full validate (cad-mcp/src/validate.js) builds on this
// and adds the OCCT-only checks (build_failed, cutout_outside_plate).

const UNIT = 19.05;

export function validateGeometric(keys, state) {
  const issues = [];
  if (!keys.length) {
    issues.push({ severity: "error", code: "empty_layout", msg: "layout has zero keys" });
    return issues;
  }
  issues.push(...checkOverlappingCutouts(keys, state));
  issues.push(...checkPlateDimensions(keys, state));
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
