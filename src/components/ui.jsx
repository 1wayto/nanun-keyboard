import { C, FONT_PRIMARY } from "../constants";

export const BtnSmall = ({ children, onClick, active, disabled, accent, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "5px 10px",
      fontSize: 11,
      fontFamily: FONT_PRIMARY,
      fontWeight: 600,
      letterSpacing: 0.3,
      border: `1px solid ${disabled ? C.border : danger ? C.danger + "55" : accent ? C.accent + "55" : active ? C.accent : C.border}`,
      borderRadius: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      background: disabled ? C.surface : active ? C.accentDim : danger ? C.danger + "15" : "transparent",
      color: disabled ? C.textDim : danger ? C.danger : active || accent ? C.accent : C.textMuted,
      transition: "all 0.15s",
    }}
  >
    {children}
  </button>
);

export const Toggle = ({ label, checked, onChange }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10, color: C.textMuted, fontWeight: 500 }}>
    <div
      onClick={onChange}
      style={{
        width: 28,
        height: 16,
        borderRadius: 8,
        background: checked ? C.accent : C.border,
        position: "relative",
        transition: "0.2s",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          background: "#fff",
          position: "absolute",
          top: 2,
          left: checked ? 14 : 2,
          transition: "0.2s",
        }}
      />
    </div>
    {label}
  </label>
);

export const Chip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "3px 8px",
      fontSize: 9,
      fontFamily: FONT_PRIMARY,
      fontWeight: 600,
      letterSpacing: 0.5,
      border: `1px solid ${active ? C.accent : C.border}`,
      borderRadius: 4,
      background: active ? C.accentDim : "transparent",
      color: active ? C.accent : C.textDim,
      cursor: "pointer",
      textTransform: "uppercase",
      transition: "0.15s",
    }}
  >
    {label}
  </button>
);

export const Slider = ({ label, value, min, max, step, onChange, unit }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.textMuted, fontWeight: 500 }}>
    <span>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: 60, accentColor: C.accent }} />
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, minWidth: 24 }}>{value}{unit || ""}</span>
  </label>
);

export const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: C.textDim, marginBottom: 5 }}>
    {children}
  </div>
);

export const PropLabel = ({ label, children }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 4, color: C.textMuted, fontSize: 10, fontWeight: 500 }}>
    <span style={{ minWidth: 16 }}>{label}</span>
    {children}
  </label>
);

export const ExportBtn = ({ label, sub, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 10px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      cursor: "pointer",
      transition: "all 0.15s",
      minWidth: 52,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = C.accent;
      e.currentTarget.style.background = C.accentDim;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = C.border;
      e.currentTarget.style.background = C.surface;
    }}
  >
    <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: FONT_PRIMARY }}>{label}</span>
    <span style={{ fontSize: 8, color: C.textDim, letterSpacing: 0.5 }}>{sub}</span>
  </button>
);

export const GitHubIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill={C.textMuted}>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);
