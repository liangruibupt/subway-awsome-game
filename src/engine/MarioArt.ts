// src/engine/MarioArt.ts
// Shared palette + chunky "8-bit platformer" drawing helpers used by every
// PixiJS renderer. Everything is plain vector Graphics (no textures), so it
// stays crisp at any zoom level and needs no asset pipeline.
import { Graphics } from 'pixi.js';

export const PAL = {
  outline: 0x1a0f08,
  sky: 0x5c94fc,
  skyLight: 0x8cb8ff,
  cloud: 0xffffff,
  cloudShade: 0xc8e0ff,
  grass: 0x7ccd4c,
  grassDark: 0x6bb93f,
  grassLight: 0x96dc62,
  hill: 0x3fae3f,
  hillDark: 0x2b8a2b,
  bush: 0x5cc83c,
  bushDark: 0x2f8f22,
  brick: 0xc84c0c,
  brickDark: 0x8a2e00,
  brickLight: 0xf08848,
  ground: 0xe09a4a,
  groundDark: 0xa05a1e,
  dirt: 0xf2cc84,
  dirtDark: 0xc89448,
  question: 0xfcbc3c,
  questionDark: 0xc07000,
  questionLight: 0xfff0a0,
  pipe: 0x2fb83a,
  pipeDark: 0x0c7a18,
  pipeLight: 0x9cf07a,
  coin: 0xffd23c,
  coinDark: 0xc88a00,
  coinLight: 0xfff6c0,
  red: 0xe52521,
  redDark: 0x8e0f0c,
  white: 0xffffff,
  water: 0x3ca0f0,
  waterLight: 0x9ad6ff,
  wood: 0x8a5a2b,
} as const;

/** Parse '#rrggbb' (or a number) to a numeric colour. */
export function toColorNum(c: string | number): number {
  if (typeof c === 'number') return c;
  const hex = c.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex.slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? 0xffffff : n;
}

/** Multiply each RGB channel by `f` (f<1 darkens, f>1 lightens, clamped). */
export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * f)));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * f)));
  return (r << 16) | (g << 8) | b;
}

/** Deterministic LCG PRNG. */
export function seededRand(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Deterministic hash for an integer grid cell → [0,1). */
export function cellHash(x: number, y: number, salt = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ─── Scenery pieces ─────────────────────────────────────────────────────────

/** Puffy three-bump cloud centred at (x, y); `s` = scale (1 ≈ 64px wide). */
export function drawCloud(g: Graphics, x: number, y: number, s = 1, alpha = 1) {
  const bumps: [number, number, number][] = [
    [-20, 4, 14], [0, -4, 18], [20, 4, 14], [-8, 8, 12], [10, 8, 12],
  ];
  // Outline pass (slightly larger, dark), then fill, then shade
  for (const [bx, by, r] of bumps) g.circle(x + bx * s, y + by * s, (r + 2.5) * s);
  g.fill({ color: PAL.outline, alpha });
  for (const [bx, by, r] of bumps) g.circle(x + bx * s, y + by * s, r * s);
  g.fill({ color: PAL.cloud, alpha });
  g.ellipse(x, y + 12 * s, 26 * s, 5 * s).fill({ color: PAL.cloudShade, alpha });
  // Cute eyes, like the classic cloud
  g.roundRect(x - 6 * s, y - 6 * s, 3 * s, 7 * s, 1.5 * s).fill({ color: PAL.outline, alpha });
  g.roundRect(x + 3 * s, y - 6 * s, 3 * s, 7 * s, 1.5 * s).fill({ color: PAL.outline, alpha });
}

/** Rounded hill silhouette sitting on baseline y. */
export function drawHill(g: Graphics, x: number, baseY: number, w: number, h: number, color: number = PAL.hill) {
  g.ellipse(x, baseY, w / 2 + 3, h + 3).fill({ color: PAL.outline });
  g.ellipse(x, baseY, w / 2, h).fill({ color });
  // Spots
  g.ellipse(x - w * 0.18, baseY - h * 0.55, w * 0.04, h * 0.12).fill({ color: shade(color, 0.7) });
  g.ellipse(x + w * 0.12, baseY - h * 0.35, w * 0.04, h * 0.12).fill({ color: shade(color, 0.7) });
  g.ellipse(x - w * 0.05, baseY - h * 0.78, w * 0.035, h * 0.1).fill({ color: shade(color, 0.7) });
}

/** Round bush clump (top-down or side, both read fine). */
export function drawBush(g: Graphics, x: number, y: number, s = 1) {
  const bumps: [number, number, number][] = [[-8, 2, 8], [0, -3, 10], [8, 2, 8]];
  for (const [bx, by, r] of bumps) g.circle(x + bx * s, y + by * s, (r + 2) * s);
  g.fill({ color: PAL.outline });
  for (const [bx, by, r] of bumps) g.circle(x + bx * s, y + by * s, r * s);
  g.fill({ color: PAL.bush });
  g.circle(x - 3 * s, y - 6 * s, 3 * s).fill({ color: PAL.grassLight });
  g.circle(x + 7 * s, y - 1 * s, 2 * s).fill({ color: PAL.grassLight });
}

/** Round-canopy tree with a little trunk and shadow. */
export function drawTree(g: Graphics, x: number, y: number, s = 1) {
  g.ellipse(x + 2 * s, y + 10 * s, 11 * s, 4 * s).fill({ color: 0x000000, alpha: 0.18 });
  g.rect(x - 3 * s, y, 6 * s, 10 * s).fill({ color: PAL.wood }).stroke({ color: PAL.outline, width: 2 * s });
  g.circle(x, y - 6 * s, 12 * s).fill({ color: PAL.hill }).stroke({ color: PAL.outline, width: 2.5 * s });
  g.circle(x - 4 * s, y - 10 * s, 4 * s).fill({ color: PAL.grassLight });
}

/** Tiny flower. */
export function drawFlower(g: Graphics, x: number, y: number, color: number) {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.circle(x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5, 2.2);
  }
  g.fill({ color });
  g.circle(x, y, 1.6).fill({ color: PAL.question });
}

/** Brick block (size = side length, top-left at x, y). */
export function drawBrickBlock(g: Graphics, x: number, y: number, size: number) {
  g.rect(x, y, size, size).fill({ color: PAL.brick }).stroke({ color: PAL.outline, width: 2 });
  const rows = 4;
  const rh = size / rows;
  for (let r = 1; r < rows; r++) {
    g.moveTo(x, y + r * rh).lineTo(x + size, y + r * rh);
  }
  for (let r = 0; r < rows; r++) {
    const off = r % 2 === 0 ? size / 2 : size / 4;
    for (let cx = x + off; cx < x + size; cx += size / 2) {
      g.moveTo(cx, y + r * rh).lineTo(cx, y + (r + 1) * rh);
    }
  }
  g.stroke({ color: PAL.brickDark, width: 1.5 });
  g.rect(x + 2, y + 2, size - 4, 2).fill({ color: PAL.brickLight, alpha: 0.6 });
}

/** "?" block. Returns nothing – the "?" glyph is drawn with rects so no font is needed. */
export function drawQuestionBlock(g: Graphics, x: number, y: number, size: number, used = false) {
  const base = used ? 0xa0703c : PAL.question;
  g.roundRect(x, y, size, size, size * 0.12).fill({ color: base }).stroke({ color: PAL.outline, width: Math.max(2, size * 0.08) });
  // Rivets
  const r = size * 0.06;
  const m = size * 0.16;
  for (const [rx, ry] of [[m, m], [size - m, m], [m, size - m], [size - m, size - m]]) {
    g.circle(x + rx, y + ry, r).fill({ color: used ? 0x6b4420 : PAL.questionDark });
  }
  if (used) return;
  // Top highlight
  g.rect(x + size * 0.12, y + size * 0.08, size * 0.76, size * 0.06).fill({ color: PAL.questionLight, alpha: 0.8 });
  // Pixel "?" on a 5x7 grid
  const Q = [
    '.###.',
    '#...#',
    '....#',
    '...#.',
    '..#..',
    '.....',
    '..#..',
  ];
  const px = size * 0.1;
  const ox = x + (size - px * 5) / 2;
  const oy = y + (size - px * 7) / 2;
  for (let row = 0; row < Q.length; row++) {
    for (let col = 0; col < 5; col++) {
      if (Q[row][col] === '#') {
        g.rect(ox + col * px + px * 0.25, oy + row * px + px * 0.25, px, px).fill({ color: PAL.questionDark });
        g.rect(ox + col * px, oy + row * px, px, px).fill({ color: PAL.white });
      }
    }
  }
}

/** Warp pipe seen from the top (a ring). */
export function drawPipeTop(g: Graphics, x: number, y: number, r: number) {
  g.ellipse(x + 2, y + r * 0.35 + 2, r * 1.05, r * 0.45).fill({ color: 0x000000, alpha: 0.2 });
  g.circle(x, y, r + 2).fill({ color: PAL.outline });
  g.circle(x, y, r).fill({ color: PAL.pipe });
  g.circle(x - r * 0.25, y - r * 0.25, r * 0.55).fill({ color: PAL.pipeLight, alpha: 0.35 });
  g.circle(x, y, r * 0.62).fill({ color: PAL.outline });
  g.circle(x, y, r * 0.5).fill({ color: 0x06300a });
}

/** Side-view warp pipe standing on baseY. */
export function drawPipeSide(g: Graphics, x: number, baseY: number, w: number, h: number) {
  const lip = 8;
  const bodyX = x + 4;
  const bodyW = w - 8;
  g.rect(bodyX, baseY - h + lip * 2, bodyW, h - lip * 2).fill({ color: PAL.pipe }).stroke({ color: PAL.outline, width: 3 });
  g.rect(bodyX + 6, baseY - h + lip * 2 + 2, 6, h - lip * 2 - 4).fill({ color: PAL.pipeLight });
  g.rect(bodyX + bodyW - 12, baseY - h + lip * 2 + 2, 6, h - lip * 2 - 4).fill({ color: PAL.pipeDark });
  g.rect(x, baseY - h, w, lip * 2).fill({ color: PAL.pipe }).stroke({ color: PAL.outline, width: 3 });
  g.rect(x + 6, baseY - h + 3, 6, lip * 2 - 6).fill({ color: PAL.pipeLight });
  g.rect(x + w - 12, baseY - h + 3, 6, lip * 2 - 6).fill({ color: PAL.pipeDark });
}

/** Spinning-looking coin (squash with `squash` in 0..1). */
export function drawCoin(g: Graphics, x: number, y: number, r: number, squash = 1, alpha = 1) {
  const rx = Math.max(0.8, r * squash);
  g.ellipse(x, y, rx + 1.5, r + 1.5).fill({ color: PAL.outline, alpha });
  g.ellipse(x, y, rx, r).fill({ color: PAL.coin, alpha });
  if (rx > r * 0.35) {
    g.ellipse(x, y, rx * 0.55, r * 0.65).fill({ color: PAL.coinDark, alpha });
    g.ellipse(x - rx * 0.1, y, rx * 0.35, r * 0.5).fill({ color: PAL.coin, alpha });
  }
  g.ellipse(x - rx * 0.4, y - r * 0.4, rx * 0.2, r * 0.25).fill({ color: PAL.coinLight, alpha });
}

/** Little mushroom house (top-down-ish, like a world-map toad house). */
export function drawMushroomHouse(g: Graphics, x: number, y: number, s = 1) {
  g.ellipse(x + 2 * s, y + 12 * s, 14 * s, 4 * s).fill({ color: 0x000000, alpha: 0.18 });
  g.roundRect(x - 8 * s, y - 2 * s, 16 * s, 14 * s, 3 * s).fill({ color: 0xfff1d6 }).stroke({ color: PAL.outline, width: 2 * s });
  g.roundRect(x - 3 * s, y + 3 * s, 6 * s, 9 * s, 2 * s).fill({ color: PAL.wood });
  g.ellipse(x, y - 4 * s, 15 * s, 11 * s).fill({ color: PAL.red }).stroke({ color: PAL.outline, width: 2.5 * s });
  g.circle(x - 7 * s, y - 6 * s, 3.2 * s).fill({ color: PAL.white });
  g.circle(x + 6 * s, y - 7 * s, 3.6 * s).fill({ color: PAL.white });
  g.circle(x, y - 12 * s, 2.6 * s).fill({ color: PAL.white });
}

/** Small pond. */
export function drawPond(g: Graphics, x: number, y: number, w: number, h: number) {
  g.ellipse(x, y, w / 2 + 3, h / 2 + 3).fill({ color: PAL.dirtDark });
  g.ellipse(x, y, w / 2, h / 2).fill({ color: PAL.water });
  g.ellipse(x - w * 0.15, y - h * 0.15, w * 0.18, h * 0.08).fill({ color: PAL.waterLight, alpha: 0.9 });
  g.ellipse(x + w * 0.18, y + h * 0.12, w * 0.1, h * 0.05).fill({ color: PAL.waterLight, alpha: 0.7 });
}

/** Side-view ground strip of brick-pattern "ground blocks" from y to bottom. */
export function drawGroundStrip(g: Graphics, x0: number, y: number, width: number, height: number, tile = 32) {
  g.rect(x0, y, width, height).fill({ color: PAL.ground });
  // Top grass lip
  g.rect(x0, y - 6, width, 8).fill({ color: PAL.grass });
  g.rect(x0, y - 8, width, 3).fill({ color: PAL.outline });
  g.rect(x0, y + 2, width, 2).fill({ color: PAL.grassDark });
  for (let ty = y + 4; ty < y + height; ty += tile) {
    const row = Math.round((ty - y) / tile);
    const off = row % 2 === 0 ? 0 : tile / 2;
    for (let tx = x0 - off; tx < x0 + width; tx += tile) {
      g.rect(tx + 1, ty + 1, tile - 2, tile - 2).stroke({ color: PAL.groundDark, width: 2 });
      g.rect(tx + 4, ty + 4, tile * 0.35, 3).fill({ color: 0xffd09a, alpha: 0.7 });
    }
  }
}

/** Banded sky (cheap vertical gradient without FillGradient API differences). */
export function drawSky(g: Graphics, x: number, y: number, w: number, h: number) {
  const bands = 12;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = Math.round(0x5c + (0xa8 - 0x5c) * t);
    const gg = Math.round(0x94 + (0xd8 - 0x94) * t);
    const b = Math.round(0xfc + (0xff - 0xfc) * t);
    g.rect(x, y + (h * i) / bands, w, h / bands + 1).fill({ color: (r << 16) | (gg << 8) | b });
  }
}

/** Shared pixel UI font stacks for Pixi Text objects. */
export const PIXEL_FONT = '"Press Start 2P", "Pixelify Sans", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", monospace';
export const LABEL_FONT = '"Pixelify Sans", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
