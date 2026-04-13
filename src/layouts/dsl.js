/**
 * Layout DSL — compact notation for defining keyboard rows.
 *
 * R(y, "Esc Tab:1.5 Space:6.25")  →  row at y with keys and optional widths
 * Gaps: "_:1" inserts a 1u horizontal gap.
 * Heights: "Ent:1.25:2" → width 1.25, height 2.
 */
export function R(y, s) {
  const tokens = s.split(" ").filter(Boolean);
  const keys = [];
  tokens.forEach((t) => {
    const p = t.split(":");
    if (p[0] === "_") {
      keys.push({ gap: parseFloat(p[1]) });
      return;
    }
    const o = { l: p[0] };
    if (p[1]) o.w = parseFloat(p[1]);
    if (p[2]) o.h = parseFloat(p[2]);
    keys.push(o);
  });
  return { y, keys };
}

/** Convert DSL rows into an array of key objects with id/x/y/w/h/label. */
export function gen(rows) {
  let id = 1;
  const result = [];
  rows.forEach((row) => {
    let x = 0;
    row.keys.forEach((k) => {
      if (k.gap !== undefined) {
        x += k.gap;
        return;
      }
      result.push({ id: id++, x, y: row.y, w: k.w || 1, h: k.h || 1, label: k.l });
      x += k.w || 1;
    });
  });
  return result;
}
