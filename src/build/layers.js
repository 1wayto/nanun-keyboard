// 5-layer printable-part geometry generators.
// Phase A: flat extrudes built from a rounded-rect outer shape with
// per-key cutouts. Reuses the Shape + holes pattern from ThreePreview.
// Later phases will add socket pockets, diode pockets, wire channels (electrical
// layer), ESP32 bay (bottom case), and module splitting.

import * as THREE from "three";
import { UNIT, CUTOUT } from "../constants";
import { getBounds, isISOEnter } from "../utils";

// Stack order: bottomCase (Y bottom) → accessCover → electrical → switchPlate → topCase (Y top).
// Per spec §2 the assembled stack reads top-down; this list is bottom-up so
// stacking by accumulated thickness gives the correct vertical order.
export const LAYER_DEFS = [
  { id: "bottomCase",  label: "Bottom case",  thickness: 5,   color: 0x2c3038, kind: "solid" },
  { id: "accessCover", label: "Access cover", thickness: 2,   color: 0x5a6068, kind: "solid" },
  { id: "electrical",  label: "Electrical",   thickness: 6,   color: 0xc89a3a, kind: "switchHoles" },
  { id: "switchPlate", label: "Switch plate", thickness: 1.5, color: 0x9aa0a8, kind: "switchHoles" },
  { id: "topCase",     label: "Top case",     thickness: 5,   color: 0x3a4046, kind: "topShell" },
];

const OUTER_MARGIN = 8; // mm — case wall width around the keys
const CORNER_RADIUS = 4;

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

function squareHolePath(cx, cy, side) {
  const h = side / 2;
  const p = new THREE.Path();
  p.moveTo(cx - h, cy - h);
  p.lineTo(cx + h, cy - h);
  p.lineTo(cx + h, cy + h);
  p.lineTo(cx - h, cy + h);
  p.closePath();
  return p;
}

// Build the keyboard outline shape (rounded rect) centered at origin.
// Returns { shape, w, h } in mm.
function outlineShape(keys) {
  const b = getBounds(keys, OUTER_MARGIN);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  return { shape: roundedRectShape(w, h, CORNER_RADIUS), w, h, bounds: b };
}

// Convert a key's center to layer-local mm coords (origin = layer center).
// Layout Y in 2D editor grows downward; we negate so 3D Z (front=+) reads
// front-to-back consistent with the on-screen layout.
function keyCenterLocal(k, bounds) {
  const layoutCx = (bounds.minX + bounds.maxX) / 2;
  const layoutCy = (bounds.minY + bounds.maxY) / 2;
  const offsetX = isISOEnter(k) ? -0.25 : 0;
  const cxMm = (k.x + offsetX + k.w / 2) * UNIT;
  const cyMm = (k.y + (k.h || 1) / 2) * UNIT;
  return { x: cxMm - layoutCx, y: -(cyMm - layoutCy) };
}

function addSwitchHoles(shape, keys, bounds) {
  keys.forEach((k) => {
    const { x, y } = keyCenterLocal(k, bounds);
    shape.holes.push(squareHolePath(x, y, CUTOUT));
  });
}

// Top-shell inner cutout: a rounded rect inset by case-wall thickness.
// Phase A: simple inset rect. Later phases can replace with switch-hole array
// for a frame-and-grille style.
function addTopShellCutout(shape, w, h) {
  const wallThickness = OUTER_MARGIN - 2; // leave 2mm rim around keys
  const innerW = w - wallThickness * 2;
  const innerH = h - wallThickness * 2;
  const inner = new THREE.Path();
  const r = Math.max(0, CORNER_RADIUS - wallThickness / 2);
  const hw = innerW / 2, hh = innerH / 2;
  inner.moveTo(-hw + r, -hh);
  inner.lineTo(hw - r, -hh);
  inner.quadraticCurveTo(hw, -hh, hw, -hh + r);
  inner.lineTo(hw, hh - r);
  inner.quadraticCurveTo(hw, hh, hw - r, hh);
  inner.lineTo(-hw + r, hh);
  inner.quadraticCurveTo(-hw, hh, -hw, hh - r);
  inner.lineTo(-hw, -hh + r);
  inner.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  shape.holes.push(inner);
}

// Build a single layer mesh. Returns the THREE.Mesh in layer-local coords:
// X right, Z front-to-back, Y = layer thickness extrusion (vertical in world).
function buildLayerMesh(def, keys) {
  const { shape, w, h, bounds } = outlineShape(keys);

  if (def.kind === "switchHoles") {
    addSwitchHoles(shape, keys, bounds);
  } else if (def.kind === "topShell") {
    addTopShellCutout(shape, w, h);
  }
  // "solid" kind: no holes.

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: def.thickness,
    bevelEnabled: true,
    bevelSize: 0.4,
    bevelThickness: 0.3,
    bevelSegments: 1,
    curveSegments: 6,
  });
  // Shape is in XY; extrudes along +Z. Rotate so extrusion runs along world Y.
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = def.id;
  mesh.userData = { layerId: def.id, label: def.label, thickness: def.thickness };
  return mesh;
}

// Build all 5 layers as Three.Meshes positioned in a vertical stack.
// Returns { layers, footprint } where layers is an array in bottom-up order
// matching LAYER_DEFS, and footprint is { w, h } of the keyboard outline.
export function buildAllLayers(keys) {
  const meshes = LAYER_DEFS.map((def) => buildLayerMesh(def, keys));
  let yCursor = 0;
  meshes.forEach((mesh, i) => {
    const def = LAYER_DEFS[i];
    // After rotateX(-π/2), local Y runs 0..thickness (bottom..top of layer).
    // Set position so the layer's bottom sits at yCursor.
    mesh.userData.baseY = yCursor;
    mesh.position.y = yCursor;
    yCursor += def.thickness;
  });
  const { w, h } = outlineShape(keys);
  return { layers: meshes, footprint: { w, h }, totalHeight: yCursor };
}
