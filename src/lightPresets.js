function hsl2rgb(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

export const LED_PRESETS = {
  static:   { label: "White",    fn: () => [1, 1, 1] },
  warm:     { label: "Warm",     fn: () => [1, 0.85, 0.65] },
  red:      { label: "Red",      fn: () => [1, 0.1, 0.05] },
  cyan:     { label: "Cyan",     fn: () => [0, 0.9, 1] },
  breathe:  { label: "Breathe",  fn: (t) => { const v = (Math.sin(t * 2) + 1) / 2; return [v, v, v]; } },
  rainbow:  { label: "Rainbow",  fn: (t, i, n) => hsl2rgb(t * 0.1 + i / n, 1, 0.5) },
  ripple:   { label: "Ripple",   fn: (t, i, n, kx, ky) => { const d = Math.sqrt(kx * kx + ky * ky); const v = (Math.sin(t * 4 - d * 0.8) + 1) / 2; return hsl2rgb(0.55, 1, v * 0.5); } },
  rain:     { label: "Rain",     fn: (t, i) => { const v = (Math.sin(t * 6 + i * 7.3) + 1) / 2; return [v * 0.2, v * 0.5, v]; } },
  fire:     { label: "Fire",     fn: (t, i) => { const v = (Math.sin(t * 3 + i * 2.1) + 1) / 2; return [1, v * 0.6, v * 0.1]; } },
  aurora:   { label: "Aurora",   fn: (t, i, n) => hsl2rgb(0.45 + Math.sin(t * 0.5 + i / n * 3) * 0.15, 0.8, 0.3 + Math.sin(t * 2 + i) * 0.2) },
  gradient: { label: "Gradient", fn: (t, i, n, kx, ky, maxX) => hsl2rgb(kx / (maxX || 15), 1, 0.5) },
  reactive: { label: "Reactive", fn: () => [0.05, 0.05, 0.05] },
};

export const LED_PRESET_NAMES = Object.keys(LED_PRESETS);
