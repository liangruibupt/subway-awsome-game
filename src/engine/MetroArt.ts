// src/engine/MetroArt.ts
// Modern metro rolling-stock drawings (plain vector Graphics).
//
// The look follows current metro design language (Siemens Inspiro, Alstom
// Metropolis, CRRC, Tokyo E235 …): a smooth nose with a large wrap-around
// windscreen, an LED destination display, slim LED headlight strips, a flush
// body with one continuous dark window band, double sliding plug doors, a
// livery stripe along the body, roof-mounted A/C units, a skirt and bogies,
// and gangway bellows between cars. Outlines stay chunky so the trains still
// sit well in the game's retro world.
import { Graphics } from 'pixi.js';
import { PAL, shade } from './MarioArt';

export interface MetroLook {
  /** Main body colour. */
  body: number;
  /** Livery stripe colour (line / city colour). */
  livery: number;
  /** Secondary thin accent line. */
  accent: number;
  /** Windscreen / window glass colour. */
  glass?: number;
  /** Headlight colour. */
  light?: number;
}

const GLASS = 0x16222f;
const GLASS_SHINE = 0x9ad6ff;
const UNDERFRAME = 0x2d3436;
const WHEEL = 0x3d3d3d;
const ROOF_UNIT = 0xb8c2cc;
const LED_ORANGE = 0xffa53c;
const TAIL_RED = 0xff3b30;

/** Linear blend of two colours (t=0 → a, t=1 → b). */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number) => {
    const ca = (a >> s) & 0xff;
    const cb = (b >> s) & 0xff;
    return Math.round(ca + (cb - ca) * t) & 0xff;
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// ─── Top-down (map view) ─────────────────────────────────────────────────────

export interface MetroTopOpts {
  /** Driving car with nose + windscreen at +x. */
  head?: boolean;
  /** Last car of the train: red tail lights at −x. */
  tail?: boolean;
  /** Draw a gangway bellows stub at +x (connects to the car in front). */
  gangway?: boolean;
}

/**
 * Draw one metro car seen from above, centred on the origin and facing +x.
 * Put it in its own Graphics and set position/rotation to place it on track.
 */
export function drawMetroTop(g: Graphics, len: number, wid: number, color: number, opts: MetroTopOpts = {}) {
  const hl = len / 2;
  const hw = wid / 2;
  const roof = mixColor(color, 0xffffff, 0.62);

  // Soft drop shadow
  g.roundRect(-hl + 1.5, -hw + 2.5, len, wid, 4).fill({ color: 0x000000, alpha: 0.22 });

  // Gangway bellows reaching the car in front
  if (opts.gangway) {
    g.rect(hl - 1, -hw + 3, 5, wid - 6).fill({ color: 0x3a3f44 }).stroke({ color: PAL.outline, width: 1 });
    g.moveTo(hl + 1.5, -hw + 3).lineTo(hl + 1.5, hw - 3).stroke({ color: 0x5a6068, width: 0.8 });
  }

  // Body outline (streamlined nose on the driving car)
  if (opts.head) {
    const noseStart = hl - 10;
    g.moveTo(-hl + 3, -hw)
      .lineTo(noseStart, -hw)
      .bezierCurveTo(hl - 3, -hw, hl, -hw + 3, hl, 0)
      .bezierCurveTo(hl, hw - 3, hl - 3, hw, noseStart, hw)
      .lineTo(-hl + 3, hw)
      .quadraticCurveTo(-hl, hw, -hl, hw - 3)
      .lineTo(-hl, -hw + 3)
      .quadraticCurveTo(-hl, -hw, -hl + 3, -hw)
      .closePath()
      .fill({ color })
      .stroke({ color: PAL.outline, width: 2 });
  } else {
    g.roundRect(-hl, -hw, len, wid, 3).fill({ color }).stroke({ color: PAL.outline, width: 2 });
  }

  // Roof panel (pale tint) — the livery colour stays visible along both sides
  const roofLen = opts.head ? len - 14 : len - 4;
  g.roundRect(-hl + 2, -hw + 2.6, roofLen, wid - 5.2, 2).fill({ color: roof });

  // Roof-mounted A/C units + a centre seam between them
  const units = opts.head ? [-hl + roofLen * 0.3, -hl + roofLen * 0.75] : [-len * 0.25, len * 0.25];
  g.moveTo(units[0], 0).lineTo(units[1], 0).stroke({ color: shade(roof, 0.8), width: 1 });
  for (const ux of units) {
    g.roundRect(ux - 4, -2.6, 8, 5.2, 1.5).fill({ color: ROOF_UNIT }).stroke({ color: shade(ROOF_UNIT, 0.65), width: 1 });
    g.rect(ux - 2.5, -1, 5, 2).fill({ color: shade(ROOF_UNIT, 0.8) });
  }

  if (opts.head) {
    // Wrap-around windscreen following the nose
    g.moveTo(hl - 10, -hw + 2)
      .bezierCurveTo(hl - 4, -hw + 2, hl - 1.6, -hw + 4, hl - 1.6, 0)
      .bezierCurveTo(hl - 1.6, hw - 4, hl - 4, hw - 2, hl - 10, hw - 2)
      .closePath()
      .fill({ color: GLASS });
    g.moveTo(hl - 8, -hw + 3.2).lineTo(hl - 4.5, -hw + 4.2).stroke({ color: GLASS_SHINE, width: 1, alpha: 0.8 });
    // LED headlights at the nose corners
    g.circle(hl - 1.8, -hw * 0.5, 1.3).fill({ color: 0xfffbe0 });
    g.circle(hl - 1.8, hw * 0.5, 1.3).fill({ color: 0xfffbe0 });
  }

  if (opts.tail) {
    g.rect(-hl + 0.4, -hw + 2.2, 1.6, 2.2).fill({ color: TAIL_RED });
    g.rect(-hl + 0.4, hw - 4.4, 1.6, 2.2).fill({ color: TAIL_RED });
  }
}

// ─── Side view ───────────────────────────────────────────────────────────────

export interface MetroSideOpts {
  /** Driving cab with a streamlined nose facing −x (left). */
  cab?: boolean;
  /** Wide-body car (three door pairs). */
  wide?: boolean;
}

/**
 * Metro car in side profile. Occupies x … x+W horizontally and baseY−H … baseY
 * vertically (bogies included; roof units poke ~4px above).
 */
export function drawMetroSide(g: Graphics, x: number, baseY: number, W: number, H: number, look: MetroLook, opts: MetroSideOpts = {}) {
  const topY = baseY - H;
  const bot = baseY - 7; // body bottom; bogies below
  const bodyH = bot - topY;
  const glass = look.glass ?? GLASS;
  const light = look.light ?? 0xfffbe0;
  const cab = !!opts.cab;

  // Roof A/C unit
  g.roundRect(x + W * 0.34, topY - 4, W * 0.36, 6, 2)
    .fill({ color: ROOF_UNIT }).stroke({ color: PAL.outline, width: 1.5 });

  // Bogies (frame + two wheels each)
  for (const bx of [x + W * 0.2, x + W * 0.8]) {
    g.roundRect(bx - 13, bot - 1, 26, 5, 1.5).fill({ color: UNDERFRAME }).stroke({ color: PAL.outline, width: 1 });
    for (const wx of [bx - 7, bx + 7]) {
      g.circle(wx, bot + 4, 3.6).fill({ color: WHEEL }).stroke({ color: PAL.outline, width: 1.2 });
      g.circle(wx, bot + 4, 1.2).fill({ color: 0x9aa0a6 });
    }
  }

  // Body shell
  if (cab) {
    g.moveTo(x + 16, topY)
      .lineTo(x + W - 6, topY)
      .quadraticCurveTo(x + W, topY, x + W, topY + 6)
      .lineTo(x + W, bot)
      .lineTo(x + 3, bot)
      .quadraticCurveTo(x, bot, x, bot - 3)
      .lineTo(x, topY + bodyH * 0.62)
      .bezierCurveTo(x, topY + bodyH * 0.28, x + 5, topY, x + 16, topY)
      .closePath()
      .fill({ color: look.body })
      .stroke({ color: PAL.outline, width: 2.5 });
  } else {
    g.roundRect(x, topY, W, bodyH, 6).fill({ color: look.body }).stroke({ color: PAL.outline, width: 2.5 });
  }
  // Roof highlight
  g.rect(x + (cab ? 16 : 4), topY + 2, W - (cab ? 22 : 8), 2).fill({ color: shade(look.body, 1.25), alpha: 0.8 });

  // Doors (double sliding plug doors)
  const doorW = opts.wide ? 12 : 13;
  const doorXs = cab
    ? [x + W * 0.5, x + W * 0.82]
    : opts.wide ? [x + W * 0.2, x + W * 0.5, x + W * 0.8] : [x + W * 0.26, x + W * 0.74];

  // Continuous dark window band, broken only by the doors
  const winTop = topY + 7;
  const winH = Math.round(bodyH * 0.38);
  const bandStart = cab ? x + 24 : x + 4;
  const bandEnd = x + W - 4;
  const cuts = doorXs.map(dx => [dx - doorW / 2 - 1.5, dx + doorW / 2 + 1.5]).sort((a, b) => a[0] - b[0]);
  let cursor = bandStart;
  const spans: [number, number][] = [];
  for (const [a, b] of cuts) {
    if (a > cursor) spans.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (bandEnd > cursor) spans.push([cursor, bandEnd]);
  for (const [a, b] of spans) {
    if (b - a < 3) continue;
    g.roundRect(a, winTop, b - a, winH, 2).fill({ color: glass });
    // Thin window pillars
    for (let px = a + 13; px < b - 5; px += 13) {
      g.rect(px, winTop, 1.6, winH).fill({ color: shade(look.body, 0.85) });
    }
    g.rect(a + 2, winTop + 2, Math.min(8, b - a - 4), 1.4).fill({ color: GLASS_SHINE, alpha: 0.35 });
  }

  // Livery: bold stripe under the windows + thin accent line
  const stripeY = winTop + winH + 3;
  const stripeX = cab ? x + 3 : x + 1.5;
  g.rect(stripeX, stripeY, x + W - 1.5 - stripeX, 4).fill({ color: look.livery });
  g.rect(stripeX, stripeY + 5.5, x + W - 1.5 - stripeX, 1.4).fill({ color: look.accent, alpha: 0.9 });

  // Skirt
  g.rect(x + (cab ? 3 : 1.5), bot - 4, W - (cab ? 4.5 : 3), 3).fill({ color: shade(look.body, 0.72) });

  // Doors on top of band + livery
  for (const dx of doorXs) {
    const dTop = topY + 4;
    const dH = bot - 4 - dTop;
    g.rect(dx - doorW / 2, dTop, doorW, dH).fill({ color: shade(look.body, 0.94) }).stroke({ color: PAL.outline, width: 1.2 });
    g.moveTo(dx, dTop).lineTo(dx, dTop + dH).stroke({ color: PAL.outline, width: 1 });
    const dwW = doorW / 2 - 3;
    g.roundRect(dx - doorW / 2 + 1.5, winTop, dwW, winH + 2, 1.5).fill({ color: glass });
    g.roundRect(dx + 1.5, winTop, dwW, winH + 2, 1.5).fill({ color: glass });
    // Door-open indicator light
    g.rect(dx - 2, dTop - 3, 4, 2).fill({ color: look.livery }).stroke({ color: PAL.outline, width: 0.8 });
  }

  if (cab) {
    // Wrap-around windscreen following the nose
    g.moveTo(x + 16, topY + 4)
      .lineTo(x + 21, topY + 4)
      .lineTo(x + 21, winTop + winH + 1)
      .lineTo(x + 1.5, winTop + winH + 3)
      .bezierCurveTo(x + 1.5, topY + bodyH * 0.3, x + 6, topY + 4, x + 16, topY + 4)
      .closePath()
      .fill({ color: glass })
      .stroke({ color: PAL.outline, width: 1.2 });
    g.moveTo(x + 8, topY + 8).lineTo(x + 5, topY + 14).stroke({ color: GLASS_SHINE, width: 1.4, alpha: 0.7 });
    // LED destination display above the side windows
    g.roundRect(x + 24, topY + 1.5, 18, 4.5, 1).fill({ color: 0x0b0b0b });
    for (let i = 0; i < 5; i++) g.rect(x + 25.5 + i * 3.2, topY + 3, 2.2, 1.5).fill({ color: LED_ORANGE });
    // Slim LED headlight strip on the nose
    g.roundRect(x + 1, bot - 13, 7, 2.6, 1.3).fill({ color: light }).stroke({ color: PAL.outline, width: 0.8 });
    // Coupler
    g.roundRect(x - 4, bot - 5, 6, 4, 1).fill({ color: 0x555555 }).stroke({ color: PAL.outline, width: 1 });
  } else {
    // Gangway bellows at both ends
    g.rect(x - 2, topY + 6, 2.5, bodyH - 12).fill({ color: 0x3a3f44 });
    g.rect(x + W - 0.5, topY + 6, 2.5, bodyH - 12).fill({ color: 0x3a3f44 });
  }
}

// ─── Front / rear faces ─────────────────────────────────────────────────────

function faceShell(g: Graphics, cx: number, topY: number, bot: number, W: number, color: number) {
  const hw = W / 2;
  const H = bot - topY;
  g.moveTo(cx - hw + 4, bot)
    .lineTo(cx - hw, topY + H * 0.45)
    .quadraticCurveTo(cx - hw + 2, topY, cx - hw + 16, topY)
    .lineTo(cx + hw - 16, topY)
    .quadraticCurveTo(cx + hw - 2, topY, cx + hw, topY + H * 0.45)
    .lineTo(cx + hw - 4, bot)
    .closePath()
    .fill({ color })
    .stroke({ color: PAL.outline, width: 2.5 });
}

function faceUnderframe(g: Graphics, cx: number, bot: number, W: number) {
  const hw = W / 2;
  // Anti-climber bumper
  g.rect(cx - hw + 7, bot - 8, W - 14, 5).fill({ color: UNDERFRAME }).stroke({ color: PAL.outline, width: 1 });
  // Coupler
  g.roundRect(cx - 7, bot - 4, 14, 6, 2).fill({ color: 0x555555 }).stroke({ color: PAL.outline, width: 1 });
  // Skirt
  g.poly([cx - hw + 8, bot, cx + hw - 8, bot, cx + hw - 14, bot + 5, cx - hw + 14, bot + 5])
    .fill({ color: UNDERFRAME }).stroke({ color: PAL.outline, width: 1.2 });
  // Rails
  g.rect(cx - hw * 0.62 - 2, bot + 5, 5, 3).fill({ color: 0x6d6d6d });
  g.rect(cx + hw * 0.62 - 3, bot + 5, 5, 3).fill({ color: 0x6d6d6d });
}

/** Driving-cab front face, centred at cx, bottom at baseY. */
export function drawMetroFront(g: Graphics, cx: number, baseY: number, W: number, H: number, look: MetroLook) {
  const bot = baseY - 5;
  const topY = baseY - H;
  const fh = bot - topY;
  const hw = W / 2;
  const glass = look.glass ?? GLASS;
  const light = look.light ?? 0xfffbe0;

  faceShell(g, cx, topY, bot, W, look.body);

  // Big wrap-around windscreen
  const wTop = topY + 6;
  const wBot = topY + fh * 0.54;
  g.moveTo(cx - hw + 7, wBot)
    .lineTo(cx - hw + 5, topY + fh * 0.3)
    .quadraticCurveTo(cx - hw + 7, wTop, cx - hw + 17, wTop)
    .lineTo(cx + hw - 17, wTop)
    .quadraticCurveTo(cx + hw - 7, wTop, cx + hw - 5, topY + fh * 0.3)
    .lineTo(cx + hw - 7, wBot)
    .closePath()
    .fill({ color: glass })
    .stroke({ color: PAL.outline, width: 1.5 });
  // Reflection
  g.poly([cx - hw + 14, wBot - 3, cx - hw + 26, wTop + 12, cx - hw + 32, wTop + 12, cx - hw + 20, wBot - 3])
    .fill({ color: GLASS_SHINE, alpha: 0.18 });

  // LED destination display
  g.roundRect(cx - 22, wTop + 3, 44, 8, 1.5).fill({ color: 0x0b0b0b }).stroke({ color: 0x333333, width: 0.8 });
  for (let i = 0; i < 9; i++) g.rect(cx - 19 + i * 4.3, wTop + 5.5, 3, 3).fill({ color: LED_ORANGE });

  // Central emergency-evacuation door outline
  g.roundRect(cx - 10, wTop + 14, 20, bot - 10 - (wTop + 14), 2).stroke({ color: PAL.outline, width: 1, alpha: 0.55 });

  // Livery sweep under the windscreen
  g.poly([
    cx - hw + 3.5, wBot + 3, cx + hw - 3.5, wBot + 3,
    cx + hw - 3, wBot + 9, cx - hw + 3, wBot + 9,
  ]).fill({ color: look.livery });
  g.rect(cx - hw + 4, wBot + 10.5, W - 8, 1.6).fill({ color: look.accent, alpha: 0.9 });

  // Slim LED headlights + tail lights
  const ly = wBot + 16;
  for (const side of [-1, 1]) {
    const lx = side < 0 ? cx - hw + 8 : cx + hw - 26;
    g.roundRect(lx, ly, 18, 4, 2).fill({ color: light }).stroke({ color: PAL.outline, width: 1 });
    g.roundRect(side < 0 ? lx + 2 : lx + 8, ly + 6, 8, 2.6, 1.3).fill({ color: TAIL_RED });
  }

  faceUnderframe(g, cx, bot, W);
}

/** Rear end face of a driving car (gangway door + tail lights). */
export function drawMetroRear(g: Graphics, cx: number, baseY: number, W: number, H: number, look: MetroLook) {
  const bot = baseY - 5;
  const topY = baseY - H;
  const fh = bot - topY;
  const hw = W / 2;
  const glass = look.glass ?? GLASS;

  faceShell(g, cx, topY, bot, W, shade(look.body, 0.9));

  // Gangway door with window
  g.roundRect(cx - 13, topY + 8, 26, bot - 10 - (topY + 8), 3).fill({ color: shade(look.body, 0.78) }).stroke({ color: PAL.outline, width: 1.2 });
  g.roundRect(cx - 8, topY + 13, 16, fh * 0.3, 2).fill({ color: glass });
  // Side windows
  g.roundRect(cx - hw + 7, topY + 12, 14, fh * 0.28, 2).fill({ color: glass });
  g.roundRect(cx + hw - 21, topY + 12, 14, fh * 0.28, 2).fill({ color: glass });

  // Livery
  const sy = topY + fh * 0.5;
  g.rect(cx - hw + 2.5, sy, hw - 16, 5).fill({ color: look.livery });
  g.rect(cx + 13.5, sy, hw - 16, 5).fill({ color: look.livery });

  // Tail lights
  g.roundRect(cx - hw + 8, sy + 10, 12, 4, 2).fill({ color: TAIL_RED }).stroke({ color: PAL.outline, width: 1 });
  g.roundRect(cx + hw - 20, sy + 10, 12, 4, 2).fill({ color: TAIL_RED }).stroke({ color: PAL.outline, width: 1 });

  faceUnderframe(g, cx, bot, W);
}
