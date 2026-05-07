// Parametric cell-level path generators for the electrical layer.
// All functions return THREE.Path objects positioned in shape-local mm coords
// (origin = layer center, +X right, +Y "front" of keyboard relative to camera).
// Per spec §3 (cell design) and §4 (matrix wiring).
//
// Phase D introduces module-aware variants: each generator accepts an
// [x1, x2] range so a single layer can be split into multiple printable
// modules, each holding only the cells that fall in its X range and
// row-channel slots clipped to the seam edges.

import * as THREE from "three";
import { UNIT } from "../constants";
import { isISOEnter } from "../utils";

export const PIN_POCKET = {
  innerD: 3.0,        // mm — fits Ø2.8mm coil OD with slack
  pinPitchX: 5.08,    // mm — Cherry MX data-pin spacing along X (±2.54mm)
};

export const DIODE_POCKET = {
  length: 4.5,
  width: 2.0,
  offsetY: 5.5,       // mm — distance from switch center to diode-pocket center
};

export const WIRE_CHANNEL = {
  width: 1.5,         // mm — fits 22 AWG (~0.65mm) with slack
};

export const ACCESS_HOLE = {
  diameter: 8,        // mm
};

const EPS = 0.001;
const rangeContains = (x, x1, x2) => x >= x1 - EPS && x <= x2 + EPS;

function circlePath(cx, cy, radius) {
  const p = new THREE.Path();
  p.absellipse(cx, cy, radius, radius, 0, Math.PI * 2, false);
  return p;
}

function rectPath(cx, cy, w, h) {
  const p = new THREE.Path();
  const hw = w / 2, hh = h / 2;
  p.moveTo(cx - hw, cy - hh);
  p.lineTo(cx + hw, cy - hh);
  p.lineTo(cx + hw, cy + hh);
  p.lineTo(cx - hw, cy + hh);
  p.closePath();
  return p;
}

export function keyCenterLocal(k, bounds) {
  const layoutCx = (bounds.minX + bounds.maxX) / 2;
  const layoutCy = (bounds.minY + bounds.maxY) / 2;
  const offsetX = isISOEnter(k) ? -0.25 : 0;
  const cxMm = (k.x + offsetX + k.w / 2) * UNIT;
  const cyMm = (k.y + (k.h || 1) / 2) * UNIT;
  return { x: cxMm - layoutCx, y: -(cyMm - layoutCy) };
}

export function pinPocketHoles(cx, cy) {
  const r = PIN_POCKET.innerD / 2;
  const half = PIN_POCKET.pinPitchX / 2;
  return [circlePath(cx - half, cy, r), circlePath(cx + half, cy, r)];
}

export function diodePocketHole(cx, cy) {
  return rectPath(cx, cy + DIODE_POCKET.offsetY, DIODE_POCKET.width, DIODE_POCKET.length);
}

// === Module-aware generators ===

// Pin + diode pockets for keys whose center-X falls in [x1, x2].
export function pocketsHolesForRange(keys, bounds, x1, x2) {
  const holes = [];
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    if (!rangeContains(c.x, x1, x2)) return;
    pinPocketHoles(c.x, c.y).forEach((h) => holes.push(h));
    holes.push(diodePocketHole(c.x, c.y));
  });
  return holes;
}

// Row channel slots, one per unique row-Y, clipped to [x1, x2]. Outer
// boundaries (non-seam) get a 4mm margin so the channel doesn't crash into
// the case wall; seam boundaries run flush so wire crosses the module seam.
export function rowChannelHolesForRange(keys, bounds, x1, x2, leftIsSeam, rightIsSeam) {
  if (!keys.length) return [];
  const left = leftIsSeam ? x1 : x1 + 4;
  const right = rightIsSeam ? x2 : x2 - 4;
  if (right - left <= 1) return [];
  const groups = new Map();
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    const bin = Math.round(c.y * 2) / 2;
    if (!groups.has(bin)) groups.set(bin, c.y);
  });
  const cx = (left + right) / 2;
  const w = right - left;
  return [...groups.values()].map((y) => rectPath(cx, y, w, WIRE_CHANNEL.width));
}

// Column channel slots: one per unique column-X. Vertical (Y-aligned) so
// margins are at top/bottom (always outer edges). Filter by X-in-range.
export function colChannelHolesForRange(keys, bounds, x1, x2) {
  if (!keys.length) return [];
  const halfH = (bounds.maxY - bounds.minY) / 2 - 4;
  const groups = new Map();
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    const bin = Math.round(c.x * 4) / 4;
    if (!groups.has(bin)) groups.set(bin, c.x);
  });
  return [...groups.values()]
    .filter((x) => rangeContains(x, x1, x2))
    .map((x) => rectPath(x, 0, WIRE_CHANNEL.width, halfH * 2));
}

// Access holes for keys whose center-X falls in [x1, x2].
export function accessHolesForRange(keys, bounds, x1, x2) {
  const r = ACCESS_HOLE.diameter / 2;
  const result = [];
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    if (!rangeContains(c.x, x1, x2)) return;
    result.push(circlePath(c.x, c.y, r));
  });
  return result;
}

// Switch plate / electrical-pocket cutouts (square switch holes) for keys
// whose center-X falls in [x1, x2].
export function switchCutoutsForRange(keys, bounds, x1, x2, side) {
  const result = [];
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    if (!rangeContains(c.x, x1, x2)) return;
    result.push(rectPath(c.x, c.y, side, side));
  });
  return result;
}
