// 5-layer printable-part geometry generators.
// Each top-level layer is either a single Mesh or a composite Group of stacked
// sub-meshes (used by the electrical layer to keep pockets, row channels,
// and column channels as separate printable sub-slabs — spec §4.3).
//
// Coordinate system: shape is built in XY (origin = layer center), then
// rotateX(-π/2) sends extrusion along world Y. Final mesh's local Y runs
// 0..thickness, so positioning by `mesh.position.y = baseY` puts the bottom
// of the layer at world Y = baseY.

import * as THREE from "three";
import { CUTOUT } from "../constants";
import { getBounds } from "../utils";
import {
  keyCenterLocal,
  pocketsHolesForLayout,
  rowChannelHolesForLayout,
  colChannelHolesForLayout,
  accessHolesForLayout,
} from "./cells";

const OUTER_MARGIN = 8;
const CORNER_RADIUS = 4;

// Bottom-up stack order. Each entry's `kind` selects the geometry strategy.
// `composite` entries supply `subs` describing the printable sub-slabs that
// stack within the layer's height. The composite's total thickness equals
// the sum of sub thicknesses; the panel UI shows one toggle per entry.
export const LAYER_DEFS = [
  { id: "bottomCase",  label: "Bottom case",  thickness: 5,   color: 0x2c3038, kind: "solid" },
  { id: "accessCover", label: "Access cover", thickness: 2,   color: 0x5a6068, kind: "accessCover" },
  {
    id: "electrical",
    label: "Electrical",
    thickness: 6,
    color: 0xc89a3a,
    kind: "composite",
    subs: [
      { id: "row_channels", thickness: 1.0, color: 0xb8862c, generator: rowChannelHolesForLayout },
      { id: "col_channels", thickness: 1.0, color: 0xc89a3a, generator: colChannelHolesForLayout },
      { id: "pockets",      thickness: 4.0, color: 0xd4ad48, generator: pocketsHolesForLayout },
    ],
  },
  { id: "switchPlate", label: "Switch plate", thickness: 1.5, color: 0x9aa0a8, kind: "switchHoles" },
  { id: "topCase",     label: "Top case",     thickness: 5,   color: 0x3a4046, kind: "topShell" },
];

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

function outlineMetrics(keys) {
  const bounds = getBounds(keys, OUTER_MARGIN);
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  return { bounds, w, h };
}

function newOuter(w, h) {
  return roundedRectShape(w, h, CORNER_RADIUS);
}

function addSwitchCutouts(shape, keys, bounds) {
  keys.forEach((k) => {
    const c = keyCenterLocal(k, bounds);
    shape.holes.push(squareHolePath(c.x, c.y, CUTOUT));
  });
}

function addTopShellInnerCutout(shape, w, h) {
  const wallThickness = OUTER_MARGIN - 2;
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

function makeMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
}

function extrudeShape(shape, depth, { bevel = true } = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel,
    bevelSize: 0.4,
    bevelThickness: 0.3,
    bevelSegments: 1,
    curveSegments: 12,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function buildSimpleLayer(def, keys) {
  const { bounds, w, h } = outlineMetrics(keys);
  const shape = newOuter(w, h);

  if (def.kind === "switchHoles") {
    addSwitchCutouts(shape, keys, bounds);
  } else if (def.kind === "topShell") {
    addTopShellInnerCutout(shape, w, h);
  } else if (def.kind === "accessCover") {
    accessHolesForLayout(keys, bounds).forEach((p) => shape.holes.push(p));
  }
  // "solid": no holes.

  const mesh = new THREE.Mesh(extrudeShape(shape, def.thickness), makeMaterial(def.color));
  mesh.name = def.id;
  mesh.userData = { layerId: def.id, label: def.label, thickness: def.thickness };
  return mesh;
}

function buildCompositeLayer(def, keys) {
  const { bounds, w, h } = outlineMetrics(keys);
  const group = new THREE.Group();
  group.name = def.id;
  group.userData = { layerId: def.id, label: def.label, thickness: def.thickness };

  let ySub = 0;
  for (const sub of def.subs) {
    const subShape = newOuter(w, h);
    sub.generator(keys, bounds).forEach((p) => subShape.holes.push(p));
    const mesh = new THREE.Mesh(
      extrudeShape(subShape, sub.thickness, { bevel: false }),
      makeMaterial(sub.color),
    );
    mesh.position.y = ySub;
    mesh.name = `${def.id}__${sub.id}`;
    mesh.userData = { layerId: def.id, subId: sub.id, thickness: sub.thickness };
    group.add(mesh);
    ySub += sub.thickness;
  }
  return group;
}

function buildLayer(def, keys) {
  return def.kind === "composite" ? buildCompositeLayer(def, keys) : buildSimpleLayer(def, keys);
}

// Build all top-level layers, positioned bottom-up. Returns an array aligned
// to LAYER_DEFS, each item a Mesh or Group with `position.y` set so its
// bottom rests at the cumulative stack height.
export function buildAllLayers(keys) {
  const objs = LAYER_DEFS.map((def) => buildLayer(def, keys));
  let yCursor = 0;
  objs.forEach((obj, i) => {
    obj.userData.baseY = yCursor;
    obj.position.y = yCursor;
    yCursor += LAYER_DEFS[i].thickness;
  });
  const { w, h } = outlineMetrics(keys);
  return { layers: objs, footprint: { w, h }, totalHeight: yCursor };
}
