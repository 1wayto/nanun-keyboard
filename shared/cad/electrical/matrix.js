import { BOARDS } from "./esp32s3.js";

export function computeMatrix(keys, electrical) {
  const board = BOARDS[electrical.board];
  if (!board) throw new Error(`unknown board: ${electrical.board}`);

  if (!keys.length) {
    return { dims: { rows: 0, cols: 0 }, pinmap: { rows: [], cols: [] }, keyMatrix: {}, unused: [...board.SAFE_PINS] };
  }

  const rowsByY = new Map();
  for (const k of keys) {
    const ry = Math.floor(k.y);
    if (!rowsByY.has(ry)) rowsByY.set(ry, []);
    rowsByY.get(ry).push(k);
  }
  const sortedYs = [...rowsByY.keys()].sort((a, b) => a - b);

  const keyMatrix = {};
  let maxCols = 0;
  sortedYs.forEach((y, rowIdx) => {
    const ks = rowsByY.get(y).slice().sort((a, b) => a.x - b.x);
    if (ks.length > maxCols) maxCols = ks.length;
    ks.forEach((k, colIdx) => {
      keyMatrix[k.id] = { row: rowIdx, col: colIdx };
    });
  });
  const dims = { rows: sortedYs.length, cols: maxCols };

  const safe = board.SAFE_PINS;
  const rowPins = pickPins(electrical.rowGpios, dims.rows, safe, []);
  const colPins = pickPins(electrical.colGpios, dims.cols, safe, rowPins);

  for (const k of keys) {
    const m = keyMatrix[k.id];
    m.gpioRow = rowPins[m.row];
    m.gpioCol = colPins[m.col];
  }

  const used = new Set([...rowPins, ...colPins]);
  const unused = safe.filter((p) => !used.has(p));

  return { dims, pinmap: { rows: rowPins, cols: colPins }, keyMatrix, unused };
}

function pickPins(spec, count, safe, alreadyTaken) {
  if (Array.isArray(spec)) {
    return spec.slice(0, count);
  }
  const taken = new Set(alreadyTaken);
  const out = [];
  for (const p of safe) {
    if (taken.has(p)) continue;
    out.push(p);
    if (out.length === count) break;
  }
  return out;
}
