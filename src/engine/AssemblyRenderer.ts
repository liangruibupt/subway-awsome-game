import { Container, Graphics, Text } from 'pixi.js';
import { useTrainStore } from '../stores/trainStore';
import { useUIStore } from '../stores/uiStore';
import type { TrainHead, Carriage, TrainStyle } from '../types';
import type { PixiApp } from './PixiApp';

// ─── Color utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    clamp(r).toString(16).padStart(2, '0') +
    clamp(g).toString(16).padStart(2, '0') +
    clamp(b).toString(16).padStart(2, '0')
  );
}

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r - amount, g - amount, b - amount);
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

// ─── Phase 1 (isometric) constants ────────────────────────────────────────────

const ISO_CAR_W = 60;
const ISO_CAR_H = 35;
const ISO_STD_DEPTH = 28;

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
    app.renderer.background.color = 0x1a1a2e;

    this.scene = new Container();
    app.stage.addChild(this.scene);

    this.platformGraphics = new Graphics();
    this.scene.addChild(this.platformGraphics);

    this.trainContainer = new Container();
    this.scene.addChild(this.trainContainer);

    this.angleLabelText = new Text({
      text: 'Front View',
      style: { fontFamily: 'monospace', fontSize: 14, fill: '#a29bfe' },
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
        style: { fontFamily: 'monospace', fontSize: 14, fill: '#b2bec3' },
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
        this.drawIsoHeadCar(-ISO_CAR_W / 2, baseY, train.head, train.style);
        break;
      case 'Right Side':
        this.drawHeadSide(0, baseY, train.head, theme, false);
        break;
      case 'Rear 3/4':
        this.drawHeadRear(-ISO_CAR_W / 2, baseY, train.head, theme);
        break;
      case 'Left Side':
        this.drawHeadSide(0, baseY, train.head, theme, true);
        break;
    }

    this.updateAngleLabel();
  }

  // ── Front view (symmetrical, facing player) ────────────────────────────────

  private drawHeadFront(cx: number, baseY: number, head: TrainHead, theme: ReturnType<typeof getHeadTheme>) {
    const W = 70, H = 55;
    const x = cx - W / 2;
    const topY = baseY - H;
    const bodyN = hexToNumber(theme.body);
    const accentN = hexToNumber(theme.accent);

    const g = new Graphics();

    // Body
    g.roundRect(x, topY, W, H, 8).fill({ color: bodyN });
    // Lighter top edge
    g.roundRect(x, topY, W, 8, 8).fill({ color: hexToNumber(lighten(theme.body, 40)), alpha: 0.6 });

    // Large windshield
    g.roundRect(x + 10, topY + 10, W - 20, H * 0.45, 4).fill({ color: theme.windshield, alpha: 0.85 });
    // Windshield reflection
    g.roundRect(x + 14, topY + 13, 16, 10, 2).fill({ color: 0x5dade2, alpha: 0.15 });

    // Route display
    g.roundRect(cx - 12, topY + H * 0.5, 24, 10, 2).fill({ color: accentN, alpha: 0.9 });

    // Headlights (symmetrical)
    g.circle(x + 12, baseY - 12, 5).fill({ color: 0x333333 });
    g.circle(x + 12, baseY - 12, 3.5).fill({ color: theme.lightColor });
    g.circle(x + W - 12, baseY - 12, 5).fill({ color: 0x333333 });
    g.circle(x + W - 12, baseY - 12, 3.5).fill({ color: theme.lightColor });

    // Fog lights
    g.circle(x + 20, baseY - 5, 2.5).fill({ color: theme.lightColor, alpha: 0.7 });
    g.circle(x + W - 20, baseY - 5, 2.5).fill({ color: theme.lightColor, alpha: 0.7 });

    // Accent stripe
    g.rect(x + 4, baseY - H * 0.38, W - 8, 4).fill({ color: accentN, alpha: 0.85 });

    // Coupling
    g.roundRect(cx - 8, baseY - 3, 16, 6, 2).fill({ color: 0x555555 });

    // Outline
    g.roundRect(x, topY, W, H, 8).stroke({ color: 0xffffff, width: 0.5, alpha: 0.15 });

    this.trainContainer.addChild(g);
    this.addHeadLabels(cx, baseY, head);
  }

  // ── Side view (flat profile) ───────────────────────────────────────────────

  private drawHeadSide(cx: number, baseY: number, head: TrainHead, theme: ReturnType<typeof getHeadTheme>, mirrored: boolean) {
    const W = 100, H = 50;
    const x = cx - W / 2;
    const topY = baseY - H;
    const bodyN = hexToNumber(theme.body);
    const accentN = hexToNumber(theme.accent);

    const ct = new Container();
    const g = new Graphics();

    // Body with rounded nose on the left
    g.roundRect(x, topY, W, H, 5).fill({ color: bodyN });

    // Nose (rounded front edge)
    g.roundRect(x - 8, topY + 4, 14, H - 8, 7).fill({ color: hexToNumber(lighten(theme.body, 20)) });

    // Roof highlight
    g.rect(x, topY, W, 6).fill({ color: hexToNumber(lighten(theme.body, 35)), alpha: 0.5 });

    // Windshield (front)
    g.roundRect(x - 4, topY + 8, 14, H - 16, 3).fill({ color: theme.windshield, alpha: 0.8 });

    // Windows row
    const winY = topY + 12;
    const winH = H - 24;
    for (let wx = x + 18; wx < x + W - 8; wx += 22) {
      g.roundRect(wx, winY, 16, winH, 3).fill({ color: 0x1e272e, alpha: 0.8 });
    }

    // Door lines
    g.moveTo(x + 40, topY + 4).lineTo(x + 40, baseY - 4).stroke({ color: 0xdfe6e9, width: 0.8, alpha: 0.2 });
    g.moveTo(x + 70, topY + 4).lineTo(x + 70, baseY - 4).stroke({ color: 0xdfe6e9, width: 0.8, alpha: 0.2 });

    // Accent stripe
    g.rect(x - 4, topY + Math.round(H * 0.55), W + 8, 5).fill({ color: accentN, alpha: 0.85 });

    // Headlight
    g.circle(x - 4, baseY - 12, 4).fill({ color: theme.lightColor });

    // Wheels
    g.circle(x + 18, baseY + 2, 7).fill({ color: 0x333333 });
    g.circle(x + 18, baseY + 2, 3).fill({ color: 0x555555 });
    g.circle(x + W - 18, baseY + 2, 7).fill({ color: 0x333333 });
    g.circle(x + W - 18, baseY + 2, 3).fill({ color: 0x555555 });

    // Rail
    g.rect(x - 15, baseY + 9, W + 30, 2).fill({ color: 0x4a4870 });

    // Outline
    g.roundRect(x - 8, topY + 4, W + 8, H - 4, 5).stroke({ color: 0xffffff, width: 0.5, alpha: 0.12 });

    ct.addChild(g);

    if (mirrored) {
      ct.scale.x = -1;
    }

    this.trainContainer.addChild(ct);
    this.addHeadLabels(cx, baseY + 14, head);
  }

  // ── Rear 3/4 view (isometric, showing back) ───────────────────────────────

  private drawHeadRear(px: number, baseY: number, head: TrainHead, theme: ReturnType<typeof getHeadTheme>) {
    const bodyHex   = theme.body;
    const topColor  = hexToNumber(lighten(bodyHex, 40));
    const sideColor = hexToNumber(darken(bodyHex, 15));
    const endColor  = hexToNumber(darken(bodyHex, 40));
    const accentN   = hexToNumber(theme.accent);
    const depth = ISO_STD_DEPTH;
    const dX    = Math.round(depth * 0.28);
    const dY    = -Math.round(depth * 0.55);

    const ct = this.buildIsoBox(px, baseY, ISO_CAR_W, ISO_CAR_H, depth, topColor, sideColor, endColor);

    // Rear wall (end face - darker, with tail lights)
    const rear = new Graphics();
    // Tail lights (red)
    rear.circle(px + dX - 3, baseY - ISO_CAR_H + dY + 10, 3).fill({ color: 0xe74c3c, alpha: 0.9 });
    rear.circle(px + dX - 3, baseY + dY - 8, 3).fill({ color: 0xe74c3c, alpha: 0.9 });
    ct.addChild(rear);

    // Rear coupler
    const coupler = new Graphics();
    coupler.roundRect(px + dX - 6, baseY + dY - 2, 10, 8, 2).fill({ color: 0x555555 });
    ct.addChild(coupler);

    // Rear window (emergency door)
    const rearWin = new Graphics();
    rearWin.roundRect(px + 2, baseY - ISO_CAR_H + 8, 6, 16, 2).fill({ color: theme.windshield, alpha: 0.5 });
    ct.addChild(rearWin);

    // Side windows (visible on the main face)
    const wins = new Graphics();
    const winH = Math.round(ISO_CAR_H * 0.42);
    const winY = baseY - ISO_CAR_H + 7;
    wins.rect(px + 8,  winY, 13, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    wins.rect(px + 30, winY, 13, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    ct.addChild(wins);

    // Accent stripe
    const stripe = new Graphics();
    stripe.rect(px + 2, baseY - Math.round(ISO_CAR_H * 0.45), ISO_CAR_W - 4, 5).fill({ color: accentN, alpha: 0.7 });
    ct.addChild(stripe);

    // Outline
    const outline = new Graphics();
    outline.poly([px, baseY, px + ISO_CAR_W, baseY, px + ISO_CAR_W, baseY - ISO_CAR_H, px, baseY - ISO_CAR_H])
           .stroke({ color: 0xffffff, width: 0.5, alpha: 0.2 });
    ct.addChild(outline);

    this.trainContainer.addChild(ct);
    this.addHeadLabels(px + ISO_CAR_W / 2, baseY, head);
  }

  // ── Shared label helper ────────────────────────────────────────────────────

  private addHeadLabels(cx: number, baseY: number, head: TrainHead) {
    const label = new Text({
      text: head.city.charAt(0).toUpperCase() + head.city.slice(1),
      style: { fontFamily: 'monospace', fontSize: 11, fill: '#dfe6e9', fontWeight: 'bold' },
    });
    label.anchor.set(0.5, 0);
    label.x = cx;
    label.y = baseY + 8;
    this.trainContainer.addChild(label);

    const eraLabel = new Text({
      text: head.era.toUpperCase(),
      style: { fontFamily: 'monospace', fontSize: 8, fill: '#b2bec3' },
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

    const g = this.platformGraphics;
    g.clear();

    g.ellipse(cx, cy + 3, rx * 0.88, ry * 0.55).fill({ color: 0x0d0d1f, alpha: 0.45 });
    g.ellipse(cx, cy, rx, ry).fill({ color: 0x6c5ce7, alpha: 0.15 });
    g.ellipse(cx, cy, rx, ry).stroke({ color: 0x6c5ce7, width: 1.5, alpha: 0.8 });

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
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0x6c5ce7, width: 1, alpha: 0.35 });
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
    if (!train) return;
    const selectedIdx = useUIStore.getState().selectedCarriageIndex;

    const numFilled = train.carriages.length;
    const numEmpty  = MAX_CARRIAGES - numFilled;

    // Total pixel width: head + filled carriages + empty slots
    const totalW = SIDE_HEAD_W + (numFilled + numEmpty) * (SIDE_CAR_W + SIDE_GAP);
    const startX = Math.round((W - totalW) / 2);
    // Bottom edge of all cars (widebody will extend upward more)
    const baseY  = Math.round(H / 2 + SIDE_STD_H / 2);

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
    const theme  = getHeadTheme(head);
    const W      = SIDE_HEAD_W;
    const H      = SIDE_STD_H;
    const topY   = baseY - H;
    const body   = hexToNumber(theme.body);
    const accent = hexToNumber(theme.accent);

    const g = new Graphics();

    // Body (rounded corners)
    g.roundRect(x, topY, W, H, 5).fill({ color: body });

    // Accent stripe pattern for head (using city theme)
    // No custom pattern on head — just the accent stripe below

    // Windshield (left/front side) — city theme tint
    g.roundRect(x + 4, topY + 8, 12, H - 16, 2).fill({ color: theme.windshield, alpha: 0.7 });

    // Body windows
    const winY = topY + 10;
    const winH = H - 20;
    g.roundRect(x + 26, winY, 14, winH, 2).fill({ color: 0x1e272e, alpha: 0.8 });
    g.roundRect(x + 48, winY, 14, winH, 2).fill({ color: 0x1e272e, alpha: 0.8 });

    // Headlights (left edge) — city theme glow
    g.circle(x + 5, baseY - 10, 3.5).fill({ color: theme.lightColor });
    g.circle(x + 5, baseY - 22, 3.5).fill({ color: theme.lightColor });

    // Accent stripe along bottom
    g.rect(x + 18, baseY - 6, W - 20, 3).fill({ color: accent, alpha: 0.85 });

    // Route badge (top area)
    g.roundRect(x + 22, topY + 3, 22, 7, 2).fill({ color: accent, alpha: 0.9 });

    // Outline
    g.roundRect(x, topY, W, H, 5).stroke({ color: 0xffffff, width: 0.5, alpha: 0.15 });

    this.trainContainer.addChild(g);
  }

  // ─── Side-view: filled carriage ─────────────────────────────────────────────

  private drawSideCarriage(x: number, baseY: number, carriage: Carriage, isSelected: boolean) {
    const W      = SIDE_CAR_W;
    const H      = carriage.type === 'widebody' ? SIDE_WIDE_H : SIDE_STD_H;
    const topY   = baseY - H;
    const cStyle = carriage.style;
    const body   = hexToNumber(cStyle.bodyColor);
    const accent = hexToNumber(cStyle.accentColor);

    const ct = new Container();
    const g  = new Graphics();

    // Body
    g.roundRect(x, topY, W, H, 3).fill({ color: body });

    // Pattern
    this.applySidePattern(g, x, topY, W, H, cStyle);

    // Windows
    const winY  = topY + 10;
    const winH  = H - 20;
    const winW  = carriage.type === 'widebody' ? 16 : 13;
    g.roundRect(x + 6,  winY, winW, winH, 2).fill({ color: 0x1e272e, alpha: 0.8 });
    g.roundRect(x + 28, winY, winW, winH, 2).fill({ color: 0x1e272e, alpha: 0.8 });
    if (carriage.type === 'widebody') {
      g.roundRect(x + 52, winY, winW - 2, winH, 2).fill({ color: 0x1e272e, alpha: 0.8 });
    }

    // Door centre line
    const midX = x + W / 2;
    g.moveTo(midX, topY + 4).lineTo(midX, baseY - 4)
     .stroke({ color: 0xdfe6e9, width: 1, alpha: 0.2 });

    // Accent stripe along bottom
    g.rect(x + 2, baseY - 6, W - 4, 3).fill({ color: accent, alpha: 0.7 });

    // Selection glow
    if (isSelected) {
      g.roundRect(x - 2, topY - 2, W + 4, H + 4, 6)
       .stroke({ color: 0x81ecec, width: 2.5, alpha: 0.95 });
      g.roundRect(x, topY, W, H, 3)
       .stroke({ color: 0x81ecec, width: 1, alpha: 0.45 });
    } else {
      g.roundRect(x, topY, W, H, 3)
       .stroke({ color: 0xffffff, width: 0.5, alpha: 0.12 });
    }

    ct.addChild(g);

    // XL badge for widebody
    if (carriage.type === 'widebody') {
      const xlLabel = new Text({
        text: 'XL',
        style: { fontFamily: 'monospace', fontSize: 9, fill: '#dfe6e9' },
      });
      xlLabel.x = x + W - 18;
      xlLabel.y = topY + 3;
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
    g.roundRect(x, topY, W, H, 3).fill({ color: 0x6c5ce7, alpha: 0.05 });
    g.roundRect(x, topY, W, H, 3).stroke({ color: 0x6c5ce7, width: 1.5, alpha: 0.5 });
    this.trainContainer.addChild(g);

    const plus = new Text({
      text: '+',
      style: { fontFamily: 'monospace', fontSize: 26, fill: '#6c5ce7' },
    });
    plus.anchor.set(0.5, 0.5);
    plus.alpha = 0.65;
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

  // ─── Isometric head (Phase 1) ───────────────────────────────────────────────

  private buildIsoBox(
    px: number, py: number,
    w: number, h: number, depth: number,
    topColor: number, sideColor: number, endColor: number,
    alpha = 1,
  ): Container {
    const dX = Math.round(depth * 0.28);
    const dY = -Math.round(depth * 0.55);
    const gfx = new Graphics();

    gfx.poly([px, py, px + w, py, px + w, py - h, px, py - h])
       .fill({ color: sideColor, alpha });

    gfx.poly([
      px, py - h, px + w, py - h,
      px + w + dX, py - h + dY, px + dX, py - h + dY,
    ]).fill({ color: topColor, alpha });

    gfx.poly([
      px, py, px, py - h,
      px + dX, py - h + dY, px + dX, py + dY,
    ]).fill({ color: endColor, alpha });

    const ct = new Container();
    ct.addChild(gfx);
    return ct;
  }

  // @ts-ignore — kept for future carriage iso rendering
  private applyIsoPattern(
    ct: Container,
    px: number, py: number,
    w: number, h: number,
    style: TrainStyle,
  ) {
    const gfx     = new Graphics();
    const accentN = hexToNumber(style.accentColor);
    switch (style.pattern) {
      case 'stripe':
        for (let dy = 6; dy < h - 2; dy += 12) {
          gfx.rect(px + 2, py - h + dy, w - 4, 4).fill({ color: accentN, alpha: 0.35 });
        }
        break;
      case 'gradient':
        for (let dy = 0; dy < h; dy += 4) {
          const a = 0.28 * (1 - dy / h);
          gfx.rect(px, py - h + dy, w, 4).fill({ color: accentN, alpha: a });
        }
        break;
      case 'tech':
        gfx.moveTo(px + 4, py - h + 7).lineTo(px + w - 4, py - h + 7)
           .stroke({ color: 0x00cec9, width: 1, alpha: 0.75 });
        gfx.moveTo(px + 4, py - h + 17).lineTo(px + w - 4, py - h + 17)
           .stroke({ color: 0x00cec9, width: 1, alpha: 0.55 });
        break;
      default:
        break;
    }
    ct.addChild(gfx);
  }

  private drawIsoHeadCar(px: number, py: number, head: TrainHead, _style: TrainStyle) {
    const theme = getHeadTheme(head);
    // Use the city theme's body color for the head (not the user's style color)
    const bodyHex   = theme.body;
    const topColor  = hexToNumber(lighten(bodyHex, 55));
    const sideColor = hexToNumber(bodyHex);
    const endColor  = hexToNumber(darken(bodyHex, 45));
    const accentN   = hexToNumber(theme.accent);
    const depth = ISO_STD_DEPTH;
    const dX    = Math.round(depth * 0.28);
    const dY    = -Math.round(depth * 0.55);

    const ct = this.buildIsoBox(px, py, ISO_CAR_W, ISO_CAR_H, depth, topColor, sideColor, endColor);

    // Accent stripe across the side face (city-specific color)
    const stripe = new Graphics();
    const stripeY = py - Math.round(ISO_CAR_H * 0.45);
    stripe.rect(px + 2, stripeY, ISO_CAR_W - 4, 5).fill({ color: accentN, alpha: 0.85 });
    ct.addChild(stripe);

    // Windshield (city-specific tint)
    const windshield = new Graphics();
    windshield.poly([
      px + 1,      py - ISO_CAR_H + 6,
      px + dX - 1, py - ISO_CAR_H + dY + 6,
      px + dX - 1, py - ISO_CAR_H + dY + Math.round(ISO_CAR_H * 0.56),
      px + 1,      py - ISO_CAR_H + Math.round(ISO_CAR_H * 0.56),
    ]).fill({ color: theme.windshield, alpha: 0.7 });
    // Windshield reflection
    windshield.poly([
      px + 2,      py - ISO_CAR_H + 8,
      px + dX - 3, py - ISO_CAR_H + dY + 8,
      px + dX - 5, py - ISO_CAR_H + dY + 14,
      px + 2,      py - ISO_CAR_H + 14,
    ]).fill({ color: 0x5dade2, alpha: 0.15 });
    ct.addChild(windshield);

    // Headlights (city-specific glow color)
    const lights = new Graphics();
    lights.circle(px + 7,  py - 10, 3.5).fill({ color: theme.lightColor, alpha: 1 });
    lights.circle(px + 18, py - 10, 3.5).fill({ color: theme.lightColor, alpha: 1 });
    ct.addChild(lights);

    // Windows
    const wins   = new Graphics();
    const winH   = Math.round(ISO_CAR_H * 0.42);
    const winY   = py - ISO_CAR_H + 7;
    wins.rect(px + 8,  winY, 13, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    wins.rect(px + 30, winY, 13, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    ct.addChild(wins);

    // Route badge with accent color
    const badge = new Graphics();
    badge.rect(px + 7, py - ISO_CAR_H + 2, 22, 7).fill({ color: accentN, alpha: 0.9 });
    ct.addChild(badge);

    // Outline
    const outline = new Graphics();
    outline.poly([px, py, px + ISO_CAR_W, py, px + ISO_CAR_W, py - ISO_CAR_H, px, py - ISO_CAR_H])
           .stroke({ color: 0xffffff, width: 0.5, alpha: 0.2 });
    ct.addChild(outline);

    // City name label below the head
    const label = new Text({
      text: head.city.charAt(0).toUpperCase() + head.city.slice(1),
      style: { fontFamily: 'monospace', fontSize: 11, fill: '#dfe6e9', fontWeight: 'bold' },
    });
    label.anchor.set(0.5, 0);
    label.x = px + ISO_CAR_W / 2;
    label.y = py + 8;
    ct.addChild(label);

    // Era tag
    const eraLabel = new Text({
      text: head.era.toUpperCase(),
      style: { fontFamily: 'monospace', fontSize: 8, fill: '#b2bec3' },
    });
    eraLabel.anchor.set(0.5, 0);
    eraLabel.x = px + ISO_CAR_W / 2;
    eraLabel.y = py + 22;
    ct.addChild(eraLabel);

    this.trainContainer.addChild(ct);
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
