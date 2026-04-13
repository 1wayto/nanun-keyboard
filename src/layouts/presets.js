import { R, gen } from "./dsl";

/* ── ANSI Layouts ── */
const A40 = [
  R(0, "Tab Q W E R T Y U I O P Bksp"),
  R(1, "Esc:1.25 A S D F G H J K L Ent:1.75"),
  R(2, "Shft:1.75 Z X C V B N M , . Shft:1.25"),
  R(3, "Ctrl Fn Win Alt Sp:3 Alt Fn ← ↓ →"),
];
const A60 = [
  R(0, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2"),
  R(1, "Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5"),
  R(2, "Caps:1.75 A S D F G H J K L ; ' Ent:2.25"),
  R(3, "Shft:2.25 Z X C V B N M , . / Shft:2.75"),
  R(4, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Fn:1.25 Ctrl:1.25"),
];
const A65 = [
  R(0, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 Del"),
  R(1, "Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5 Hm"),
  R(2, "Caps:1.75 A S D F G H J K L ; ' Ent:2.25 PU"),
  R(3, "Shft:2.25 Z X C V B N M , . / Shft:1.75 ↑ PD"),
  R(4, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt Fn Ctrl ← ↓ →"),
];
const A75 = [
  R(0, "Esc _:0.25 F1 F2 F3 F4 _:0.25 F5 F6 F7 F8 _:0.25 F9 F10 F11 F12 _:0.25 Del"),
  R(1.25, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 Hm"),
  R(2.25, "Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5 PU"),
  R(3.25, "Caps:1.75 A S D F G H J K L ; ' Ent:2.25 PD"),
  R(4.25, "Shft:2.25 Z X C V B N M , . / Shft:1.75 ↑ End"),
  R(5.25, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt Fn Ctrl ← ↓ →"),
];
const ATKL = [
  R(0, "Esc _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12 _:0.25 Prt Scr Pse"),
  R(1.5, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 _:0.25 Ins Hm PU"),
  R(2.5, "Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5 _:0.25 Del End PD"),
  R(3.5, "Caps:1.75 A S D F G H J K L ; ' Ent:2.25"),
  R(4.5, "Shft:2.25 Z X C V B N M , . / Shft:2.75 _:1.25 ↑"),
  R(5.5, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Mn:1.25 Ctrl:1.25 _:0.25 ← ↓ →"),
];
const A100 = [
  R(0, "Esc _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12 _:0.25 Prt Scr Pse"),
  R(1.5, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 _:0.25 Ins Hm PU _:0.25 Nm / * -"),
  R(2.5, "Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5 _:0.25 Del End PD _:0.25 7 8 9 +:1:2"),
  R(3.5, "Caps:1.75 A S D F G H J K L ; ' Ent:2.25 _:3.5 4 5 6"),
  R(4.5, "Shft:2.25 Z X C V B N M , . / Shft:2.75 _:1.25 ↑ _:1.25 1 2 3 En:1:2"),
  R(5.5, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Mn:1.25 Ctrl:1.25 _:0.25 ← ↓ → _:0.25 0:2 ."),
];

/* ── ISO Layouts ── */
const I60 = [
  R(0, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2"),
  R(1, "Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2"),
  R(2, "Caps:1.75 A S D F G H J K L ; ' #"),
  R(3, "Shft:1.25 \\ Z X C V B N M , . / Shft:2.75"),
  R(4, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Fn:1.25 Ctrl:1.25"),
];
const I65 = [
  R(0, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 Del"),
  R(1, "Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2 Hm"),
  R(2, "Caps:1.75 A S D F G H J K L ; ' # _:1.25 PU"),
  R(3, "Shft:1.25 \\ Z X C V B N M , . / Shft:1.75 ↑ PD"),
  R(4, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt Fn Ctrl ← ↓ →"),
];
const I75 = [
  R(0, "Esc _:0.25 F1 F2 F3 F4 _:0.25 F5 F6 F7 F8 _:0.25 F9 F10 F11 F12 _:0.25 Del"),
  R(1.25, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 Hm"),
  R(2.25, "Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2 PU"),
  R(3.25, "Caps:1.75 A S D F G H J K L ; ' # _:1.25 PD"),
  R(4.25, "Shft:1.25 \\ Z X C V B N M , . / Shft:1.75 ↑ End"),
  R(5.25, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt Fn Ctrl ← ↓ →"),
];
const ITKL = [
  R(0, "Esc _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12 _:0.25 Prt Scr Pse"),
  R(1.5, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 _:0.25 Ins Hm PU"),
  R(2.5, "Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2 _:0.25 Del End PD"),
  R(3.5, "Caps:1.75 A S D F G H J K L ; ' #"),
  R(4.5, "Shft:1.25 \\ Z X C V B N M , . / Shft:2.75 _:1.25 ↑"),
  R(5.5, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Mn:1.25 Ctrl:1.25 _:0.25 ← ↓ →"),
];
const I100 = [
  R(0, "Esc _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12 _:0.25 Prt Scr Pse"),
  R(1.5, "~ 1 2 3 4 5 6 7 8 9 0 - = Bk:2 _:0.25 Ins Hm PU _:0.25 Nm / * -"),
  R(2.5, "Tab:1.5 Q W E R T Y U I O P [ ] _:0.25 Ent:1.25:2 _:0.25 Del End PD _:0.25 7 8 9 +:1:2"),
  R(3.5, "Caps:1.75 A S D F G H J K L ; ' # _:4.75 4 5 6"),
  R(4.5, "Shft:1.25 \\ Z X C V B N M , . / Shft:2.75 _:1.25 ↑ _:1.25 1 2 3 En:1:2"),
  R(5.5, "Ctrl:1.25 Win:1.25 Alt:1.25 Space:6.25 Alt:1.25 Win:1.25 Mn:1.25 Ctrl:1.25 _:0.25 ← ↓ → _:0.25 0:2 ."),
];

/* ── Macropads ── */
const PAD_2x4 = [
  { id: 1, x: 0, y: 0, w: 1, h: 1, label: "M1" },
  { id: 2, x: 1, y: 0, w: 1, h: 1, label: "M2" },
  { id: 3, x: 2, y: 0, w: 1, h: 1, label: "M3" },
  { id: 4, x: 3, y: 0, w: 1, h: 1, label: "M4" },
  { id: 5, x: 0, y: 1, w: 1, h: 1, label: "M5" },
  { id: 6, x: 1, y: 1, w: 1, h: 1, label: "M6" },
  { id: 7, x: 2, y: 1, w: 1, h: 1, label: "M7" },
  { id: 8, x: 3, y: 1, w: 1, h: 1, label: "M8" },
];
const NUMPAD_3x3 = [
  { id: 1, x: 0, y: 0, w: 1, h: 1, label: "7" },
  { id: 2, x: 1, y: 0, w: 1, h: 1, label: "8" },
  { id: 3, x: 2, y: 0, w: 1, h: 1, label: "9" },
  { id: 4, x: 0, y: 1, w: 1, h: 1, label: "4" },
  { id: 5, x: 1, y: 1, w: 1, h: 1, label: "5" },
  { id: 6, x: 2, y: 1, w: 1, h: 1, label: "6" },
  { id: 7, x: 0, y: 2, w: 1, h: 1, label: "1" },
  { id: 8, x: 1, y: 2, w: 1, h: 1, label: "2" },
  { id: 9, x: 2, y: 2, w: 1, h: 1, label: "3" },
];

/**
 * Preset keyboard layouts.
 * Keys set to null are section headers in the preset dropdown.
 */
export const PRESETS = {
  macropads: null,
  "2×4 Pad": PAD_2x4,
  "3×3 Numpad": NUMPAD_3x3,
  ansi: null,
  "40% ANSI": gen(A40),
  "60% ANSI": gen(A60),
  "65% ANSI": gen(A65),
  "75% ANSI": gen(A75),
  "TKL ANSI": gen(ATKL),
  "Full ANSI": gen(A100),
  iso: null,
  "60% ISO": gen(I60),
  "65% ISO": gen(I65),
  "75% ISO": gen(I75),
  "TKL ISO": gen(ITKL),
  "Full ISO": gen(I100),
};
