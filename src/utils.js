import { SNAP, UNIT } from "./constants";

export const snap = (v) => Math.round(v / SNAP) * SNAP;

export const isISOEnter = (k) =>
  k.h >= 2 && k.w >= 1.25 && k.w <= 1.5 && /^(Ent|Enter|En)$/i.test(k.label);

export function getBounds(keys, margin) {
  if (!keys.length)
    return { minX: 0, minY: 0, maxX: UNIT * 4, maxY: UNIT * 2 };
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity;
  keys.forEach((k) => {
    const lx = isISOEnter(k) ? (k.x - 0.25) * UNIT : k.x * UNIT;
    a = Math.min(a, lx);
    b = Math.min(b, k.y * UNIT);
    c = Math.max(c, (k.x + k.w) * UNIT);
    d = Math.max(d, (k.y + (k.h || 1)) * UNIT);
  });
  return { minX: a - margin, minY: b - margin, maxX: c + margin, maxY: d + margin };
}

/**
 * Determine which keycap row (R1-R4) a key belongs to based on its Y position.
 * R1 = top rows (Esc, F-keys, numbers), R2 = QWERTY, R3 = home, R4 = bottom + space.
 */
export function getKeyRow(keyY, layoutMinY) {
  const relY = keyY - layoutMinY;
  if (relY < 1.5) return 1;
  if (relY < 2.5) return 2;
  if (relY < 3.5) return 3;
  return 4;
}
