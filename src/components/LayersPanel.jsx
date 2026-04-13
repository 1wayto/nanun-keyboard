import { useState, useRef, useEffect } from "react";
import { C, FONT_PRIMARY, FONT_MONO } from "../constants";
import { LED_PRESETS, LED_PRESET_NAMES } from "../lightPresets";
import { CASE_COLORS, KEYCAP_COLORWAYS, STEM_COLORS, HOUSING_COLORS, PLATE_COLORS, PCB_COLORS } from "../colorPresets";

const panelStyle = {
  position: "absolute",
  top: 48,
  left: 8,
  width: 220,
  background: `${C.bg}ee`,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  zIndex: 20,
  fontFamily: FONT_PRIMARY,
  fontSize: 10,
  color: C.text,
  backdropFilter: "blur(8px)",
  overflow: "hidden",
  userSelect: "none",
};

const headerStyle = {
  padding: "6px 10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: C.surfaceAlt,
  cursor: "grab",
  borderBottom: `1px solid ${C.border}`,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: C.textMuted,
};

const layerStyle = (visible) => ({
  padding: "5px 10px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  borderBottom: `1px solid ${C.border}22`,
  opacity: visible ? 1 : 0.4,
});

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const toggleStyle = (on) => ({
  width: 24,
  height: 14,
  borderRadius: 7,
  background: on ? C.accent : C.border,
  position: "relative",
  cursor: "pointer",
  transition: "0.15s",
  flexShrink: 0,
});

const toggleKnob = (on) => ({
  width: 10,
  height: 10,
  borderRadius: 5,
  background: "#fff",
  position: "absolute",
  top: 2,
  left: on ? 12 : 2,
  transition: "0.15s",
});

const selectStyle = {
  background: C.surface,
  color: C.textMuted,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  padding: "2px 4px",
  fontSize: 9,
  fontFamily: FONT_PRIMARY,
  cursor: "pointer",
  flex: 1,
  maxWidth: 80,
};

const sliderStyle = { width: 60, accentColor: C.accent };

const labelStyle = { fontWeight: 600, flex: 1, fontSize: 10 };

const swatchRow = { display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" };

function ColorSwatches({ colors, value, onChange, showCustom }) {
  return (
    <div style={swatchRow}>
      {colors.map((c) => {
        const hex = c.hex || c.base || c.top;
        const isActive = value === (c.hex || c.name);
        return (
          <div key={c.name} title={c.name} onClick={() => onChange(c)}
            style={{
              width: 14, height: 14, borderRadius: 3,
              background: hex, cursor: "pointer",
              border: isActive ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
              boxSizing: "border-box",
            }} />
        );
      })}
      {showCustom && (
        <input type="color" value={value || "#222225"}
          onChange={(e) => onChange({ name: "Custom", hex: e.target.value })}
          style={{ width: 14, height: 14, padding: 0, border: "none", cursor: "pointer", background: "none" }}
          title="Custom color" />
      )}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div style={toggleStyle(on)} onClick={onChange}>
      <div style={toggleKnob(on)} />
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, unit }) {
  return (
    <div style={{ ...rowStyle, fontSize: 9 }}>
      <span style={{ color: C.textDim, minWidth: 40 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={sliderStyle} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 8, minWidth: 24, color: C.textDim }}>
        {value}{unit || ""}
      </span>
    </div>
  );
}

export default function LayersPanel({ opts3d, setOpts3d, collapsed, setCollapsed }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ x: 8, y: 48 });
  const dragRef = useRef(null);

  // Dragging
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      setPos({
        x: e.clientX - dragRef.current.ox,
        y: e.clientY - dragRef.current.oy,
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (e) => {
    dragRef.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
  };

  const set = (key, val) => setOpts3d((o) => ({ ...o, [key]: val }));

  if (collapsed) {
    return (
      <div
        style={{
          position: "absolute", left: pos.x, top: pos.y, zIndex: 20,
          background: `${C.bg}ee`, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: "4px 10px", cursor: "pointer", fontSize: 10, fontWeight: 600,
          color: C.textMuted, letterSpacing: 0.5, backdropFilter: "blur(8px)",
        }}
        onClick={() => setCollapsed(false)}
      >
        Layers
      </div>
    );
  }

  return (
    <div ref={panelRef} style={{ ...panelStyle, left: pos.x, top: pos.y }}>
      {/* Header */}
      <div style={headerStyle} onMouseDown={startDrag}>
        <span>Layers</span>
        <span style={{ cursor: "pointer", fontSize: 12, color: C.textDim }} onClick={() => setCollapsed(true)}>×</span>
      </div>

      {/* Global Explode */}
      <div style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}44` }}>
        <SliderRow label="Explode" value={opts3d.layerExplode || 0} min={0} max={1} step={0.05}
          onChange={(v) => set("layerExplode", v)} />
      </div>

      {/* Keycaps */}
      <div style={layerStyle(opts3d.capProfile !== "none")}>
        <div style={rowStyle}>
          <Toggle on={opts3d.capProfile !== "none"}
            onChange={() => set("capProfile", opts3d.capProfile === "none" ? "cherry" : "none")} />
          <span style={labelStyle}>Keycaps</span>
          <select value={opts3d.capProfile === "none" ? "cherry" : opts3d.capProfile}
            onChange={(e) => set("capProfile", e.target.value)} style={selectStyle}>
            {["cherry", "sa", "dsa", "oem"].map((p) => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div style={{ ...rowStyle, fontSize: 9 }}>
          <span style={{ color: C.textDim, minWidth: 40 }}>Color</span>
          <ColorSwatches colors={KEYCAP_COLORWAYS} value={opts3d.keycapColorway || "Minimal White"}
            onChange={(c) => set("keycapColorway", c.name)} showCustom={false} />
        </div>
      </div>

      {/* Switches */}
      <div style={layerStyle(opts3d.switches)}>
        <div style={rowStyle}>
          <Toggle on={opts3d.switches} onChange={() => set("switches", !opts3d.switches)} />
          <span style={labelStyle}>Switches</span>
        </div>
        {opts3d.switches && (
          <>
            <SliderRow label="Explode" value={opts3d.switchExplode || 0} min={0} max={1} step={0.05}
              onChange={(v) => set("switchExplode", v)} />
            <div style={{ ...rowStyle, fontSize: 9 }}>
              <span style={{ color: C.textDim, minWidth: 40 }}>Facing</span>
              <select value={opts3d.ledFacing} onChange={(e) => set("ledFacing", e.target.value)} style={selectStyle}>
                <option value="north">North</option>
                <option value="south">South</option>
              </select>
            </div>
            <div style={{ ...rowStyle, fontSize: 9 }}>
              <span style={{ color: C.textDim, minWidth: 40 }}>Stem</span>
              <ColorSwatches colors={STEM_COLORS} value={opts3d.stemColor || "#d4a04a"}
                onChange={(c) => set("stemColor", c.hex)} showCustom={true} />
            </div>
            <div style={{ ...rowStyle, fontSize: 9 }}>
              <span style={{ color: C.textDim, minWidth: 40 }}>Housing</span>
              <ColorSwatches colors={HOUSING_COLORS} value={opts3d.housingColor || "Black"}
                onChange={(c) => set("housingColor", c.name)} showCustom={false} />
            </div>
          </>
        )}
      </div>

      {/* Plate */}
      <div style={layerStyle(opts3d.showPlate !== false)}>
        <div style={rowStyle}>
          <Toggle on={opts3d.showPlate !== false}
            onChange={() => set("showPlate", opts3d.showPlate === false ? true : false)} />
          <span style={labelStyle}>Plate</span>
        </div>
        <div style={{ ...rowStyle, fontSize: 9 }}>
          <span style={{ color: C.textDim, minWidth: 40 }}>Color</span>
          <ColorSwatches colors={PLATE_COLORS} value={opts3d.plateColor || "#888890"}
            onChange={(c) => set("plateColor", c.hex)} showCustom={true} />
        </div>
      </div>

      {/* PCB */}
      <div style={layerStyle(opts3d.showPCB !== false)}>
        <div style={rowStyle}>
          <Toggle on={opts3d.showPCB !== false}
            onChange={() => set("showPCB", opts3d.showPCB === false ? true : false)} />
          <span style={labelStyle}>PCB</span>
        </div>
        <div style={{ ...rowStyle, fontSize: 9 }}>
          <span style={{ color: C.textDim, minWidth: 40 }}>Color</span>
          <ColorSwatches colors={PCB_COLORS} value={opts3d.pcbColor || "#1a5c2a"}
            onChange={(c) => set("pcbColor", c.hex)} showCustom={true} />
        </div>
      </div>

      {/* Case */}
      <div style={layerStyle(opts3d.caseStyle !== "none")}>
        <div style={rowStyle}>
          <Toggle on={opts3d.caseStyle !== "none"}
            onChange={() => set("caseStyle", opts3d.caseStyle === "none" ? "tray" : "none")} />
          <span style={labelStyle}>Case</span>
          <select value={opts3d.caseStyle === "none" ? "tray" : opts3d.caseStyle}
            onChange={(e) => set("caseStyle", e.target.value)} style={selectStyle}>
            {["tray", "high", "low"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        {opts3d.caseStyle !== "none" && (
          <>
          <SliderRow label="Slope" value={opts3d.slope} min={0} max={15} step={1} unit="°"
            onChange={(v) => set("slope", v)} />
          <div style={{ ...rowStyle, fontSize: 9 }}>
            <span style={{ color: C.textDim, minWidth: 40 }}>Color</span>
            <ColorSwatches colors={CASE_COLORS} value={opts3d.caseColor || "#8a8a90"}
              onChange={(c) => set("caseColor", c.hex)} showCustom={true} />
          </div>
          </>
        )}
      </div>

      {/* LEDs */}
      <div style={layerStyle(opts3d.ledEnabled)}>
        <div style={rowStyle}>
          <Toggle on={opts3d.ledEnabled} onChange={() => set("ledEnabled", !opts3d.ledEnabled)} />
          <span style={labelStyle}>LEDs</span>
        </div>
        {opts3d.ledEnabled && (
          <>
            <div style={{ ...rowStyle, fontSize: 9 }}>
              <span style={{ color: C.textDim, minWidth: 40 }}>Mode</span>
              <select value={opts3d.ledMode} onChange={(e) => set("ledMode", e.target.value)} style={{ ...selectStyle, maxWidth: 120 }}>
                {LED_PRESET_NAMES.map((n) => (
                  <option key={n} value={n}>{LED_PRESETS[n].label}</option>
                ))}
              </select>
            </div>
            <SliderRow label="Bright" value={opts3d.ledBrightness} min={10} max={100} step={5} unit="%"
              onChange={(v) => set("ledBrightness", v)} />
            <SliderRow label="Speed" value={opts3d.ledSpeed} min={0.1} max={3} step={0.1} unit="x"
              onChange={(v) => set("ledSpeed", v)} />
          </>
        )}
      </div>
    </div>
  );
}
