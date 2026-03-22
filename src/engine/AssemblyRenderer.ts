import { Container, Graphics, Text } from 'pixi.js';
import { useTrainStore } from '../stores/trainStore';
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

/** Lighten a hex colour by adding `amount` to each channel. */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}

/** Darken a hex colour by subtracting `amount` from each channel. */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r - amount, g - amount, b - amount);
}

// ─── Car constants ────────────────────────────────────────────────────────────

const CAR_W = 60;       // width of each car (left-to-right on screen)
const CAR_H = 35;       // height of each car
const STD_DEPTH = 28;   // standard carriage depth (shown as isometric offset)
const WIDE_DEPTH = 38;  // widebody carriage depth
const CAR_SPACING = 5;  // gap between cars
const MAX_CARRIAGES = 7;

// ─── Named turntable views ────────────────────────────────────────────────────

const VIEW_ANGLES = [
  { angle: 0,   label: 'Front View'  },
  { angle: 72,  label: 'Front 3/4'   },
  { angle: 144, label: 'Right Side'  },
  { angle: 216, label: 'Rear 3/4'    },
  { angle: 288, label: 'Left Side'   },
];

// ─── AssemblyRenderer ─────────────────────────────────────────────────────────

export class AssemblyRenderer {
  private pixiApp: PixiApp;
  private scene!: Container;
  private platformGraphics!: Graphics;
  private trainContainer!: Container;
  private angleLabelText!: Text;

  private currentAngle = 0;
  private autoRotate = true;
  private isDragging = false;
  private lastDragX = 0;
  private dragIdleTimer: ReturnType<typeof setTimeout> | null = null;

  private unsubscribeTrain: (() => void) | null = null;

  constructor(pixiApp: PixiApp) {
    this.pixiApp = pixiApp;
  }

  init() {
    const app = this.pixiApp.app;

    // Switch to assembly background colour
    app.renderer.background.color = 0x1a1a2e;

    // Root scene container lives directly on stage
    this.scene = new Container();
    app.stage.addChild(this.scene);

    // Turntable platform (drawn in scene/screen space)
    this.platformGraphics = new Graphics();
    this.scene.addChild(this.platformGraphics);

    // Train container — positioned so local x=0 sits at the platform centre
    this.trainContainer = new Container();
    this.scene.addChild(this.trainContainer);

    // Angle label below the platform
    this.angleLabelText = new Text({
      text: 'Front View',
      style: { fontFamily: 'monospace', fontSize: 14, fill: '#a29bfe' },
    });
    this.scene.addChild(this.angleLabelText);

    this.drawPlatform();
    this.renderTrain();

    // Re-render whenever the train store changes
    this.unsubscribeTrain = useTrainStore.subscribe(() => {
      this.renderTrain();
    });

    // Mouse drag
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseUp);

    // Touch drag
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
    canvas.addEventListener('touchend', this.onMouseUp);

    // Per-frame auto-rotate
    app.ticker.add(this.onTick);
  }

  // ─── Platform ──────────────────────────────────────────────────────────────

  private drawPlatform() {
    const app = this.pixiApp.app;
    const cx = app.screen.width / 2;
    const cy = app.screen.height * 0.65;
    const rx = 230;
    const ry = 46;

    const g = this.platformGraphics;
    g.clear();

    // Ground shadow inside the ellipse
    g.ellipse(cx, cy + 3, rx * 0.88, ry * 0.55).fill({ color: 0x0d0d1f, alpha: 0.45 });

    // Semi-transparent purple fill
    g.ellipse(cx, cy, rx, ry).fill({ color: 0x6c5ce7, alpha: 0.15 });

    // Outer glowing stroke
    g.ellipse(cx, cy, rx, ry).stroke({ color: 0x6c5ce7, width: 1.5, alpha: 0.8 });

    // Inner dashed ellipse — simulated by drawing alternating arc segments
    const irx = rx * 0.72;
    const iry = ry * 0.72;
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

  // ─── Train rendering ───────────────────────────────────────────────────────

  private renderTrain() {
    // Destroy old visuals
    const removed = this.trainContainer.removeChildren();
    for (const child of removed) {
      child.destroy({ children: true });
    }

    const app = this.pixiApp.app;
    const platformCX = app.screen.width / 2;
    const platformCY = app.screen.height * 0.65;

    // Place the container so its local x=0 is at the platform centre.
    // We only flip container.scale.x for turntable rotation; y is untouched.
    this.trainContainer.x = platformCX;
    this.trainContainer.y = 0;

    const trains = useTrainStore.getState().trains;
    if (!trains.length) {
      this.renderNoTrainMessage(platformCY);
      this.updateAngleLabel();
      return;
    }

    const train = trains[0];
    const { head, carriages, style } = train;

    // Always reserve space for the full head + MAX_CARRIAGES layout
    const totalSlots = 1 + MAX_CARRIAGES;
    const totalWidth = totalSlots * CAR_W + (totalSlots - 1) * CAR_SPACING;

    // Local x starts at the left edge of the train (relative to container origin)
    let lx = -totalWidth / 2;
    // Bottom y of the car bodies (local y == screen y since container.y = 0)
    const baseY = platformCY - 8;

    this.drawHeadCar(lx, baseY, head, style);
    lx += CAR_W + CAR_SPACING;

    for (let i = 0; i < MAX_CARRIAGES; i++) {
      if (i < carriages.length) {
        this.drawCarriageBox(lx, baseY, carriages[i], style);
      } else {
        this.drawEmptySlot(lx, baseY);
      }
      lx += CAR_W + CAR_SPACING;
    }

    this.updateAngleLabel();
  }

  private renderNoTrainMessage(platformCY: number) {
    const text = new Text({
      text: 'Add a train head to start building',
      style: { fontFamily: 'monospace', fontSize: 14, fill: '#b2bec3' },
    });
    text.anchor.set(0.5, 0.5);
    text.x = 0;          // local x=0 is platform centre
    text.y = platformCY - 55;
    this.trainContainer.addChild(text);
  }

  // ─── Isometric box ─────────────────────────────────────────────────────────

  /**
   * Draw a 2.5D isometric box and return its Container.
   *
   * px, py  – bottom-left of the front (main visible) face in local space.
   * w, h    – width and height of the front face.
   * depth   – real-world depth of the car (controls top-face height + end-face width).
   *
   * Three visible faces:
   *   side (right)  – the big long rectangle facing the viewer  → sideColor (medium)
   *   top           – parallelogram above the side face         → topColor  (lighter)
   *   end (left)    – narrow trapezoid at the left end          → endColor  (darker)
   */
  private buildIsoBox(
    px: number, py: number,
    w: number, h: number, depth: number,
    topColor: number, sideColor: number, endColor: number,
    alpha = 1,
  ): Container {
    const dX = Math.round(depth * 0.28);   // horizontal component of depth direction
    const dY = -Math.round(depth * 0.55);  // vertical component (upward = "into screen")

    const gfx = new Graphics();

    // Main side face
    gfx.poly([px, py, px + w, py, px + w, py - h, px, py - h])
       .fill({ color: sideColor, alpha });

    // Top face
    gfx.poly([
      px,           py - h,
      px + w,       py - h,
      px + w + dX,  py - h + dY,
      px + dX,      py - h + dY,
    ]).fill({ color: topColor, alpha });

    // End (left) face
    gfx.poly([
      px,      py,
      px,      py - h,
      px + dX, py - h + dY,
      px + dX, py       + dY,
    ]).fill({ color: endColor, alpha });

    const ct = new Container();
    ct.addChild(gfx);
    return ct;
  }

  // ─── Pattern overlay ───────────────────────────────────────────────────────

  private applyPattern(
    ct: Container,
    px: number, py: number,
    w: number, h: number,
    style: TrainStyle,
  ) {
    const gfx = new Graphics();
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
        gfx
          .moveTo(px + 4, py - h + 7)
          .lineTo(px + w - 4, py - h + 7)
          .stroke({ color: 0x00cec9, width: 1, alpha: 0.75 });
        gfx
          .moveTo(px + 4, py - h + 17)
          .lineTo(px + w - 4, py - h + 17)
          .stroke({ color: 0x00cec9, width: 1, alpha: 0.55 });
        break;

      default:
        break; // solid — nothing extra needed
    }
    ct.addChild(gfx);
  }

  // ─── Car drawing ───────────────────────────────────────────────────────────

  private drawHeadCar(px: number, py: number, head: TrainHead, style: TrainStyle) {
    const bodyHex  = style.bodyColor;
    const topColor = hexToNumber(lighten(bodyHex, 55));
    const sideColor = hexToNumber(bodyHex);
    const endColor  = hexToNumber(darken(bodyHex, 45));
    const depth = STD_DEPTH;
    const dX = Math.round(depth * 0.28);
    const dY = -Math.round(depth * 0.55);

    const ct = this.buildIsoBox(px, py, CAR_W, CAR_H, depth, topColor, sideColor, endColor);

    this.applyPattern(ct, px, py, CAR_W, CAR_H, style);

    // Windshield on end (left) face
    const windshield = new Graphics();
    windshield.poly([
      px + 1,        py - CAR_H + 6,
      px + dX - 1,   py - CAR_H + dY + 6,
      px + dX - 1,   py - CAR_H + dY + Math.round(CAR_H * 0.56),
      px + 1,        py - CAR_H       + Math.round(CAR_H * 0.56),
    ]).fill({ color: 0x74b9ff, alpha: 0.55 });
    ct.addChild(windshield);

    // Headlights (small circles at bottom-left of main face)
    const lights = new Graphics();
    lights.circle(px + 7,  py - 10, 3.5).fill({ color: 0xffd93d, alpha: 1 });
    lights.circle(px + 18, py - 10, 3.5).fill({ color: 0xffd93d, alpha: 1 });
    ct.addChild(lights);

    // Windows on main side face
    const wins = new Graphics();
    const winH = Math.round(CAR_H * 0.42);
    const winY = py - CAR_H + 7;
    wins.rect(px + 8,  winY, 13, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    wins.rect(px + 30, winY, 13, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    ct.addChild(wins);

    // Route number badge (accent-coloured strip at top-left of main face)
    const badge = new Graphics();
    badge.rect(px + 7, py - CAR_H + 2, 22, 7).fill({ color: hexToNumber(style.accentColor), alpha: 0.9 });
    ct.addChild(badge);

    // Thin edge outline for crispness
    const outline = new Graphics();
    outline
      .poly([px, py, px + CAR_W, py, px + CAR_W, py - CAR_H, px, py - CAR_H])
      .stroke({ color: 0xffffff, width: 0.5, alpha: 0.2 });
    ct.addChild(outline);

    this.trainContainer.addChild(ct);
    void head; // available for era-specific head art in future
  }

  private drawCarriageBox(px: number, py: number, carriage: Carriage, style: TrainStyle) {
    const bodyHex   = style.bodyColor;
    const depth     = carriage.type === 'widebody' ? WIDE_DEPTH : STD_DEPTH;
    const topColor  = hexToNumber(lighten(bodyHex, 55));
    const sideColor = hexToNumber(bodyHex);
    const endColor  = hexToNumber(darken(bodyHex, 45));

    const ct = this.buildIsoBox(px, py, CAR_W, CAR_H, depth, topColor, sideColor, endColor);

    this.applyPattern(ct, px, py, CAR_W, CAR_H, style);

    // Windows
    const wins = new Graphics();
    const winH = Math.round(CAR_H * 0.42);
    const winY = py - CAR_H + 7;
    const winW = carriage.type === 'widebody' ? 17 : 13;
    wins.rect(px + 6,  winY, winW, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    wins.rect(px + 28, winY, winW, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    if (carriage.type === 'widebody') {
      wins.rect(px + 48, winY, winW - 4, winH).fill({ color: 0x1e272e, alpha: 0.78 });
    }
    ct.addChild(wins);

    // Door line indicator(s)
    const doors = new Graphics();
    const midX = px + CAR_W / 2;
    doors
      .moveTo(midX, py - CAR_H + 2)
      .lineTo(midX, py - 2)
      .stroke({ color: 0xdfe6e9, width: 1, alpha: 0.22 });
    if (carriage.type === 'widebody') {
      doors
        .moveTo(midX - 5, py - CAR_H + 2).lineTo(midX - 5, py - 2)
        .stroke({ color: 0xdfe6e9, width: 1, alpha: 0.18 });
      doors
        .moveTo(midX + 5, py - CAR_H + 2).lineTo(midX + 5, py - 2)
        .stroke({ color: 0xdfe6e9, width: 1, alpha: 0.18 });
    }
    ct.addChild(doors);

    // XL badge for widebody
    if (carriage.type === 'widebody') {
      const xlLabel = new Text({
        text: 'XL',
        style: { fontFamily: 'monospace', fontSize: 9, fill: '#dfe6e9' },
      });
      xlLabel.x = px + CAR_W - 17;
      xlLabel.y = py - CAR_H + 2;
      ct.addChild(xlLabel);
    }

    // Thin edge outline
    const outline = new Graphics();
    outline
      .poly([px, py, px + CAR_W, py, px + CAR_W, py - CAR_H, px, py - CAR_H])
      .stroke({ color: 0xffffff, width: 0.5, alpha: 0.2 });
    ct.addChild(outline);

    this.trainContainer.addChild(ct);
  }

  private drawEmptySlot(px: number, py: number) {
    const depth = STD_DEPTH;
    const dX = Math.round(depth * 0.28);
    const dY = -Math.round(depth * 0.55);

    const gfx = new Graphics();

    // Side face: very faint fill + dashed-looking outline
    gfx.rect(px, py - CAR_H, CAR_W, CAR_H).fill({ color: 0x6c5ce7, alpha: 0.05 });
    gfx.rect(px, py - CAR_H, CAR_W, CAR_H).stroke({ color: 0x6c5ce7, width: 1, alpha: 0.45 });

    // Top face outline
    gfx.poly([
      px,            py - CAR_H,
      px + CAR_W,    py - CAR_H,
      px + CAR_W + dX, py - CAR_H + dY,
      px       + dX, py - CAR_H + dY,
    ]).stroke({ color: 0x6c5ce7, width: 1, alpha: 0.3 });

    // End face outline
    gfx.poly([
      px,      py,
      px,      py - CAR_H,
      px + dX, py - CAR_H + dY,
      px + dX, py       + dY,
    ]).stroke({ color: 0x6c5ce7, width: 1, alpha: 0.3 });

    this.trainContainer.addChild(gfx);

    // "+" add indicator
    const plus = new Text({
      text: '+',
      style: { fontFamily: 'monospace', fontSize: 22, fill: '#6c5ce7' },
    });
    plus.anchor.set(0.5, 0.5);
    plus.alpha = 0.5;
    plus.x = px + CAR_W / 2;
    plus.y = py - CAR_H / 2;
    this.trainContainer.addChild(plus);
  }

  // ─── Rotation ──────────────────────────────────────────────────────────────

  private onTick = () => {
    if (this.autoRotate && !this.isDragging) {
      this.currentAngle = (this.currentAngle + 0.2) % 360;
      this.applyRotation();
    }
  };

  private applyRotation() {
    const rad = (this.currentAngle * Math.PI) / 180;
    this.trainContainer.scale.x = Math.cos(rad);
    this.updateAngleLabel();
  }

  private getViewLabel(): string {
    const angle = ((this.currentAngle % 360) + 360) % 360;
    let best = VIEW_ANGLES[0];
    let minDiff = Infinity;
    for (const v of VIEW_ANGLES) {
      const diff = Math.abs(angle - v.angle);
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
    const cx = app.screen.width / 2;
    const cy = app.screen.height * 0.65;
    this.angleLabelText.anchor.set(0.5, 0);
    this.angleLabelText.x = cx;
    this.angleLabelText.y = cy + 46 + 14;
  }

  // ─── Input handlers ────────────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastDragX = e.clientX;
    this.autoRotate = false;
    if (this.dragIdleTimer) clearTimeout(this.dragIdleTimer);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastDragX;
    this.lastDragX = e.clientX;
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
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastDragX = e.touches[0].clientX;
      this.autoRotate = false;
      if (this.dragIdleTimer) clearTimeout(this.dragIdleTimer);
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.isDragging || !e.touches.length) return;
    const dx = e.touches[0].clientX - this.lastDragX;
    this.lastDragX = e.touches[0].clientX;
    this.currentAngle = (this.currentAngle + dx * 0.5 + 360) % 360;
    this.applyRotation();
  };

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  destroy() {
    if (this.unsubscribeTrain) {
      this.unsubscribeTrain();
      this.unsubscribeTrain = null;
    }

    const app = this.pixiApp.app;
    app.ticker.remove(this.onTick);

    const canvas = app.canvas as HTMLCanvasElement;
    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mouseup', this.onMouseUp);
    canvas.removeEventListener('mouseleave', this.onMouseUp);
    canvas.removeEventListener('touchstart', this.onTouchStart);
    canvas.removeEventListener('touchmove', this.onTouchMove);
    canvas.removeEventListener('touchend', this.onMouseUp);

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
