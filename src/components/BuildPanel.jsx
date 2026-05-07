import { C, FONT_PRIMARY, FONT_MONO } from "../constants";
import { Toggle, Slider, SectionLabel } from "./ui";
import { LAYER_DEFS } from "../build/layers";

// Floating right-side panel for the Build & Flash tab.
// Phase A: layer-visibility toggles + exploded-view slider.
// Later phases: print-bed picker, "Export Print Pack" button, "Flash ESP32" button.
export default function BuildPanel({ buildOpts, setBuildOpts }) {
  const toggleVis = (id) =>
    setBuildOpts((o) => ({ ...o, visible: { ...o.visible, [id]: !(o.visible[id] !== false) } }));

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 220,
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

      <div style={{ marginTop: 8, padding: "8px 10px", background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, marginBottom: 2 }}>Coming soon</div>
        <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.4 }}>
          Module split · STL export · BOM · KMK firmware · ESP32 web-flash
        </div>
      </div>
    </div>
  );
}
