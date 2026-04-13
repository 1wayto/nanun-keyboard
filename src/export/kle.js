export function exportKLE(keys) {
  if (!keys.length) return "[]";
  const sorted = [...keys].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  let cY = -1,
    cR = [],
    cX = 0;
  sorted.forEach((k) => {
    if (k.y !== cY) {
      if (cR.length) rows.push(cR);
      cR = [];
      cY = k.y;
      cX = 0;
    }
    const p = {};
    if (k.x !== cX) p.x = +(k.x - cX).toFixed(2);
    if (k.w !== 1) p.w = k.w;
    if ((k.h || 1) !== 1) p.h = k.h;
    if (Object.keys(p).length) cR.push(p);
    cR.push(k.label);
    cX = k.x + k.w;
  });
  if (cR.length) rows.push(cR);
  return JSON.stringify(rows, null, 2);
}

export function importKLE(json) {
  try {
    const d = JSON.parse(json);
    if (!Array.isArray(d)) return null;
    const keys = [];
    let id = 1,
      y = 0;
    d.forEach((row) => {
      if (!Array.isArray(row)) return;
      let x = 0,
        w = 1,
        h = 1;
      row.forEach((item) => {
        if (typeof item === "object" && item !== null) {
          if (item.x) x += item.x;
          if (item.y) y += item.y;
          if (item.w) w = item.w;
          if (item.h) h = item.h;
        } else {
          keys.push({ id: id++, x, y, w, h, label: String(item) });
          x += w;
          w = 1;
          h = 1;
        }
      });
      y += 1;
    });
    return keys.length ? keys : null;
  } catch {
    return null;
  }
}
