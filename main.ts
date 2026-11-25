// The World in One Day — Wednesday 25 November 2026.
// A programmatic flat-vector news poster, drawn with a hand-written PNG
// encoder and a 5x7 bitmap font. Node 22, standard library only, no network.
// Writes /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png), 1024x1024.
//
// Layout: masthead (WORLD NEWS + 25 NOVEMBER 2026), one edge-to-edge
// three-scene triptych across the upper two-thirds (Hormuz / Shenzhou-24 /
// Suryavanshi 204*), a two-column list of the 10 medium stories in the
// bottom third, and a footer DATE CHECK strip for stories from other dates.
// Only the locked 25 Nov story list is used; nothing is invented.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---- palette: cream paper, ink, one red accent, deep navy night ----
const CREAM = [0xf5, 0xef, 0xe0];
const PAPER = [0xef, 0xe6, 0xd2];
const INK = [0x1b, 0x1b, 0x1b];
const NAVY = [0x16, 0x32, 0x4f];
const NIGHT = [0x0d, 0x1f, 0x38];
const RED = [0xc0, 0x39, 0x2b];
const DUSK = [0xe8, 0x7a, 0x3a];
const GOLD = [0xd9, 0xa4, 0x41];
const TEAL = [0x2e, 0x6e, 0x6a];
const GREEN = [0x2f, 0x6b, 0x3a];
const PITCH = [0xc9, 0xa8, 0x6a];
const WHITE = [0xff, 0xff, 0xff];
const GREY = [0x8a, 0x84, 0x78];
const DARKSEA = [0x1e, 0x3d, 0x52];
const FIRE = [0xf2, 0x8c, 0x1e];

type RGB = [number, number, number];
const buf = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = CREAM[0]; buf[i * 3 + 1] = CREAM[1]; buf[i * 3 + 2] = CREAM[2];
}

function px(x: number, y: number, c: RGB): void {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
  const o = (yi * W + xi) * 3;
  buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) { buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; o += 3; }
  }
}
function blend(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}
function vgrad(x: number, y0: number, y1: number, w: number, top: RGB, bot: RGB): void {
  for (let y = y0; y < y1; y++) rect(x, y, w, 1, blend(top, bot, (y - y0) / Math.max(1, y1 - y0 - 1)));
}
function hgrad(x0: number, x1: number, y: number, h: number, left: RGB, right: RGB): void {
  for (let x = x0; x < x1; x++) rect(x, y, 1, h, blend(left, right, (x - x0) / Math.max(1, x1 - x0 - 1)));
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) px(x, y, c);
    }
  }
}
function disc(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) px(x, y, c);
    }
  }
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, th = 1): void {
  const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    circle(x0 + dx * t, y0 + dy * t, th / 2, c);
  }
}
// Scanline polygon fill.
function poly(pts: [number, number][], c: RGB): void {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
}
function qbez(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGB, th: number): void {
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, u = 1 - t;
    circle(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1, th / 2, c);
  }
}

// ---- 5x7 bitmap font (uppercase + digits + punctuation) ----
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '*': ['00000', '10101', '01110', '10101', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
};
function textWidth(s: string, sc: number): number {
  return s.length * 6 * sc - sc;
}
function drawText(s: string, x: number, y: number, sc: number, c: RGB, align: 'l' | 'c' | 'r' = 'l'): void {
  const w = textWidth(s, sc);
  let cx = x;
  if (align === 'c') cx = x - w / 2;
  if (align === 'r') cx = x - w;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] ?? FONT[' '];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '1') rect(cx + i * 6 * sc + col * sc, y + r * sc, sc, sc, c);
      }
    }
  }
}

// ================= MASTHEAD =================
rect(0, 0, W, 92, CREAM);
drawText('WORLD NEWS', 24, 20, 7, INK);
drawText('25 NOVEMBER 2026', 1000, 18, 4, INK, 'r');
drawText('WEDNESDAY - 25.11.2026', 1000, 52, 2, RED, 'r');
rect(0, 88, W, 4, RED);

// ================= TRIPTYCH (y 92..636) =================
// One sky: dusk orange (Hormuz, left) -> deep night blue (space, centre)
// -> dark stadium green (cricket, right). One continuous horizon at y~520.
const TY0 = 92, TY1 = 636;
for (let x = 0; x < W; x++) {
  const t = x / W;
  let top: RGB, bot: RGB;
  if (t < 0.36) { const u = t / 0.36; top = blend([0xf2, 0xb0, 0x6a], [0xe8, 0x7a, 0x3a], u); bot = blend([0xd9, 0x8a, 0x4a], [0x8a, 0x3a, 0x2e], u); }
  else if (t < 0.68) { const u = (t - 0.36) / 0.32; top = blend([0xe8, 0x7a, 0x3a], NIGHT, u); bot = blend([0x8a, 0x3a, 0x2e], NAVY, u); }
  else { const u = (t - 0.68) / 0.32; top = blend(NIGHT, [0x0e, 0x24, 0x1c], u); bot = blend(NAVY, [0x1c, 0x3a, 0x26], u); }
  for (let y = TY0; y < TY1; y++) {
    const v = (y - TY0) / (TY1 - TY0);
    px(x, y, blend(top, bot, v));
  }
}
// Low sun over the strait, clear of the hull.
circle(110, 428, 40, [0xf6, 0xc9, 0x7a]);
circle(110, 428, 28, [0xf2, 0x9a, 0x3c]);
// Stars in the night half.
const stars: [number, number, number][] = [
  [380, 130, 2], [420, 200, 2], [470, 120, 2], [520, 180, 3], [560, 110, 2],
  [600, 210, 2], [640, 140, 2], [700, 120, 2], [760, 190, 2], [820, 130, 2],
  [900, 160, 2], [960, 120, 2], [400, 260, 2], [540, 260, 2], [660, 250, 2],
];
for (const [sx, sy, sr] of stars) circle(sx, sy, sr, CREAM);

// ---------- Scene 1: HORMUZ (x 0..341) ----------
// Sea.
rect(0, 470, 341, 166, DARKSEA);
for (let i = 0; i < 26; i++) { // wave dashes
  const wx = (i * 53) % 330, wy = 486 + ((i * 37) % 130);
  rect(wx, wy, 22 + (i % 3) * 8, 2, blend(DARKSEA, CREAM, 0.25));
}
// Oil sheen around the stricken tanker.
disc(150, 505, 120, 16, [0x14, 0x28, 0x38]);
disc(150, 505, 92, 11, [0x2a, 0x1e, 0x3a]);
// Red translucent exclusion band across the channel.
for (let x = 0; x < 341; x++) {
  for (let y = 470; y < 486; y++) {
    const o = (y * W + x) * 3;
    buf[o] = Math.round(buf[o] * 0.45 + RED[0] * 0.55);
    buf[o + 1] = Math.round(buf[o + 1] * 0.45 + RED[1] * 0.55);
    buf[o + 2] = Math.round(buf[o + 2] * 0.45 + RED[2] * 0.55);
  }
}
// Two stopped tankers nose-to-tail in the narrow channel, far right.
poly([[232, 452], [300, 452], [300, 470], [232, 470]], [0x2b, 0x2b, 0x2b]);
rect(252, 436, 14, 16, [0x2b, 0x2b, 0x2b]);
poly([[292, 448], [338, 448], [338, 470], [292, 470]], [0x3a, 0x3a, 0x3a]);
rect(306, 434, 12, 14, [0x3a, 0x3a, 0x3a]);
// Riyadh skyline silhouette at the far right edge, one smoke column.
rect(318, 420, 23, 50, [0x1b, 0x1b, 0x1b]);
rect(330, 396, 11, 74, [0x1b, 0x1b, 0x1b]);
circle(336, 380, 7, GREY); circle(338, 362, 9, GREY); circle(334, 344, 11, GREY);
circle(332, 326, 8, [0xa8, 0xa2, 0x96]);
// The listing tanker, bow down, fire at the waterline.
poly([[28, 430], [238, 452], [228, 500], [40, 482]], [0x7a, 0x1e, 0x16]); // hull
poly([[28, 430], [238, 452], [236, 462], [30, 440]], [0x3d, 0x3d, 0x3d]); // deck
rect(196, 408, 26, 40, [0x1b, 0x1b, 0x1b]); // funnel
circle(209, 396, 10, [0x2b, 0x2b, 0x2b]); circle(212, 378, 13, [0x3d, 0x3d, 0x3d]); circle(206, 358, 9, GREY);
rect(60, 420, 40, 16, [0xc9, 0xc2, 0xb0]); // deckhouse
// Fire and smoke at the waterline.
poly([[40, 486], [66, 430], [92, 486]], FIRE);
poly([[70, 486], [98, 442], [124, 486]], [0xf6, 0xc9, 0x3c]);
poly([[100, 486], [122, 448], [146, 486]], FIRE);
circle(78, 428, 12, FIRE); circle(112, 436, 9, [0xf6, 0xc9, 0x3c]);
circle(96, 400, 12, [0x2b, 0x2b, 0x2b]); circle(100, 376, 15, [0x3d, 0x3d, 0x3d]); circle(92, 352, 11, GREY);

// ---------- Scene 2: SHENZHOU-24 (x 341..682) ----------
// Earth limb: big arc rising from the bottom, terminator line.
circle(512, 900, 330, [0x1e, 0x5a, 0x8a]);
circle(512, 900, 322, [0x2e, 0x7a, 0xb0]);
rect(341, 560, 341, 76, [0x1e, 0x5a, 0x8a]);
disc(512, 636, 341, 60, [0x1e, 0x5a, 0x8a]);
// Launch trail arcing up from bottom-left of the scene.
qbez(380, 636, 400, 380, 520, 190, [0xf6, 0xc9, 0x3c], 7);
qbez(380, 636, 400, 380, 520, 190, CREAM, 3);
// Rocket at the head of the trail.
poly([[514, 168], [526, 168], [520, 150]], CREAM);
rect(514, 168, 12, 26, CREAM);
poly([[514, 194], [508, 206], [514, 200]], RED);
poly([[526, 194], [532, 206], [526, 200]], RED);
circle(520, 200, 7, FIRE);
// Tiangong station, T-shape, sunlit, top right of the scene (kept clear
// of the cricket floodlight at x=700).
rect(556, 150, 66, 14, GOLD);            // core module
rect(584, 164, 12, 34, GOLD);            // stem of the T
rect(546, 198, 86, 10, [0xd9, 0xa4, 0x41]); // solar wing
rect(546, 150, 10, 14, CREAM);
rect(612, 150, 10, 14, CREAM);
// Flags on the fairing: PRC red + Pakistan green, small.
rect(556, 128, 18, 12, RED);
circle(561, 134, 2, GOLD);
rect(578, 128, 18, 12, [0x01, 0x47, 0x32]);
circle(587, 134, 4, CREAM);
circle(588, 134, 3, [0x01, 0x47, 0x32]);

// ---------- Scene 3: SURYAVANSHI (x 682..1024) ----------
// Stands: dark bank with crowd dots.
rect(682, 300, 342, 336, [0x14, 0x1e, 0x18]);
for (let i = 0; i < 160; i++) {
  const cx = 690 + ((i * 47) % 326), cy = 312 + ((i * 29) % 180);
  px(cx, cy, i % 3 === 0 ? RED : i % 3 === 1 ? CREAM : GOLD);
}
// Floodlight towers flaring.
line(700, 300, 700, 150, INK, 6);
line(1006, 300, 1006, 150, INK, 6);
for (const [fx, fy] of [[700, 140], [1006, 140]] as [number, number][]) {
  circle(fx, fy, 26, [0xf6, 0xe8, 0xb0]);
  circle(fx, fy, 16, CREAM);
  for (let r = 0; r < 4; r++) line(fx - 18 + r * 12, fy + 18, fx - 30 + r * 20, fy + 90, [0xf6, 0xe8, 0xb0], 2);
}
// Pitch: pale diagonal band.
poly([[700, 636], [1024, 636], [1024, 520], [860, 470], [700, 560]], PITCH);
// Scoreboard top-right, sized so every line fits inside the box.
rect(816, 100, 196, 150, INK);
rect(816, 100, 196, 6, RED);
drawText('204*', 914, 114, 7, GOLD, 'c');
drawText('AGE 15', 914, 182, 2, CREAM, 'c');
drawText('53 BALLS', 914, 216, 2, [0xf6, 0xc9, 0x3c], 'c');
// Batter at follow-through, low angle behind him — drawn large so the
// silhouette reads at thumbnail size.
poly([[756, 636], [776, 540], [792, 540], [784, 636]], INK); // back leg
poly([[790, 636], [806, 546], [822, 546], [814, 636]], INK); // front leg
poly([[758, 540], [830, 540], [836, 462], [752, 462]], INK); // torso
circle(794, 442, 18, INK); // helmet
poly([[756, 462], [736, 424], [746, 414], [766, 452]], INK); // back arm
line(772, 462, 884, 400, [0x8a, 0x5a, 0x2e], 9); // bat
// Ball as a comet streak into the stands.
qbez(884, 400, 950, 340, 1000, 250, CREAM, 5);
qbez(884, 400, 950, 340, 1000, 250, [0xf6, 0xc9, 0x3c], 2);
circle(1000, 250, 12, CREAM);
circle(1000, 250, 7, [0xf6, 0xc9, 0x3c]);
circle(1000, 250, 3, RED);

// ---------- One continuous horizon ----------
line(0, 520, 1024, 520, blend(INK, CREAM, 0.35), 3);

// The Earth limb must stay inside the triptych: repaint everything below
// it with paper before the bottom third is drawn.
rect(0, 636, W, 388, CREAM);

// ---------- Scene label bands ----------
// Scene 1
rect(0, 566, 341, 70, INK);
drawText('HORMUZ ATTACK', 170, 578, 3, CREAM, 'c');
drawText('3 MINED, 11+ HURT IN RIYADH', 173, 606, 2, [0xf6, 0xc9, 0x3c], 'c');
// Scene 2
rect(341, 566, 341, 70, INK);
drawText("PAKISTAN'S FIRST", 512, 578, 3, CREAM, 'c');
drawText('ASTRONAUT - SHENZHOU-24', 512, 606, 2, [0xf6, 0xc9, 0x3c], 'c');
// Scene 3
rect(682, 566, 342, 70, INK);
drawText('204* LIST A RECORD', 853, 578, 3, GOLD, 'c');
drawText('SURYAVANSHI, 15 - 53 BALLS', 853, 606, 2, CREAM, 'c');

// ================= BOTTOM THIRD: 10 medium stories =================
rect(0, 636, W, 4, INK);
drawText('ALSO ON 25 NOVEMBER', 24, 652, 3, INK);
drawText('10 MORE STORIES', 1000, 656, 2, RED, 'r');

type Row = { n: string; label: string; sub?: string; icon: (x: number, y: number) => void };
function iconBox(x: number, y: number): void { rect(x, y, 34, 34, PAPER); rect(x, y, 34, 2, RED); }
const rows: Row[] = [
  { n: '5', label: 'CARTAGENA: 30 HOSTAGES IN SIEGE', icon: (x, y) => { iconBox(x, y); rect(x + 7, y + 14, 20, 14, INK); rect(x + 7, y + 8, 20, 6, INK); rect(x + 14, y + 20, 6, 8, RED); } },
  { n: '6', label: 'NATO AWACS TO POLAND', sub: 'AFTER MISSILES LAND', icon: (x, y) => { iconBox(x, y); poly([[x + 4, y + 20], [x + 28, y + 14], [x + 30, y + 18], [x + 6, y + 24]], INK); rect(x + 12, y + 8, 4, 8, INK); } },
  { n: '7', label: 'N. KOREA THREATENS SWISS OFFICE', icon: (x, y) => { iconBox(x, y); line(x + 10, y + 6, x + 10, y + 28, INK, 2); poly([[x + 10, y + 6], [x + 26, y + 11], [x + 10, y + 16]], RED); } },
  { n: '8', label: 'EISENKOT CLINCHES COALITION DEAL', icon: (x, y) => { iconBox(x, y); circle(x + 12, y + 12, 5, INK); circle(x + 23, y + 12, 5, INK); poly([[x + 7, y + 26], [x + 17, y + 18], [x + 27, y + 26]], INK); } },
  { n: '9', label: 'US TARIFFS ON CHINA AND EU', icon: (x, y) => { iconBox(x, y); drawText('%', x + 11, y + 9, 3, RED); } },
  { n: '10', label: 'GUKESH HOLDS SINDAROV IN CHESS', icon: (x, y) => { iconBox(x, y); rect(x + 12, y + 8, 10, 12, INK); poly([[x + 8, y + 26], [x + 26, y + 26], [x + 22, y + 20], [x + 12, y + 20]], INK); } },
  { n: '11', label: 'GTA 6: 39M IN FIRST 4 DAYS', icon: (x, y) => { iconBox(x, y); rect(x + 6, y + 12, 22, 10, INK); circle(x + 11, y + 17, 2, CREAM); circle(x + 23, y + 17, 2, RED); } },
  { n: '12', label: 'SEOUL MINISTER QUITS OVER SCANDAL', icon: (x, y) => { iconBox(x, y); poly([[x + 6, y + 26], [x + 17, y + 8], [x + 28, y + 26]], INK); rect(x + 14, y + 20, 6, 6, RED); } },
  { n: '13', label: 'NEPAL 5.3 QUAKE SHAKES SIKKIM', icon: (x, y) => { iconBox(x, y); poly([[x + 4, y + 18], [x + 11, y + 10], [x + 17, y + 24], [x + 23, y + 12], [x + 30, y + 18]], RED); } },
  { n: '14', label: 'ENGLAND BEAT AUSTRALIA, CHASE 185', icon: (x, y) => { iconBox(x, y); line(x + 8, y + 26, x + 22, y + 10, [0x8a, 0x5a, 0x2e], 4); circle(x + 26, y + 9, 3, RED); } },
];
const colX = [24, 524];
const rowY0 = 692, rowH = 52;
for (let i = 0; i < rows.length; i++) {
  const col = i < 5 ? 0 : 1, r = i % 5;
  const x = colX[col], y = rowY0 + r * rowH;
  // number chip
  circle(x + 10, y + 17, 11, RED);
  drawText(rows[i].n, x + 10, y + 10, rows[i].n.length > 1 ? 1 : 2, CREAM, 'c');
  rows[i].icon(x + 28, y);
  if (rows[i].sub) {
    drawText(rows[i].label, x + 70, y + 4, 2, INK);
    drawText(rows[i].sub, x + 70, y + 26, 2, INK);
  } else {
    drawText(rows[i].label, x + 70, y + 10, 2, INK);
  }
  if (r < 4) rect(x, y + 46, 460, 1, [0xd8, 0xcf, 0xba]);
}

// ================= FOOTER: DATE CHECK strip =================
rect(0, 958, W, 66, INK);
drawText('DATE CHECK - NOT 25 NOV:', 24, 972, 2, GOLD);
drawText("24 NOV MICROSOFT 'CODE RED'  -  19 NOV GTA 6 OUT  -  22-23 NOV NEPAL PM IN INDIA", 24, 996, 2, CREAM);

// ---- PNG encode (hand-written, deterministic) ----
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
console.log(`wrote ${join(outDir, 'entry.png')} ${png.length} bytes ${W}x${H}`);
