// Parametric cell-level path generators for the electrical layer.
// All functions return THREE.Path objects positioned in shape-local mm coords
// (origin = layer center, +X right, +Y "front" of keyboard relative to camera).
// Per spec §3 (cell design) and §4 (matrix wiring).

import * as THREE from "three";
import { UNIT } from "../constants";
import { isISOEnter } from "../utils";

// Coil-spring pin pocket — spec §3.1
// Pocket holds the multi-turn coil that grips the switch pin.
export const PIN_POCKET = {
  innerD: 3.0,        // mm — fits Ø2.8mm coil OD with slack
  pinPitchX: 5.08,    // mm — Cherry MX data-pin spacing along X (±2.54mm from center)
};

// 1N4148 diode pocket — spec §3.2
// Rectangular, oriented with long axis along Y (toward column wire).
export const DIODE_POCKET = {
  length: 4.5,        // mm — 1N4148 body ~3.5mm + slack
  width: 2.0,         // mm — body Ø~1.7mm + slack
  offsetY: 5.5,       // mm — distance from switch center to diode-pocket center
};

// Wire channel — spec §4.1
// Fits 22 AWG solid-core (~0.65mm) with slack so it can be coiled in place.
export const WIRE_CHANNEL = {
  width: 1.5,
};

// Access cover hole — spec §2 (layer 04)
// Exposes the cathode→column solder joint from below.
export const ACCESS_HOLE = {
  diameter: 8,
};

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

// Convert a key to layer-local mm coords. Origin = layer center.
// Layout Y grows downward (top of layout = small Y); we negate so +Y in
// shape-local space corresponds to "front of keyboard" (closer to user) in
// the rendered scene after rotateX(-π/2).
export function keyCenterLocal(k, bounds) {
  const layoutCx = (bounds.minX + bounds.maxX) / 2;
  const layoutCy = (bounds.minY + bounds.maxY) / 2;
  const offsetX = isISOEnter(k) ? -0.25 : 0;
  const cxMm = (k.x + offsetX + k.w / 2) * UNIT;
  const cyMm = (k.y + (k.h || 1) / 2) * UNIT;
  return { x: cxMm - layoutCx, y: -(cyMm - layoutCy) };
}

// === Pocket holes (used by electrical_pockets sub-layer) ===

export function pinPocketHoles(cx, cy) {
  const r = PIN_POCKET.innerD / 2;
  const half = PIN_POCKET.pinPitchX / 2;
  return [circlePath(cx - half, cy, r), circlePath(cx + half, cy, r)];
}

export function diodePocketHole(cx, cy) {
  return rectPath(cx, cy + DIODE_POCKET.offsetY, DIODE_POCKET.width, DIODE_POCKET.length);
}

export function pocketsHolesForLayout(keys, bounds) {
  const holes = [];
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    pinPocketHoles(c.x, c.y).forEach((h) => holes.push(h));
    holes.push(diodePocketHole(c.x, c.y));
  });
  return holes;
}

// === Channel holes (row + column sub-layers) ===

// Group keys by their center-Y (rounded to half-unit) → one row channel each.
// Channel runs the full inner width with a 4mm margin so the wire tail can
// exit toward the I/O section.
export function rowChannelHolesForLayout(keys, bounds) {
  if (!keys.length) return [];
  const holes = [];
  const halfW = (bounds.maxX - bounds.minX) / 2 - 4;
  const groups = new Map();
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    const bin = Math.round(c.y * 2) / 2; // 0.5mm tolerance after centering
    if (!groups.has(bin)) groups.set(bin, c.y);
  });
  groups.forEach((y) => {
    holes.push(rectPath(0, y, halfW * 2, WIRE_CHANNEL.width));
  });
  return holes;
}

// One column channel per unique column-X.
export function colChannelHolesForLayout(keys, bounds) {
  if (!keys.length) return [];
  const holes = [];
  const halfH = (bounds.maxY - bounds.minY) / 2 - 4;
  const groups = new Map();
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    const bin = Math.round(c.x * 4) / 4; // 0.25mm tolerance
    if (!groups.has(bin)) groups.set(bin, c.x);
  });
  groups.forEach((x) => {
    holes.push(rectPath(x, 0, WIRE_CHANNEL.width, halfH * 2));
  });
  return holes;
}

// === Access cover holes ===

export function accessHolesForLayout(keys, bounds) {
  const r = ACCESS_HOLE.diameter / 2;
  return keys.map((k) => {
    const c = keyCenterLocal(k, bounds);
    return circlePath(c.x, c.y, r);
  });
}
