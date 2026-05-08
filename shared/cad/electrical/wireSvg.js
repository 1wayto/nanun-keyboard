const UNIT = 19.05;
const DIODE_W = 3.5;
const DIODE_H = 1.8;
const DIODE_PAD_PITCH = 7.5;
const LABEL_MARGIN = 25;
const TRACE_W = 0.4;

export function renderWireSVG(keys, plate, matrix) {
  const margin = plate.margin ?? 5;
  const cutout = plate.cutoutSize ?? 14;
  const cornerR = plate.cornerRadius ?? 2;

  const b = layoutBounds(keys, margin);
  const plateW = b.maxX - b.minX;
  const plateH = b.maxY - b.minY;

  const viewW = plateW + LABEL_MARGIN * 2;
  const viewH = plateH + LABEL_MARGIN * 2;

  const sx = (lx) => (lx - b.minX) + LABEL_MARGIN;
  const sy = (ly) => (ly - b.minY) + LABEL_MARGIN;

  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW.toFixed(2)} ${viewH.toFixed(2)}" width="${viewW.toFixed(0)}mm" height="${viewH.toFixed(0)}mm">`);
  out.push(styleBlock());

  out.push(`<rect class="plate" x="${sx(b.minX).toFixed(2)}" y="${sy(b.minY).toFixed(2)}" width="${plateW.toFixed(2)}" height="${plateH.toFixed(2)}" rx="${cornerR}" ry="${cornerR}" />`);

  for (const k of keys) {
    const kw = k.w || 1;
    const kh = k.h || 1;
    const cxMm = (k.x + kw / 2) * UNIT;
    const cyMm = (k.y + kh / 2) * UNIT;
    const x0 = sx(cxMm - cutout / 2);
    const y0 = sy(cyMm - cutout / 2);
    out.push(`<rect data-key="${escapeAttr(k.id)}" class="key" x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${cutout}" height="${cutout}" />`);

    const dxc = sx(cxMm);
    const dyc = sy(cyMm + DIODE_PAD_PITCH);
    out.push(diodeShape(dxc, dyc, k.id));
  }

  if (matrix.dims.rows > 0) {
    const keysByRow = new Map();
    for (const k of keys) {
      const m = matrix.keyMatrix[k.id];
      if (!m) continue;
      if (!keysByRow.has(m.row)) keysByRow.set(m.row, []);
      keysByRow.get(m.row).push(k);
    }
    for (const [rowIdx, rowKeys] of keysByRow.entries()) {
      const ys = rowKeys.map((k) => (k.y + (k.h || 1) / 2) * UNIT);
      const yTrace = ys.reduce((a, b) => a + b, 0) / ys.length;
      const xs = rowKeys.map((k) => (k.x + (k.w || 1) / 2) * UNIT);
      const x1 = sx(Math.min(...xs) - cutout / 2);
      const x2 = sx(Math.max(...xs) + cutout / 2);
      const y = sy(yTrace);
      out.push(`<line class="row-trace" x1="${x1.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y.toFixed(2)}" />`);
      const gpio = matrix.pinmap.rows[rowIdx];
      out.push(`<text class="row-label" x="${(LABEL_MARGIN - 2).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="end" dominant-baseline="middle">R${rowIdx}: GPIO${gpio}</text>`);
    }
  }

  if (matrix.dims.cols > 0) {
    const keysByCol = new Map();
    for (const k of keys) {
      const m = matrix.keyMatrix[k.id];
      if (!m) continue;
      if (!keysByCol.has(m.col)) keysByCol.set(m.col, []);
      keysByCol.get(m.col).push(k);
    }
    for (const [colIdx, colKeys] of keysByCol.entries()) {
      const xs = colKeys.map((k) => (k.x + (k.w || 1) / 2) * UNIT);
      const xTrace = xs.reduce((a, b) => a + b, 0) / xs.length;
      const ys = colKeys.map((k) => (k.y + (k.h || 1) / 2) * UNIT + DIODE_PAD_PITCH);
      const y1 = sy(Math.min(...ys) - DIODE_H);
      const y2 = sy(Math.max(...ys) + DIODE_H);
      const x = sx(xTrace);
      out.push(`<line class="col-trace" x1="${x.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y2.toFixed(2)}" />`);
      const gpio = matrix.pinmap.cols[colIdx];
      out.push(`<text class="col-label" x="${x.toFixed(2)}" y="${(LABEL_MARGIN - 2).toFixed(2)}" text-anchor="middle" dominant-baseline="alphabetic">C${colIdx}: GPIO${gpio}</text>`);
    }
  }

  out.push(`</svg>`);
  return out.join("\n");
}

function diodeShape(cx, cy, keyId) {
  const halfW = DIODE_W / 2;
  const halfH = DIODE_H / 2;
  const padR = 0.5;
  const pad1X = cx - DIODE_PAD_PITCH / 2;
  const pad2X = cx + DIODE_PAD_PITCH / 2;
  return [
    `<g data-diode="${escapeAttr(keyId)}">`,
    `  <circle class="diode-pad" cx="${pad1X.toFixed(2)}" cy="${cy.toFixed(2)}" r="${padR}" />`,
    `  <circle class="diode-pad" cx="${pad2X.toFixed(2)}" cy="${cy.toFixed(2)}" r="${padR}" />`,
    `  <line class="diode-lead" x1="${pad1X.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx - halfW).toFixed(2)}" y2="${cy.toFixed(2)}" />`,
    `  <line class="diode-lead" x1="${(cx + halfW).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${pad2X.toFixed(2)}" y2="${cy.toFixed(2)}" />`,
    `  <rect class="diode-body" x="${(cx - halfW).toFixed(2)}" y="${(cy - halfH).toFixed(2)}" width="${DIODE_W}" height="${DIODE_H}" />`,
    `  <line class="diode-cathode" x1="${(cx + halfW * 0.6).toFixed(2)}" y1="${(cy - halfH).toFixed(2)}" x2="${(cx + halfW * 0.6).toFixed(2)}" y2="${(cy + halfH).toFixed(2)}" />`,
    `</g>`,
  ].join("\n");
}

function styleBlock() {
  return `<style>
    .plate { fill: #f5f5f7; stroke: #888; stroke-width: 0.3; }
    .key { fill: #ddd; stroke: #555; stroke-width: 0.25; }
    .row-trace { stroke: #DB1A1A; stroke-width: ${TRACE_W}; fill: none; }
    .col-trace { stroke: #1a4adb; stroke-width: ${TRACE_W}; fill: none; }
    .diode-pad { fill: #c8a000; }
    .diode-lead { stroke: #888; stroke-width: 0.2; }
    .diode-body { fill: #2a2a2a; stroke: #000; stroke-width: 0.1; }
    .diode-cathode { stroke: #fff; stroke-width: 0.4; }
    .row-label, .col-label { font: bold 3px sans-serif; fill: #222; }
  </style>`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function layoutBounds(keys, margin) {
  if (!keys.length) return { minX: 0, minY: 0, maxX: UNIT, maxY: UNIT };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const kw = k.w || 1, kh = k.h || 1;
    minX = Math.min(minX, k.x * UNIT);
    minY = Math.min(minY, k.y * UNIT);
    maxX = Math.max(maxX, (k.x + kw) * UNIT);
    maxY = Math.max(maxY, (k.y + kh) * UNIT);
  }
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}
