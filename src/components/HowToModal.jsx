import { useState } from "react";
import { C, FONT_PRIMARY, FONT_MONO } from "../constants";

const steps = [
  {
    title: "Choose a Layout",
    desc: "Select a keyboard layout from the Presets dropdown in the toolbar. Choose from 40% to Full size in ANSI or ISO configurations, plus macropads.",
    tip: "You can also import custom layouts using KLE JSON format.",
  },
  {
    title: "Edit Keys",
    desc: "In Layout view, click any key to select it. Drag to reposition. Use the bottom panel to change the label, width, and height. Press Delete to remove a key.",
    tip: "Hold Shift + Arrow keys to move keys by 1u instead of 0.25u.",
  },
  {
    title: "Switch to 3D View",
    desc: "Click the '3D' button in the header to see your keyboard rendered in 3D with realistic keycaps, switches, and case.",
    tip: "Left-click drag to orbit, middle-click drag to pan, scroll to zoom.",
  },
  {
    title: "Use the Layers Panel",
    desc: "The floating Layers panel on the left controls visibility and settings for each component: Keycaps, Switches, Plate, PCB, Case, and LEDs.",
    tip: "Toggle layers on/off to see inside. Use the Explode slider to separate all layers.",
  },
  {
    title: "Customize Colors",
    desc: "Each layer has color presets — click the swatches to change case color, keycap colorway, switch stem color, plate material, and PCB color.",
    tip: "Use the color picker (rightmost swatch) for custom colors.",
  },
  {
    title: "Explore Keycap Profiles",
    desc: "Switch between Cherry, SA, DSA, and OEM profiles. Each has accurate per-row height sculpting — notice how R1 (number row) is taller than R3 (home row).",
    tip: "SA profile is the tallest, Cherry is the lowest. DSA is uniform across all rows.",
  },
  {
    title: "Inspect Switches",
    desc: "Enable Switches in the Layers panel, then use the Explode slider to see the multi-part Cherry MX model: bottom housing, top housing (transparent), spring, and stem.",
    tip: "Click a keycap to press it — watch the stem push down and the spring compress!",
  },
  {
    title: "LED Lighting",
    desc: "Enable LEDs to add per-key lighting. Choose from 12 animation presets including Rainbow, Breathe, Fire, and Reactive. Adjust brightness and speed.",
    tip: "Toggle North/South facing to change where the LED sits on the switch.",
  },
  {
    title: "Case & Slope",
    desc: "Choose Tray, High, or Low case styles. Use the Slope slider to add a typing angle — the case bottom builds up naturally at the back.",
    tip: "The Perspective/ISO toggle in the toolbar switches between perspective and orthographic camera views.",
  },
  {
    title: "Export Your Design",
    desc: "Export your layout in multiple formats: SVG (plate design), DXF (CNC/laser cutting), KLE JSON (share with community), or KiCad CSV (PCB design).",
    tip: "All exports use precise measurements based on the 19.05mm key pitch standard.",
  },
];

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  backdropFilter: "blur(4px)",
};

export default function HowToModal({ onClose }) {
  const [step, setStep] = useState(0);
  const s = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          width: 480,
          maxWidth: "92vw",
          maxHeight: "85vh",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          fontFamily: FONT_PRIMARY,
          color: C.text,
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: C.surfaceAlt,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>How to Use Keyboard Studio</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Step {step + 1} of {steps.length}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: C.textMuted, fontSize: 18,
            cursor: "pointer", padding: "4px 8px", borderRadius: 4,
          }}>×</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: C.border }}>
          <div style={{
            height: 3,
            background: C.accent,
            width: `${((step + 1) / steps.length) * 100}%`,
            transition: "width 0.3s ease",
            borderRadius: 2,
          }} />
        </div>

        {/* Content */}
        <div style={{ padding: "24px 20px" }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 12,
            color: C.text,
          }}>
            {s.title}
          </div>
          <div style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: C.textMuted,
            marginBottom: 16,
          }}>
            {s.desc}
          </div>

          {/* Tip box */}
          <div style={{
            background: `${C.accent}10`,
            border: `1px solid ${C.accent}30`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 11,
            color: C.textMuted,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}>
            <span style={{ color: C.accent, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>Tip</span>
            <span>{s.tip}</span>
          </div>
        </div>

        {/* Step dots */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 6,
          padding: "0 20px 12px",
        }}>
          {steps.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 4,
                background: i === step ? C.accent : C.border,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>

        {/* Footer buttons */}
        <div style={{
          padding: "12px 20px",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: C.surfaceAlt,
        }}>
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={isFirst}
            style={{
              padding: "6px 16px", fontSize: 12, fontFamily: FONT_PRIMARY, fontWeight: 600,
              border: `1px solid ${C.border}`, borderRadius: 6, cursor: isFirst ? "not-allowed" : "pointer",
              background: "transparent", color: isFirst ? C.textDim : C.textMuted,
              transition: "0.15s",
            }}
          >
            Back
          </button>

          <button
            onClick={() => isLast ? onClose() : setStep((s) => s + 1)}
            style={{
              padding: "6px 20px", fontSize: 12, fontFamily: FONT_PRIMARY, fontWeight: 600,
              border: "none", borderRadius: 6, cursor: "pointer",
              background: C.accent, color: "#fff",
              transition: "0.15s",
            }}
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
