// 5-layer printable-part geometry generators.
//
// Phase D-1: every layer is now a Group of per-module meshes. When the
// layout fits in one bed width, each layer has a single module covering
// its full extent (functionally identical to Phase C's single-mesh layer).
// When splits are required, each module is its own Mesh built from a
// clipped rounded-rect outline (rounded only on outer edges) with cells
// and channels filtered/clipped to its X range.
//
// Composite layers (electrical) use the same structure but each per-module
// child is itself a Group of stacked sub-slab meshes.
//
// Coordinate system: shapes built in XY (origin = full layer center) →
// rotateX(-π/2) sends extrusion along world Y. A layer Group at
// position.y = baseY puts its bottom at world Y = baseY.

import * as THREE from "three";
import { CUTOUT } from "../constants";
import { getBounds } from "../utils";
import {
  pocketsHolesForRange,
  rowChannelHolesForRange,
  colChannelHolesForRange,
  accessHolesForRange,
  switchCutoutsForRange,
} from "./cells";
import { computeSplits } from "./moduleSplit";

const OUTER_MARGIN = 8;
const CORNER_RADIUS = 4;
const TOP_SHELL_WALL = 6;
const EPS = 0.001;

// Each entry produces holes for a single module range via `holes(args)`.
// `subs` (composite layers) supplies stacked sub-slabs that each get their
// own hole generator. `isTopShell` flips on the inner-rect cutout that
// makes the top case hollow.
export const LAYER_DEFS = [
  {
    id: "bottomCase", label: "Bottom case", thickness: 5, color: 0x2c3038,
    holes: () => [],
  },
  {
    id: "accessCover", label: "Access cover", thickness: 2, color: 0x5a6068,
    holes: ({ keys, bounds, x1, x2 }) => accessHolesForRange(keys, bounds, x1, x2),
  },
  {
    id: "electrical", label: "Electrical", thickness: 6, color: 0xc89a3a,
    subs: [
      {
        id: "row_channels", thickness: 1.0, color: 0xb8862c,
        holes: ({ keys, bounds, x1, x2, leftIsSeam, rightIsSeam }) =>
          rowChannelHolesForRange(keys, bounds, x1, x2, leftIsSeam, rightIsSeam),
      },
      {
        id: "col_channels", thickness: 1.0, color: 0xc89a3a,
        holes: ({ keys, bounds, x1, x2 }) => colChannelHolesForRange(keys, bounds, x1, x2),
      },
      {
        id: "pockets", thickness: 4.0, color: 0xd4ad48,
        holes: ({ keys, bounds, x1, x2 }) => pocketsHolesForRange(keys, bounds, x1, x2),
      },
    ],
  },
  {
    id: "switchPlate", label: "Switch plate", thickness: 1.5, color: 0x9aa0a8,
    holes: ({ keys, bounds, x1, x2 }) => switchCutoutsForRange(keys, bounds, x1, x2, CUTOUT),
  },
  {
    id: "topCase", label: "Top case", thickness: 5, color: 0x3a4046,
    isTopShell: true,
  },
];

// Draw a rounded rect clipped to [x1, x2] into a Shape or Path. Corners
// stay rounded only at the outer edges of the full layer (where x1==-halfW
// or x2==+halfW); seam edges are drawn as straight verticals.
function drawClippedRoundedRect(target, fullW, fullH, x1, x2, r) {
  const halfW = fullW / 2;
  const isLeftEnd = Math.abs(x1 + halfW) < EPS;
  const isRightEnd = Math.abs(x2 - halfW) < EPS;
  const hh = fullH / 2;

  if (isLeftEnd) target.moveTo(x1 + r, -hh);
  else target.moveTo(x1, -hh);

  if (isRightEnd) {
    target.lineTo(x2 - r, -hh);
    target.quadraticCurveTo(x2, -hh, x2, -hh + r);
  } else {
    target.lineTo(x2, -hh);
  }

  if (isRightEnd) {
    target.lineTo(x2, hh - r);
    target.quadraticCurveTo(x2, hh, x2 - r, hh);
  } else {
    target.lineTo(x2, hh);
  }

  if (isLeftEnd) {
    target.lineTo(x1 + r, hh);
    target.quadraticCurveTo(x1, hh, x1, hh - r);
  } else {
    target.lineTo(x1, hh);
  }

  if (isLeftEnd) {
    target.lineTo(x1, -hh + r);
    target.quadraticCurveTo(x1, -hh, x1 + r, -hh);
  } else {
    target.lineTo(x1, -hh);
  }
}

function moduleRanges(splits, halfW) {
  const sorted = [...splits].sort((a, b) => a - b);
  const ranges = [];
  let prev = -halfW;
  let prevSeam = false;
  for (const s of sorted) {
    ranges.push({ x1: prev, x2: s, leftIsSeam: prevSeam, rightIsSeam: true });
    prev = s;
    prevSeam = true;
  }
  ranges.push({ x1: prev, x2: halfW, leftIsSeam: prevSeam, rightIsSeam: false });
  return ranges;
}

function makeMaterial(color, moduleIndex) {
  // Slight per-module shade so seams are visible without overlay markers.
  const c = new THREE.Color(color);
  if (moduleIndex % 2 === 1) c.multiplyScalar(0.85);
  return new THREE.MeshStandardMaterial({
    color: c, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide,
  });
}

function extrudeShape(shape, depth, bevel = true) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel,
    bevelSize: 0.4, bevelThickness: 0.3, bevelSegments: 1, curveSegments: 12,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function holeArgs(ctx, range) {
  return {
    keys: ctx.keys, bounds: ctx.bounds,
    x1: range.x1, x2: range.x2,
    leftIsSeam: range.leftIsSeam, rightIsSeam: range.rightIsSeam,
  };
}

function buildSimpleModuleMesh(def, ctx, range, moduleIndex) {
  const shape = new THREE.Shape();
  drawClippedRoundedRect(shape, ctx.fullW, ctx.fullH, range.x1, range.x2, CORNER_RADIUS);

  if (def.isTopShell) {
    const wall = TOP_SHELL_WALL;
    const innerX1 = range.leftIsSeam ? range.x1 : range.x1 + wall;
    const innerX2 = range.rightIsSeam ? range.x2 : range.x2 - wall;
    if (innerX2 - innerX1 > 1) {
      const innerR = Math.max(0, CORNER_RADIUS - wall / 2);
      const inner = new THREE.Path();
      drawClippedRoundedRect(inner, ctx.fullW - 2 * wall, ctx.fullH - 2 * wall, innerX1, innerX2, innerR);
      shape.holes.push(inner);
    }
  } else if (def.holes) {
    def.holes(holeArgs(ctx, range)).forEach((p) => shape.holes.push(p));
  }

  const mesh = new THREE.Mesh(
    extrudeShape(shape, def.thickness, true),
    makeMaterial(def.color, moduleIndex),
  );
  mesh.name = `${def.id}__m${moduleIndex}`;
  mesh.userData = {
    layerId: def.id, moduleIndex, thickness: def.thickness,
    x1: range.x1, x2: range.x2,
  };
  return mesh;
}

function buildCompositeModuleGroup(def, ctx, range, moduleIndex) {
  const group = new THREE.Group();
  group.name = `${def.id}__m${moduleIndex}`;
  group.userData = { layerId: def.id, moduleIndex, x1: range.x1, x2: range.x2 };
  let ySub = 0;
  for (const sub of def.subs) {
    const shape = new THREE.Shape();
    drawClippedRoundedRect(shape, ctx.fullW, ctx.fullH, range.x1, range.x2, CORNER_RADIUS);
    sub.holes(holeArgs(ctx, range)).forEach((p) => shape.holes.push(p));
    const mesh = new THREE.Mesh(
      extrudeShape(shape, sub.thickness, false),
      makeMaterial(sub.color, moduleIndex),
    );
    mesh.position.y = ySub;
    mesh.name = `${def.id}__${sub.id}__m${moduleIndex}`;
    mesh.userData = {
      layerId: def.id, subId: sub.id, moduleIndex, thickness: sub.thickness,
      x1: range.x1, x2: range.x2,
    };
    group.add(mesh);
    ySub += sub.thickness;
  }
  return group;
}

function buildLayerGroup(def, ctx, splits) {
  const ranges = moduleRanges(splits, ctx.fullW / 2);
  const layerGroup = new THREE.Group();
  layerGroup.name = def.id;
  layerGroup.userData = {
    layerId: def.id, label: def.label, thickness: def.thickness,
    moduleCount: ranges.length, splits,
  };
  ranges.forEach((range, i) => {
    const child = def.subs
      ? buildCompositeModuleGroup(def, ctx, range, i)
      : buildSimpleModuleMesh(def, ctx, range, i);
    layerGroup.add(child);
  });
  return layerGroup;
}

export function buildAllLayers(keys, options = {}) {
  const { bedWidth = Infinity } = options;
  const bounds = getBounds(keys, OUTER_MARGIN);
  const fullW = bounds.maxX - bounds.minX;
  const fullH = bounds.maxY - bounds.minY;
  const ctx = { keys, bounds, fullW, fullH };

  const objs = LAYER_DEFS.map((def, i) => {
    const splits = computeSplits(fullW, bedWidth, i);
    return buildLayerGroup(def, ctx, splits);
  });

  let yCursor = 0;
  objs.forEach((obj, i) => {
    obj.userData.baseY = yCursor;
    obj.position.y = yCursor;
    yCursor += LAYER_DEFS[i].thickness;
  });
  return { layers: objs, footprint: { w: fullW, h: fullH }, totalHeight: yCursor };
}

// Flatten the layer tree into a list of printable parts for export.
// Each entry is one mesh that becomes one STL file.
export function collectPrintableParts(layers) {
  const parts = [];
  layers.forEach((layerGroup, layerIndex) => {
    layerGroup.children.forEach((child) => {
      if (child.isMesh) {
        parts.push({
          layerIndex,
          layerId: child.userData.layerId,
          subId: null,
          moduleIndex: child.userData.moduleIndex,
          mesh: child,
        });
      } else if (child.isGroup) {
        // Composite module group → one entry per sub-mesh.
        child.children.forEach((subMesh) => {
          if (subMesh.isMesh) {
            parts.push({
              layerIndex,
              layerId: subMesh.userData.layerId,
              subId: subMesh.userData.subId,
              moduleIndex: subMesh.userData.moduleIndex,
              mesh: subMesh,
            });
          }
        });
      }
    });
  });
  return parts;
}
