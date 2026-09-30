import { Container, Graphics, Text } from 'pixi.js';
import { useTrainStore } from '../stores/trainStore';
import { useUIStore } from '../stores/uiStore';
import type { TrainHead, Carriage, TrainStyle } from '../types';
import type { PixiApp } from './PixiApp';
import { drawMetroFront, drawMetroRear, drawMetroSide, mixColor } from './MetroArt';
import type { MetroLook } from './MetroArt';
import { PAL, LABEL_FONT, drawSky, drawCloud, drawHill, drawBush, drawGroundStrip, drawQuestionBlock, drawBrickBlock, drawPipeSide } from './MarioArt';

// ─── Color utilities ──────────────────────────────────────────────────────────

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// ─── Per-city head color themes ──────────────────────────────────────────────

const HEAD_THEMES: Record<string, { body: string; accent: string; windshield: number; lightColor: number }> = {
  'tokyo':   { body: '#e8e8e8', accent: '#e74c3c', windshield: 0x2c3e50, lightColor: 0xffeaa7 },
  'beijing': { body: '#5dade2', accent: '#ecf0f1', windshield: 0x12202e, lightColor: 0xf9e79f },
  'london':  { body: '#c0392b', accent: '#f1c40f', windshield: 0x1a1a2e, lightColor: 0xffd93d },
  'newyork': { body: '#7f8c8d', accent: '#f39c12', windshield: 0x1e272e, lightColor: 0xffeaa7 },
  'neo':     { body: '#2d3436', accent: '#00cec9', windshield: 0x0a1628, lightColor: 0x00cec9 },
  'quantum': { body: '#6c5ce7', accent: '#fd79a8', windshield: 0x0a0a1e, lightColor: 0xa29bfe },
};

function getHeadTheme(head: TrainHead) {
  return HEAD_THEMES[head.city] ?? { body: '#0984e3', accent: '#ffd93d', windshield: 0x1e272e, lightColor: 0xffd93d };
}

/** Map a city head theme onto the modern-metro livery. */
function lookFromTheme(theme: ReturnType<typeof getHeadTheme>): MetroLook {
  const livery = hexToNumber(theme.accent);
  return {
    body: hexToNumber(theme.body),
    livery,
    accent: mixColor(livery, 0xffffff, 0.5),
    glass: theme.windshield,
    light: theme.lightColor,
  };
}

const VIEW_ANGLES = [
  { angle: 0,   label: 'Front View' },
  { angle: 72,  label: 'Front 3/4'  },
  { angle: 144, label: 'Right Side' },
  { angle: 216, label: 'Rear 3/4'  },
  { angle: 288, label: 'Left Side'  },
];

// ─── Phase 2 (side-view) constants ────────────────────────────────────────────

const SIDE_HEAD_W = 80;
const SIDE_CAR_W  = 80;
const SIDE_STD_H  = 50;
const SIDE_WIDE_H = 58;
const SIDE_GAP    = 4;
const MAX_CARRIAGES = 7;

// ─── Click region type ────────────────────────────────────────────────────────

interface CarriageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'carriage' | 'empty';
  index: number;
}

// ─── AssemblyRenderer ─────────────────────────────────────────────────────────

export class AssemblyRenderer {
  private pixiApp: PixiApp;
  private scene!: Container;
  private platformGraphics!: Graphics;
  private backdrop!: Graphics;
  private backdropKey = '';
  private trainContainer!: Container;
  private angleLabelText!: Text;

  // Phase 1 rotation state
  private currentAngle = 0;
  private autoRotate = true;
  private isDragging = false;
  private lastDragX = 0;
  private dragIdleTimer: ReturnType<typeof setTimeout> | null = null;

  // Phase 2 click regions
  private carriageRegions: CarriageRegion[] = [];

  private unsubscribeTrain: (() => void) | null = null;
  private unsubscribeUI: (() => void) | null = null;

  constructor(pixiApp: PixiApp) {
    this.pixiApp = pixiApp;
  }

  init() {
    const app = this.pixiApp.app;
    app.renderer.background.color = PAL.sky;

    this.scene = new Container();
    app.stage.addChild(this.scene);

    this.backdrop = new Graphics();
    this.scene.addChild(this.backdrop);

    this.platformGraphics = new Graphics();
    this.scene.addChild(this.platformGraphics);

    this.trainContainer = new Container();
    this.scene.addChild(this.trainContainer);

    this.angleLabelText = new Text({
      text: 'Front View',
      style: { fontFamily: LABEL_FONT, fontSize: 16, fill: '#ffffff', fontWeight: '700', stroke: { color: PAL.outline, width: 3 } },
    });
    this.scene.addChild(this.angleLabelText);

    requestAnimationFrame(() => {
      if (this.scene.destroyed) return;
      this.render();
    });

    this.unsubscribeTrain = useTrainStore.subscribe(() => { this.render(); });
    this.unsubscribeUI    = useUIStore.subscribe(() => { this.render(); });

    const canvas = app.canvas as HTMLCanvasElement;
    canvas.addEventListener('mousedown',  this.onMouseDown);
    canvas.addEventListener('mousemove',  this.onMouseMove);
    canvas.addEventListener('mouseup',    this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseUp);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchmove',  this.onTouchMove,  { passive: true });
    canvas.addEventListener('touchend',   this.onMouseUp);
    canvas.addEventListener('click',      this.onClick);

    app.ticker.add(this.onTick);
  }

  // ─── Main render dispatcher ─────────────────────────────────────────────────

  private render() {
    const phase = useUIStore.getState().assemblyPhase;
    if (phase === 'head-selection') {
      this.renderPhase1();
    } else {
      this.renderPhase2();
    }
  }

  // ─── Phase 1: turntable + multi-angle head ──────────────────────────────────

  private lastRenderedView = '';

  private renderPhase1() {
    this.platformGraphics.visible = true;
    this.angleLabelText.visible   = true;

    this.drawPlatform();

    const app = this.pixiApp.app;
    const platformCX = app.screen.width  / 2;
    const platformCY = app.screen.height * 0.65;

    this.trainContainer.x = platformCX;
    this.trainContainer.y = 0;
    this.trainContainer.scale.x = 1;

    const trains = useTrainStore.getState().trains;
    const activeTrainIndex = useUIStore.getState().activeTrainIndex;
    const train = trains[activeTrainIndex];
    if (!train) {
      this.clearTrainContainer();
      const text = new Text({
        text: 'Pick a head from the left to start!',
        style: { fontFamily: LABEL_FONT, fontSize: 16, fill: '#fff1c8', fontWeight: '700', stroke: { color: PAL.outline, width: 3 } },
      });
      text.anchor.set(0.5, 0.5);
      text.x = 0;
      text.y = platformCY - 55;
      this.trainContainer.addChild(text);
      this.lastRenderedView = '';
      this.updateAngleLabel();
      return;
    }

    const viewLabel = this.getViewLabel();

    // Only redraw if the view, head, or active train changed
    const viewKey = `${activeTrainIndex}:${viewLabel}:${train.head.type}`;
    if (viewKey === this.lastRenderedView) {
      this.updateAngleLabel();
      return;
    }
    this.lastRenderedView = viewKey;

    this.clearTrainContainer();
    const theme = getHeadTheme(train.head);
    const baseY = platformCY - 8;

    switch (viewLabel) {
      case 'Front View':
        this.drawHeadFront(0, baseY, train.head, theme);
        break;
      case 'Front 3/4':
        this.drawHead34(0, baseY, train.head, theme, false);
        break;
      case 'Right Side':
        this.drawHeadSide(0, baseY, train.head, theme, false);
        break;
      case 'Rear 3/4':
        this.drawHead34(0, baseY, train.head, theme, true);
        break;
      case 'Left Side':
        this.drawHeadSide(0, baseY, train.head, theme, true);
        break;
    }

    this.updateAngleLabel();
  }

  // ── Front view (symmetrical, facing player) ────────────────────────────────

  private drawHeadFront(cx: number, baseY: number, head: TrainHead, theme: ReturnType<typeof getHeadTheme>) {
    const g = new Graphics();
    drawMetroFront(g, cx, baseY, 92, 86, lookFromTheme(theme));
    this.trainContainer.addChild(g);
    this.addHeadLabels(cx, baseY, head);
  }

  // ── Side view (flat profile) ───────────────────────────────────────────────

  private drawHeadSide(cx: number, baseY: number, head: TrainHead, theme: ReturnType<typeof getHeadTheme>, mirrored: boolean) {
    const W = 150, H = 62;
    const ct = new Container();
    const g = new Graphics();
    // Rail under the car
    g.rect(cx - W / 2 - 18, baseY + 1, W + 36, 3).fill({ color: 0x6d6d6d }).stroke({ color: PAL.outline, width: 1 });
    drawMetroSide(g, cx - W / 2, baseY, W, H, lookFromTheme(theme), { cab: true });
    ct.addChild(g);
    if (mirrored) {
      // Mirror around the car centre so the nose points right
      ct.pivot.x = cx;
      ct.x = cx;
      ct.scale.x = -1;
    }
    this.trainContainer.addChild(ct);
    this.addHeadLabels(cx, baseY + 8, head);
  }

  // ── 3/4 views: end face + receding side ────────────────────────────────────

  private drawHead34(cx: number, baseY: number, head: TrainHead, theme: ReturnType<typeof getHeadTheme>, rear: boolean) {
    const look = lookFromTheme(theme);
    const faceW = 70, faceH = 70;
    const sideW = 150, sideH = 62;
    const sideScale = 0.72;
    const total = faceW + sideW * sideScale;
    const left = cx - total / 2;

    // Receding side body (drawn first so the end face overlaps its seam)
    const sideCt = new Container();
    const sg = new Graphics();
    drawMetroSide(sg, 0, 0, sideW, sideH, look, { cab: false });
    sideCt.addChild(sg);
    sideCt.x = left + faceW - 6;
    sideCt.y = baseY - 2;
    sideCt.scale.set(sideScale, 0.94);
    sideCt.skew.y = -0.2;
    this.trainContainer.addChild(sideCt);

    const fg = new Graphics();
    if (rear) drawMetroRear(fg, left + faceW / 2, baseY, faceW, faceH, look);
    else drawMetroFront(fg, left + faceW / 2, baseY, faceW, faceH, look);
    this.trainContainer.addChild(fg);

    this.addHeadLabels(cx, baseY + 4, head);
  }

  // ── Shared label helper ────────────────────────────────────────────────────

  private addHeadLabels(cx: number, baseY: number, head: TrainHead) {
    const label = new Text({
      text: head.city.charAt(0).toUpperCase() + head.city.slice(1),
      style: { fontFamily: LABEL_FONT, fontSize: 13, fill: '#ffffff', fontWeight: '700', stroke: { color: PAL.outline, width: 3 } },
    });
    label.anchor.set(0.5, 0);
    label.x = cx;
    label.y = baseY + 8;
    this.trainContainer.addChild(label);

    const eraLabel = new Text({
      text: head.era.toUpperCase(),
      style: { fontFamily: LABEL_FONT, fontSize: 10, fill: '#fff1c8', fontWeight: '700', stroke: { color: PAL.outline, width: 3 } },
    });
    eraLabel.anchor.set(0.5, 0);
    eraLabel.x = cx;
    eraLabel.y = baseY + 22;
    this.trainContainer.addChild(eraLabel);
  }

  // ─── Platform drawing (Phase 1) ─────────────────────────────────────────────

  private drawPlatform() {
    const app = this.pixiApp.app;
    const cx = app.screen.width  / 2;
    const cy = app.screen.height * 0.65;
    const rx = 230;
    const ry = 46;

    this.drawBackdrop(Math.round(cy + ry * 0.2));

    const g = this.platformGraphics;
    g.clear();

    // Turntable = a giant red-and-white mushroom-cap disc
    g.ellipse(cx, cy + 14, rx + 4, ry + 4).fill({ color: PAL.outline });
    g.ellipse(cx, cy + 10, rx, ry).fill({ color: PAL.redDark });
    g.ellipse(cx, cy, rx + 4, ry + 4).fill({ color: PAL.outline });
    g.ellipse(cx, cy, rx, ry).fill({ color: PAL.red });
    for (const [ox, oy, sr] of [[-0.6, -0.1, 0.13], [0.55, 0.05, 0.15], [0, -0.45, 0.11], [-0.2, 0.45, 0.1], [0.3, -0.5, 0.08]]) {
      g.ellipse(cx + ox * rx, cy + oy * ry, rx * sr, ry * sr * 1.3).fill({ color: PAL.white });
    }
    g.ellipse(cx - rx * 0.35, cy - ry * 0.55, rx * 0.25, ry * 0.12).fill({ color: 0xff8a7a, alpha: 0.7 });

    const irx  = rx * 0.72;
    const iry  = ry * 0.72;
    const SEGS = 20;
    for (let i = 0; i < SEGS; i++) {
      if (i % 2 === 0) {
        const a1 = (i / SEGS) * Math.PI * 2;
        const a2 = ((i + 0.75) / SEGS) * Math.PI * 2;
        const x1 = cx + irx * Math.cos(a1);
        const y1 = cy + iry * Math.sin(a1);
        const x2 = cx + irx * Math.cos(a2);
        const y2 = cy + iry * Math.sin(a2);
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: PAL.white, width: 2, alpha: 0.35 });
      }
    }

    this.positionAngleLabel();
  }

  // ─── Phase 2: 2D side view ──────────────────────────────────────────────────

  private renderPhase2() {
    this.platformGraphics.visible = false;
    this.angleLabelText.visible   = false;

    this.clearTrainContainer();

    // No rotation, no platform offset — container sits at origin
    this.trainContainer.x       = 0;
    this.trainContainer.y       = 0;
    this.trainContainer.scale.x = 1;

    const app = this.pixiApp.app;
    const W   = app.screen.width;
    const H   = app.screen.height;

    const trains = useTrainStore.getState().trains;
    const activeTrainIndex = useUIStore.getState().activeTrainIndex;
    const train = trains[activeTrainIndex];
    if (!train) {
      this.drawBackdrop(Math.round(H / 2 + SIDE_STD_H / 2) + 12);
      return;
    }
    const selectedIdx = useUIStore.getState().selectedCarriageIndex;

    const numFilled = train.carriages.length;
    const numEmpty  = MAX_CARRIAGES - numFilled;

    // Total pixel width: head + filled carriages + empty slots
    const totalW = SIDE_HEAD_W + (numFilled + numEmpty) * (SIDE_CAR_W + SIDE_GAP);
    const startX = Math.round((W - totalW) / 2);
    // Bottom edge of all cars (widebody will extend upward more)
    const baseY  = Math.round(H / 2 + SIDE_STD_H / 2);
    this.drawBackdrop(baseY + 12);

    this.carriageRegions = [];
    let x = startX;

    // Head car
    this.drawSideHead(x, baseY, train.head);
    x += SIDE_HEAD_W + SIDE_GAP;

    // Filled carriages
    for (let i = 0; i < numFilled; i++) {
      const c     = train.carriages[i];
      const carH  = c.type === 'widebody' ? SIDE_WIDE_H : SIDE_STD_H;
      const isSel = i === selectedIdx;
      this.drawSideCarriage(x, baseY, c, isSel);
      this.carriageRegions.push({ x, y: baseY - carH, w: SIDE_CAR_W, h: carH, type: 'carriage', index: i });
      x += SIDE_CAR_W + SIDE_GAP;
    }

    // Empty slots
    for (let i = 0; i < numEmpty; i++) {
      this.drawSideEmptySlot(x, baseY);
      this.carriageRegions.push({
        x, y: baseY - SIDE_STD_H, w: SIDE_CAR_W, h: SIDE_STD_H,
        type: 'empty', index: numFilled + i,
      });
      x += SIDE_CAR_W + SIDE_GAP;
    }
  }

  // ─── Side-view: head car ────────────────────────────────────────────────────

  private drawSideHead(x: number, baseY: number, head: TrainHead) {
    const g = new Graphics();
    drawMetroSide(g, x, baseY, SIDE_HEAD_W, SIDE_STD_H, lookFromTheme(getHeadTheme(head)), { cab: true });
    this.trainContainer.addChild(g);
  }

  // ─── Side-view: filled carriage ─────────────────────────────────────────────

  private drawSideCarriage(x: number, baseY: number, carriage: Carriage, isSelected: boolean) {
    const W      = SIDE_CAR_W;
    const H      = carriage.type === 'widebody' ? SIDE_WIDE_H : SIDE_STD_H;
    const topY   = baseY - H;
    const cStyle = carriage.style;
    const livery = hexToNumber(cStyle.accentColor);
    const look: MetroLook = {
      body: hexToNumber(cStyle.bodyColor),
      livery,
      accent: mixColor(livery, 0xffffff, 0.5),
    };

    const ct = new Container();
    const g  = new Graphics();

    drawMetroSide(g, x, baseY, W, H, look, { wide: carriage.type === 'widebody' });
    // Optional pattern overlay on the lower body
    this.applySidePattern(g, x + 2, baseY - 7 - Math.round(H * 0.42), W - 4, Math.round(H * 0.42) - 11, cStyle);

    // Selection glow
    if (isSelected) {
      g.roundRect(x - 4, topY - 7, W + 8, H + 10, 7)
       .stroke({ color: PAL.coin, width: 3, alpha: 0.95 });
      g.roundRect(x - 4, topY - 7, W + 8, H + 10, 7)
       .stroke({ color: PAL.outline, width: 1, alpha: 0.6 });
    }

    ct.addChild(g);

    // XL badge for widebody
    if (carriage.type === 'widebody') {
      const xlLabel = new Text({
        text: 'XL',
        style: { fontFamily: LABEL_FONT, fontSize: 11, fill: '#ffffff', fontWeight: '700', stroke: { color: PAL.outline, width: 3 } },
      });
      xlLabel.anchor.set(0.5, 1);
      xlLabel.x = x + W / 2;
      xlLabel.y = topY - 6;
      ct.addChild(xlLabel);
    }

    this.trainContainer.addChild(ct);
  }

  // ─── Side-view: empty slot ──────────────────────────────────────────────────

  private drawSideEmptySlot(x: number, baseY: number) {
    const W    = SIDE_CAR_W;
    const H    = SIDE_STD_H;
    const topY = baseY - H;

    const g = new Graphics();
    g.roundRect(x, topY, W, H, 6).fill({ color: PAL.white, alpha: 0.28 });
    g.roundRect(x, topY, W, H, 6).stroke({ color: PAL.outline, width: 2.5, alpha: 0.55 });
    this.trainContainer.addChild(g);

    const plus = new Text({
      text: '+',
      style: { fontFamily: '"Press Start 2P", monospace', fontSize: 20, fill: PAL.white, stroke: { color: PAL.outline, width: 4 } },
    });
    plus.anchor.set(0.5, 0.5);
    plus.alpha = 0.9;
    plus.x = x + W / 2;
    plus.y = topY + H / 2;
    this.trainContainer.addChild(plus);
  }

  // ─── Side-view pattern overlay ──────────────────────────────────────────────

  private applySidePattern(g: Graphics, x: number, topY: number, W: number, H: number, style: TrainStyle) {
    const accentN = hexToNumber(style.accentColor);
    switch (style.pattern) {
      case 'stripe':
        for (let dy = 8; dy < H - 4; dy += 12) {
          g.rect(x + 2, topY + dy, W - 4, 3).fill({ color: accentN, alpha: 0.3 });
        }
        break;
      case 'gradient':
        for (let dy = 0; dy < H; dy += 4) {
          const a = 0.25 * (1 - dy / H);
          g.rect(x, topY + dy, W, 4).fill({ color: accentN, alpha: a });
        }
        break;
      case 'tech':
        g.moveTo(x + 4, topY + 8).lineTo(x + W - 4, topY + 8)
         .stroke({ color: 0x00cec9, width: 1, alpha: 0.7 });
        g.moveTo(x + 4, topY + 18).lineTo(x + W - 4, topY + 18)
         .stroke({ color: 0x00cec9, width: 1, alpha: 0.5 });
        break;
      default:
        break;
    }
  }

  // ─── Angle label helpers (Phase 1) ─────────────────────────────────────────

  private getViewLabel(): string {
    const angle = ((this.currentAngle % 360) + 360) % 360;
    let best    = VIEW_ANGLES[0];
    let minDiff = Infinity;
    for (const v of VIEW_ANGLES) {
      const diff    = Math.abs(angle - v.angle);
      const wrapped = Math.min(diff, 360 - diff);
      if (wrapped < minDiff) { minDiff = wrapped; best = v; }
    }
    return best.label;
  }

  private updateAngleLabel() {
    this.angleLabelText.text = this.getViewLabel();
    this.positionAngleLabel();
  }

  /** Sunny side-scroller backdrop: sky, clouds, hills, bushes, blocks and ground. Cached per size. */
  private drawBackdrop(groundY: number) {
    const app = this.pixiApp.app;
    const W = app.screen.width;
    const H = app.screen.height;
    const key = `${W}x${H}@${groundY}`;
    if (key === this.backdropKey) return;
    this.backdropKey = key;

    const g = this.backdrop;
    g.clear();
    drawSky(g, 0, 0, W, groundY);

    // Clouds
    const clouds: [number, number, number][] = [[0.12, 0.14, 1.1], [0.42, 0.08, 0.8], [0.7, 0.18, 1.2], [0.92, 0.1, 0.9]];
    for (const [fx, fy, sc] of clouds) drawCloud(g, fx * W, fy * H + 30, sc);

    // Floating blocks row (upper left) and a pipe (right), classic level dressing
    const bs = 28;
    const by = Math.max(70, groundY - 190);
    const bx = W * 0.14;
    drawBrickBlock(g, bx, by, bs);
    drawQuestionBlock(g, bx + bs, by, bs);
    drawBrickBlock(g, bx + bs * 2, by, bs);
    drawQuestionBlock(g, bx + bs * 3, by, bs);
    drawBrickBlock(g, bx + bs * 4, by, bs);
    drawQuestionBlock(g, W * 0.8, by - 40, bs);

    // Hills + bushes on the horizon
    drawHill(g, W * 0.1, groundY - 6, 240, 110);
    drawHill(g, W * 0.3, groundY - 6, 140, 60, 0x4cbf4c);
    drawHill(g, W * 0.78, groundY - 6, 200, 90, 0x4cbf4c);
    for (const fx of [0.22, 0.55, 0.66, 0.9]) {
      drawBush(g, W * fx - 10, groundY - 14, 1.3);
      drawBush(g, W * fx + 14, groundY - 14, 1.3);
    }
    drawPipeSide(g, W - 110, groundY - 4, 64, 96);

    drawGroundStrip(g, 0, groundY, W, H - groundY + 40);
  }

  private positionAngleLabel() {
    const app = this.pixiApp.app;
    const cx  = app.screen.width  / 2;
    const cy  = app.screen.height * 0.65;
    this.angleLabelText.anchor.set(0.5, 0);
    this.angleLabelText.x = cx;
    this.angleLabelText.y = cy + 46 + 14;
  }

  // ─── Phase 1 rotation ──────────────────────────────────────────────────────

  private onTick = () => {
    if (useUIStore.getState().assemblyPhase !== 'head-selection') return;
    if (this.autoRotate && !this.isDragging) {
      this.currentAngle = (this.currentAngle + 0.8) % 360;
      this.applyRotation();
    }
  };

  private applyRotation() {
    // Re-render the head from the new angle (renderPhase1 checks which view to show)
    this.renderPhase1();
  }

  // ─── Input handlers ────────────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent) => {
    if (useUIStore.getState().assemblyPhase !== 'head-selection') return;
    this.isDragging   = true;
    this.lastDragX    = e.clientX;
    this.autoRotate   = false;
    if (this.dragIdleTimer) clearTimeout(this.dragIdleTimer);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    if (useUIStore.getState().assemblyPhase !== 'head-selection') return;
    const dx = e.clientX - this.lastDragX;
    this.lastDragX    = e.clientX;
    this.currentAngle = (this.currentAngle + dx * 0.5 + 360) % 360;
    this.applyRotation();
  };

  private onMouseUp = () => {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.dragIdleTimer) clearTimeout(this.dragIdleTimer);
    this.dragIdleTimer = setTimeout(() => { this.autoRotate = true; }, 3000);
  };

  private onTouchStart = (e: TouchEvent) => {
    if (useUIStore.getState().assemblyPhase !== 'head-selection') return;
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastDragX  = e.touches[0].clientX;
      this.autoRotate = false;
      if (this.dragIdleTimer) clearTimeout(this.dragIdleTimer);
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.isDragging || !e.touches.length) return;
    if (useUIStore.getState().assemblyPhase !== 'head-selection') return;
    const dx = e.touches[0].clientX - this.lastDragX;
    this.lastDragX    = e.touches[0].clientX;
    this.currentAngle = (this.currentAngle + dx * 0.5 + 360) % 360;
    this.applyRotation();
  };

  private onClick = (e: MouseEvent) => {
    if (useUIStore.getState().assemblyPhase !== 'carriage-building') return;

    const app    = this.pixiApp.app;
    const canvas = app.canvas as HTMLCanvasElement;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = app.screen.width  / rect.width;
    const scaleY = app.screen.height / rect.height;
    const px     = (e.clientX - rect.left) * scaleX;
    const py     = (e.clientY - rect.top)  * scaleY;

    const trains = useTrainStore.getState().trains;
    if (!trains.length) return;
    const activeTrainIndex = useUIStore.getState().activeTrainIndex;
    const activeTrain = trains[activeTrainIndex];
    if (!activeTrain) return;
    const trainId = activeTrain.id;

    for (const region of this.carriageRegions) {
      if (px >= region.x && px <= region.x + region.w &&
          py >= region.y && py <= region.y + region.h) {
        if (region.type === 'empty') {
          useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'generic' });
        } else {
          useUIStore.getState().selectCarriage(region.index);
        }
        return;
      }
    }
    // Clicked outside all carriages — deselect
    useUIStore.getState().selectCarriage(null);
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private clearTrainContainer() {
    const removed = this.trainContainer.removeChildren();
    for (const child of removed) {
      child.destroy({ children: true });
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  destroy() {
    if (this.unsubscribeTrain) { this.unsubscribeTrain(); this.unsubscribeTrain = null; }
    if (this.unsubscribeUI)    { this.unsubscribeUI();    this.unsubscribeUI    = null; }

    const app    = this.pixiApp.app;
    const canvas = app.canvas as HTMLCanvasElement;

    app.ticker.remove(this.onTick);

    canvas.removeEventListener('mousedown',  this.onMouseDown);
    canvas.removeEventListener('mousemove',  this.onMouseMove);
    canvas.removeEventListener('mouseup',    this.onMouseUp);
    canvas.removeEventListener('mouseleave', this.onMouseUp);
    canvas.removeEventListener('touchstart', this.onTouchStart);
    canvas.removeEventListener('touchmove',  this.onTouchMove);
    canvas.removeEventListener('touchend',   this.onMouseUp);
    canvas.removeEventListener('click',      this.onClick);

    if (this.dragIdleTimer) {
      clearTimeout(this.dragIdleTimer);
      this.dragIdleTimer = null;
    }

    if (this.scene) {
      app.stage.removeChild(this.scene);
      this.scene.destroy({ children: true });
    }
  }
}
