export const UNIT = 19.05;
export const CUTOUT = 14;
export const SNAP = 0.25;
export const KEY_SIZES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 6.25, 7];

export const THEMES = {
  light: {
    bg: "#FFF6F6",
    surface: "#ffffff",
    surfaceAlt: "#f5f0f0",
    border: "#d8d0d0",
    borderLight: "#e8e0e0",
    text: "#2C687B",
    textMuted: "#5a8090",
    textDim: "#8CC7C4",
    accent: "#DB1A1A",
    accentHover: "#e83030",
    accentDim: "#DB1A1A18",
    danger: "#DB1A1A",
    success: "#2a8a4a",
    keySurface: "#f0eded",
    keyAccent: "#fce8e8",
    keyBorder: "#d0c8c8",
    keyAccentBorder: "#e0a0a0",
    keySelected: "#DB1A1A22",
    keySelectedBorder: "#DB1A1A",
    scene3d: "#f0ecec",
  },
  dark: {
    bg: "#1a2028",
    surface: "#222830",
    surfaceAlt: "#282e36",
    border: "#3a4048",
    borderLight: "#48505a",
    text: "#e8e6e3",
    textMuted: "#8a9098",
    textDim: "#5a6068",
    accent: "#DB1A1A",
    accentHover: "#e83030",
    accentDim: "#DB1A1A25",
    danger: "#DB1A1A",
    success: "#4caf6a",
    keySurface: "#2a3038",
    keyAccent: "#382828",
    keyBorder: "#3c4248",
    keyAccentBorder: "#5a3838",
    keySelected: "#DB1A1A30",
    keySelectedBorder: "#DB1A1A",
    scene3d: "#1e2430",
  },
};

// Default to light — will be swapped at runtime via setTheme()
export let C = { ...THEMES.light };

export function setTheme(mode) {
  Object.assign(C, THEMES[mode] || THEMES.light);
}

export const ACCENT_LABELS = new Set([
  "Esc", "Ent", "Enter", "En", "Bk", "Bksp", "Del", "Tab", "Caps",
  "Shft", "Shift", "Ctrl", "Alt", "Win", "Fn", "Mn", "Space", "Sp",
  "Nm", "NmL", "Prt", "Scr", "Pse", "Ins",
]);

// Gap between adjacent keycaps (UNIT - keycap base size: 19.05 - 18.16)
export const KEY_GAP = 0.89;

export const CAP_PROFILES = {
  cherry: {
    label: "Cherry",
    dishType: "cylindrical",
    dishDepth: 0.5,
    insetX: 3.33,
    insetY: 3.83,
    rows: {
      1: { height: 9.4, tilt: -3 },
      2: { height: 7.9, tilt: -1 },
      3: { height: 6.6, tilt: 0 },
      4: { height: 7.1, tilt: 2 },
    },
  },
  sa: {
    label: "SA",
    dishType: "spherical",
    dishDepth: 1.0,
    insetX: 2.73,
    insetY: 2.73,
    rows: {
      1: { height: 14.5, tilt: -8 },
      2: { height: 13.0, tilt: -5 },
      3: { height: 11.7, tilt: 0 },
      4: { height: 12.3, tilt: 5 },
    },
  },
  dsa: {
    label: "DSA",
    dishType: "spherical",
    dishDepth: 0.75,
    insetX: 2.73,
    insetY: 2.73,
    rows: {
      1: { height: 7.6, tilt: 0 },
      2: { height: 7.6, tilt: 0 },
      3: { height: 7.6, tilt: 0 },
      4: { height: 7.6, tilt: 0 },
    },
  },
  oem: {
    label: "OEM",
    dishType: "cylindrical",
    dishDepth: 0.7,
    insetX: 3.33,
    insetY: 2.33,
    rows: {
      1: { height: 11.2, tilt: -4 },
      2: { height: 9.6, tilt: -1 },
      3: { height: 8.8, tilt: 0 },
      4: { height: 8.2, tilt: 4 },
    },
  },
};

export const SWITCH_DIMS = {
  bodyW: 14, bodyD: 14,
  clipW: 15.6,
  belowPlate: 5,
  abovePlate: 6.6,
  stemCrossW: 1.17,
  stemCrossL: 4.0,
  stemProtrusion: 3.6,
  stemCylRadius: 2.75,
};

export const FONT_PRIMARY = "'Plus Jakarta Sans',sans-serif";
export const FONT_MONO = "'JetBrains Mono',monospace";

export const getInputStyle = () => ({
  background: C.bg,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  padding: "3px 6px",
  fontSize: 11,
  fontFamily: FONT_PRIMARY,
  outline: "none",
});
// Keep backward compat — components that import inputStyle still work
export const inputStyle = new Proxy({}, { get: (_, prop) => getInputStyle()[prop] });
