import { C, FONT_PRIMARY, FONT_MONO } from "../constants";

// Flash tab — placeholder until firmware/web-flash lands.
export default function FlashView() {
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: C.bg, fontFamily: FONT_PRIMARY,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
        <div
          style={{
            fontSize: 10, fontWeight: 700, color: C.textDim,
            letterSpacing: 2, textTransform: "uppercase", marginBottom: 8,
          }}
        >
          Coming soon
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 10 }}>
          Flash firmware to your keyboard
        </div>
        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
          One-click WebSerial / WebUSB flashing for KMK and QMK builds tailored to your layout.
        </div>
        <div
          style={{
            marginTop: 18, fontFamily: FONT_MONO, fontSize: 10, color: C.textDim,
            opacity: 0.7,
          }}
        >
          esp-web-tools · uf2 · dfu
        </div>
      </div>
    </div>
  );
}
