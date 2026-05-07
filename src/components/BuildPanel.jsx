import { useMemo } from "react";
import { C, FONT_PRIMARY, FONT_MONO, inputStyle } from "../constants";
import { getBounds } from "../utils";
import { Toggle, Slider, SectionLabel } from "./ui";
import { LAYER_DEFS } from "../build/layers";
import { PRINT_BEDS, moduleCountFor } from "../build/moduleSplit";

// Floating right-side panel for the Build & Flash tab.
// Phase A: visibility toggles + explode slider.
// Phase C: print-bed picker + module-count readout.
// Later phases: STL export, KMK firmware, ESP web-flash.
export default function BuildPanel({ keys, buildOpts, setBuildOpts }) {
  const toggleVis = (id) =>
    setBuildOpts((o) => ({ ...o, visible: { ...o.visible, [id]: !(o.visible[id] !== false) } }));

  const layoutW = useMemo(() => {
    const b = getBounds(keys, 8); // same OUTER_MARGIN as layers.js
    return b.maxX - b.minX;
  }, [keys]);

  const moduleCount = moduleCountFor(layoutW, buildOpts.bedWidth);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 250,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 12,
        boxShadow: "0 8px 24px #0000001a",
        fontFamily: FONT_PRIMARY,
        zIndex: 10,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.text, marginBottom: 10 }}>
        Build & Flash
      </div>

      <SectionLabel>Layers</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {[...LAYER_DEFS].reverse().map((def) => (
          <div key={def.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Toggle
              label={def.label}
              checked={buildOpts.visible[def.id] !== false}
              onChange={() => toggleVis(def.id)}
            />
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textDim }}>{def.thickness}mm</span>
          </div>
        ))}
      </div>

      <SectionLabel>View</SectionLabel>
      <div style={{ marginBottom: 12 }}>
        <Slider
          label="Explode"
          value={buildOpts.explode}
          min={0}
          max={40}
          step={1}
          onChange={(v) => setBuildOpts((o) => ({ ...o, explode: v }))}
          unit="mm"
        />
      </div>

      <SectionLabel>Print bed</SectionLabel>
      <div style={{ marginBottom: 6 }}>
        <select
          value={buildOpts.bedWidth}
          onChange={(e) => setBuildOpts((o) => ({ ...o, bedWidth: parseFloat(e.target.value) }))}
          style={{ ...inputStyle, width: "100%", padding: "5px 6px", fontSize: 10 }}
        >
          {PRINT_BEDS.map((b) => (
            <option key={b.id} value={b.w}>{b.label}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 9, color: C.textDim, marginBottom: 12 }}>
        <span>Layout {layoutW.toFixed(0)}mm</span>
        <span style={{ color: moduleCount > 1 ? C.accent : C.textDim, fontWeight: 600 }}>
          {moduleCount === 1 ? "fits in 1 module" : `splits to ${moduleCount} modules`}
        </span>
      </div>

      <div style={{ marginTop: 8, padding: "8px 10px", background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, marginBottom: 2 }}>Coming soon</div>
        <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.4 }}>
          STL export · BOM · KMK firmware · ESP32 web-flash
        </div>
      </div>
    </div>
  );
}
