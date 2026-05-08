import { drawRoundedRectangle, drawRectangle } from "replicad";

const UNIT = 19.05;

// Build the switch plate as a parametric replicad Solid.
// Layout +Y maps to CAD -Y so the back of the keyboard ends up at +Y.
export function buildPlate(keys, params) {
  const margin       = params.margin       ?? 5;
  const thickness    = params.thickness    ?? 1.5;
  const cornerRadius = params.cornerRadius ?? 2;
  const cutoutSize   = params.cutoutSize   ?? 14;

  const b = layoutBounds(keys, margin);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const midX = (b.minX + b.maxX) / 2;
  const midY = (b.minY + b.maxY) / 2;

  let outline =
    cornerRadius > 0
      ? drawRoundedRectangle(w, h, cornerRadius)
      : drawRectangle(w, h);

  for (const k of keys) {
    const kw = k.w || 1;
    const kh = k.h || 1;
    const isISO = isISOEnter(k);
    const lx = isISO ? (k.x - 0.25) * UNIT : k.x * UNIT;
    const cx = lx + (kw * UNIT) / 2;
    const cy = k.y * UNIT + (kh * UNIT) / 2;
    const px = cx - midX;
    const py = -(cy - midY);
    outline = outline.cut(drawRectangle(cutoutSize, cutoutSize).translate([px, py]));
  }

  return outline.sketchOnPlane().extrude(thickness);
}

// Mirrored from src/utils.js — kept here so this module has no app-side imports.
function isISOEnter(k) {
  const w = k.w || 1, h = k.h || 1;
  return w >= 1.25 && w <= 1.5 && h >= 2 && /^(Enter|Ent|↵|Return)$/i.test(k.label || "");
}

function layoutBounds(keys, margin) {
  if (!keys.length) return { minX: 0, minY: 0, maxX: UNIT, maxY: UNIT };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const kw = k.w || 1, kh = k.h || 1;
    const isISO = isISOEnter(k);
    const lx = isISO ? (k.x - 0.25) * UNIT : k.x * UNIT;
    minX = Math.min(minX, lx);
    minY = Math.min(minY, k.y * UNIT);
    maxX = Math.max(maxX, lx + kw * UNIT);
    maxY = Math.max(maxY, k.y * UNIT + kh * UNIT);
  }
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}
