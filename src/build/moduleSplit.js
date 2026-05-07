// Module-split planner. Decides how many printable modules a layout needs
// and where the seams fall, with staggered-seam offsets between adjacent
// layers per spec §5.3 ("no vertical line through the assembly is broken
// in more than one layer at a time", min 30mm offset).
//
// Phase C is visualization-only: this module returns logical split X
// positions (in shape-local mm coords, origin = layer center). The actual
// per-module mesh splitting + dovetail joints come in Phase D where STL
// export forces the geometric split.

export const PRINT_BEDS = [
  { id: "adv5m",     label: "Flashforge Adventurer 5M (220×220)", w: 220 },
  { id: "ender3",    label: "Ender 3 / V2 / Pro (235×235)",      w: 235 },
  { id: "bambu_a1",  label: "Bambu A1 / X1C (256×256)",          w: 256 },
  { id: "prusa_mk4", label: "Prusa MK4 (250×210)",               w: 250 },
  { id: "any",       label: "No bed limit",                       w: Infinity },
];

// Per-layer X-offset (mm) applied to split positions so adjacent layers
// have seams in different places. Indexed by layer position in the stack
// (LAYER_DEFS order). Adjacent diffs all ≥30mm: 35, 70, 53, 36.
const STAGGER_OFFSETS = [0, 35, -35, 18, -18];

const SEAM_EDGE_MARGIN = 12; // mm — keep seams away from the outer wall

// Compute split X positions for a layer.
// Returns an array of X (shape-local, origin = layer center) — empty if no
// split is needed.
export function computeSplits(layoutWidth, bedWidth, layerIndex) {
  if (!Number.isFinite(bedWidth) || bedWidth <= 0) return [];
  if (bedWidth >= layoutWidth) return [];

  const moduleCount = Math.ceil(layoutWidth / bedWidth);
  if (moduleCount < 2) return [];

  const baseModuleW = layoutWidth / moduleCount;
  const offset = STAGGER_OFFSETS[layerIndex % STAGGER_OFFSETS.length];

  const splits = [];
  const halfW = layoutWidth / 2;
  for (let i = 1; i < moduleCount; i++) {
    const baseSplitX = i * baseModuleW - halfW;
    let x = baseSplitX + offset;
    // Clamp so the seam doesn't crash into the outer wall
    x = Math.max(-halfW + SEAM_EDGE_MARGIN, Math.min(halfW - SEAM_EDGE_MARGIN, x));
    splits.push(x);
  }
  return splits;
}

// Module count for a layout at a given bed width (used for panel readout).
export function moduleCountFor(layoutWidth, bedWidth) {
  if (!Number.isFinite(bedWidth) || bedWidth <= 0 || bedWidth >= layoutWidth) return 1;
  return Math.ceil(layoutWidth / bedWidth);
}
