// src/engine/TrainSpriteRenderer.ts
// Renders moving trains on the overworld PixiJS canvas during simulation mode.
//
// Every display object is created ONCE and then only moved / redrawn in place.
// Creating and destroying fresh Graphics/Text objects every frame (the old
// approach) leaked several MB of memory per second, which crashed the browser
// tab ("Aw, Snap!") after a few minutes of running.
import { Container, Graphics, Text } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import type { SimulationEngine, TrainRunState } from './SimulationEngine';
import { PAL, PIXEL_FONT, drawCoin, toColorNum } from './MarioArt';
import { drawMetroTop } from './MetroArt';

const GRID_SIZE = 30;
// Modern metro cars: long, slim bodies joined by short gangways
const HEAD_W = 34;
const HEAD_H = 13;
const CARRIAGE_W = 28;
const CARRIAGE_H = 13;
const CAR_GAP = 2;

/** Train length behind the head car's centre, in grid units (the engine uses
 *  it to start a reversing train clear of the terminal). */
export function trainLengthBehindHead(carriageCount: number): number {
  return (HEAD_W / 2 + carriageCount * (CAR_GAP + CARRIAGE_W)) / GRID_SIZE;
}

/** Point + tangent angle at distance `d` along a polyline. */
function pointAt(
  points: { x: number; y: number }[],
  cum: number[],
  d: number,
): { x: number; y: number; angle: number } {
  const total = cum[cum.length - 1];
  const dist = Math.max(0, Math.min(total, d));
  let i = 1;
  while (i < points.length - 1 && cum[i] < dist) i++;
  const a = points[i - 1];
  const b = points[i];
  const seg = cum[i] - cum[i - 1];
  const t = seg > 0 ? (dist - cum[i - 1]) / seg : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

const labelStyle = (fill: number) => ({
  fontFamily: PIXEL_FONT,
  fontSize: 7,
  fill,
  stroke: { color: PAL.outline, width: 3 },
});

/** Persistent display objects for one train. */
interface TrainView {
  root: Container;
  pulse: Graphics;
  cars: Container;       // head + carriages, rebuilt only when the consist changes
  carsKey: string;
  dots: Graphics;
  label: Text;
}

export class TrainSpriteRenderer {
  private container: Container;
  private trainLayer = new Container();
  private waitingG = new Graphics();
  private waitingLabels = new Map<string, Text>();
  private animG = new Graphics();
  private views = new Map<string, TrainView>();

  private engine: SimulationEngine;
  private stationMap: Map<string, { x: number; y: number; name: string }>;
  private trainCarriageCounts: Map<string, number>;
  private trainStyles: Map<string, { headColor: string; carriageColors: string[] }>;
  private lineMap: Map<string, { color: string; stationIds: string[] }>;

  private pulseTimers = new Map<string, number>();
  private passengerAnimTimers = new Map<string, number>();

  private prevWaiting = new Map<string, number>();
  private prevTrainPax = new Map<string, number>();
  private clock = 0;
  private boardingAnims: { sx: number; sy: number; tx: number; ty: number; t: number }[] = [];
  private alightingAnims: { sx: number; sy: number; tx: number; ty: number; t: number }[] = [];

  constructor(
    pixiApp: PixiApp,
    engine: SimulationEngine,
    stationMap: Map<string, { x: number; y: number; name: string }>,
    lineMap: Map<string, { color: string; stationIds: string[] }>,
    trainCarriageCounts: Map<string, number>,
    trainStyles: Map<string, { headColor: string; carriageColors: string[] }>,
  ) {
    this.container = new Container();
    // z-order: trains → waiting coins (+ counts) → boarding/alighting coins
    this.container.addChild(this.trainLayer, this.waitingG, this.animG);
    pixiApp.worldContainer.addChild(this.container);
    this.engine = engine;
    this.stationMap = stationMap;
    this.lineMap = lineMap;
    this.trainCarriageCounts = trainCarriageCounts;
    this.trainStyles = trainStyles;
  }

  update(deltaSeconds: number): void {
    const trainStates = this.engine.getAllTrainStates();
    this.clock += deltaSeconds > 0 ? deltaSeconds : 1 / 60;

    for (const state of trainStates) {
      const px = state.worldX * GRID_SIZE;
      const py = state.worldY * GRID_SIZE;
      const colorStr = this.lineMap.get(state.lineId)?.color ?? '#ffffff';
      const carriageCount = this.trainCarriageCounts.get(state.id) ?? 0;

      // Update pulse timer (for stopped/loading)
      if (state.status !== 'running') {
        this.pulseTimers.set(state.id, (this.pulseTimers.get(state.id) ?? 0) + deltaSeconds);
      } else {
        this.pulseTimers.delete(state.id);
      }

      // Update passenger animation timer
      if (state.status === 'loading') {
        this.passengerAnimTimers.set(state.id, (this.passengerAnimTimers.get(state.id) ?? 0) + deltaSeconds);
      } else {
        this.passengerAnimTimers.delete(state.id);
      }

      this.renderTrain(state, px, py, colorStr, carriageCount);
    }

    // Drop views of trains that are gone
    const activeIds = new Set(trainStates.map(s => s.id));
    for (const [id, view] of this.views) {
      if (!activeIds.has(id)) {
        view.root.destroy({ children: true });
        this.views.delete(id);
      }
    }

    // Advance and prune animation dots
    for (const anim of this.boardingAnims) anim.t += deltaSeconds * 2;
    for (const anim of this.alightingAnims) anim.t += deltaSeconds * 2;
    this.boardingAnims = this.boardingAnims.filter(a => a.t < 1);
    this.alightingAnims = this.alightingAnims.filter(a => a.t < 1);

    // Detect boarding / alighting for trains at stations
    for (const state of trainStates) {
      if (state.status === 'stopped' || state.status === 'loading') {
        const stationId = state.currentStationId;
        const stationData = this.stationMap.get(stationId);
        if (stationData) {
          const sx = stationData.x * GRID_SIZE;
          const sy = stationData.y * GRID_SIZE;
          const tx = state.worldX * GRID_SIZE;
          const ty = state.worldY * GRID_SIZE;

          // Boarding: waiting count decreased
          const currentWaiting = this.engine.getWaitingPassengers(stationId);
          if (this.prevWaiting.has(stationId)) {
            const prev = this.prevWaiting.get(stationId)!;
            if (prev > currentWaiting) {
              const diff = Math.min(prev - currentWaiting, 5);
              for (let i = 0; i < diff; i++) {
                this.boardingAnims.push({ sx, sy, tx, ty, t: 0 });
              }
            }
          }

          // Alighting: train passenger count decreased
          const currentPax = state.passengers;
          if (this.prevTrainPax.has(state.id)) {
            const prev = this.prevTrainPax.get(state.id)!;
            if (prev > currentPax) {
              const diff = Math.min(prev - currentPax, 5);
              for (let i = 0; i < diff; i++) {
                this.alightingAnims.push({ sx, sy, tx, ty, t: 0 });
              }
            }
          }
        }
      }
      this.prevTrainPax.set(state.id, state.passengers);
    }

    // Update prevWaiting for all stations
    for (const [stationId] of this.stationMap) {
      this.prevWaiting.set(stationId, this.engine.getWaitingPassengers(stationId));
    }

    // Waiting passengers at stations
    this.waitingG.clear();
    for (const [stationId, stationData] of this.stationMap) {
      const waiting = this.engine.getWaitingPassengers(stationId);
      this.renderWaitingDots(stationId, stationData.x * GRID_SIZE, stationData.y * GRID_SIZE, waiting);
    }

    // Boarding and alighting animations
    const animG = this.animG;
    animG.clear();
    for (const anim of this.boardingAnims) {
      const x = anim.sx + (anim.tx - anim.sx) * anim.t;
      // Coins hop along a little arc, like popping out of a block
      const y = anim.sy + (anim.ty - anim.sy) * anim.t - Math.sin(anim.t * Math.PI) * 18;
      drawCoin(animG, x, y, 4, Math.abs(Math.cos(anim.t * Math.PI * 3)), 1 - anim.t * 0.6);
    }
    for (const anim of this.alightingAnims) {
      const x = anim.tx + (anim.sx - anim.tx) * anim.t; // train→station
      const y = anim.ty + (anim.sy - anim.ty) * anim.t - Math.sin(anim.t * Math.PI) * 18;
      drawCoin(animG, x, y, 4, Math.abs(Math.cos(anim.t * Math.PI * 3)), 0.4 + anim.t * 0.6);
    }

    // Clean up stale timers
    for (const id of [...this.pulseTimers.keys(), ...this.passengerAnimTimers.keys()]) {
      if (!activeIds.has(id)) {
        this.pulseTimers.delete(id);
        this.passengerAnimTimers.delete(id);
      }
    }
  }

  private viewFor(id: string): TrainView {
    let view = this.views.get(id);
    if (!view) {
      const root = new Container();
      const pulse = new Graphics();
      const cars = new Container();
      const dots = new Graphics();
      const label = new Text({ text: 'STOPPED', style: labelStyle(PAL.white) });
      label.anchor.set(0.5, 1);
      label.visible = false;
      root.addChild(pulse, cars, dots, label);
      this.trainLayer.addChild(root);
      view = { root, pulse, cars, carsKey: '', dots, label };
      this.views.set(id, view);
    }
    return view;
  }

  /** (Re)draw the head and carriages — only when the consist or colours change. */
  private buildCars(view: TrainView, headColor: string, carriageColors: string[]): void {
    const key = `${headColor}|${carriageColors.join(',')}`;
    if (view.carsKey === key) return;
    view.carsKey = key;
    for (const child of view.cars.removeChildren()) child.destroy();
    const n = carriageColors.length;
    const hg = new Graphics();
    drawMetroTop(hg, HEAD_W, HEAD_H, toColorNum(headColor), { head: true, tail: n === 0 });
    view.cars.addChild(hg);
    for (let i = 0; i < n; i++) {
      const cg = new Graphics();
      drawMetroTop(cg, CARRIAGE_W, CARRIAGE_H, toColorNum(carriageColors[i]), {
        gangway: true,
        tail: i === n - 1,
      });
      // Stack front-to-back so each gangway tucks under the car in front of it
      view.cars.addChildAt(cg, 0);
    }
  }

  private renderTrain(
    state: TrainRunState,
    px: number,
    py: number,
    colorStr: string,
    carriageCount: number,
  ): void {
    const view = this.viewFor(state.id);

    // ── Train style colors ───────────────────────────────────────────────────
    const styles = this.trainStyles.get(state.id);
    const headColor = styles?.headColor ?? colorStr;
    const carriageColors = Array.from({ length: carriageCount }, (_, i) => styles?.carriageColors[i] ?? colorStr);
    this.buildCars(view, headColor, carriageColors);

    // ── Pulsing ring around the current station when stopped/loading ─────────
    const g = view.pulse;
    g.clear();
    if (state.status !== 'running') {
      const station = this.stationMap.get(state.currentStationId);
      if (station) {
        const sx = station.x * GRID_SIZE;
        const sy = station.y * GRID_SIZE;
        const pulseT = this.pulseTimers.get(state.id) ?? 0;
        const pulseR = 14 + Math.sin(pulseT * Math.PI * 2) * 4;
        const pulseAlpha = 0.25 + Math.abs(Math.sin(pulseT * Math.PI * 2)) * 0.2;
        g.circle(sx, sy, pulseR + 4).stroke({ color: PAL.outline, width: 4, alpha: pulseAlpha + 0.2 });
        g.circle(sx, sy, pulseR + 4).stroke({ color: PAL.white, width: 2, alpha: pulseAlpha + 0.4 });
      }
    }

    // ── Lay every car on the actual track ────────────────────────────────────
    // Cars sit at fixed distances behind the head along the route polyline, so
    // they follow corners and never hang off the end of the line: at a
    // terminal the whole train is kept on the track. On a ring the distances
    // wrap round instead.
    const geo = this.engine.getTrainRouteGeometry(state.id);
    const front = HEAD_W / 2 / GRID_SIZE;
    const back = trainLengthBehindHead(carriageCount);
    const offsets: number[] = [0];
    for (let i = 0; i < carriageCount; i++) {
      offsets.push((HEAD_W / 2 + CAR_GAP + CARRIAGE_W / 2 + i * (CARRIAGE_W + CAR_GAP)) / GRID_SIZE);
    }
    const placed: { x: number; y: number; angle: number }[] = [];
    if (geo && geo.total > 0) {
      const d = geo.direction;
      let head = geo.headDist;
      if (!geo.loop && geo.total >= front + back) {
        const lo = d === 1 ? back : front;
        const hi = d === 1 ? geo.total - front : geo.total - back;
        head = Math.max(lo, Math.min(hi, head));
      }
      for (const off of offsets) {
        let at = head - d * off;
        if (geo.loop) at = ((at % geo.total) + geo.total) % geo.total;
        const p = pointAt(geo.points, geo.cum, at);
        placed.push({
          x: p.x * GRID_SIZE,
          y: p.y * GRID_SIZE,
          angle: d === 1 ? p.angle : p.angle + Math.PI,
        });
      }
    } else {
      for (const off of offsets) placed.push({ x: px - off * GRID_SIZE, y: py, angle: 0 });
    }

    // cars.children: [last carriage, …, first carriage, head]
    const cars = view.cars.children;
    for (let k = 0; k < cars.length; k++) {
      const p = placed[cars.length - 1 - k];
      if (!p) continue;
      cars[k].x = p.x;
      cars[k].y = p.y;
      cars[k].rotation = p.angle;
    }
    // Labels / coin effects follow the drawn head
    px = placed[0].x;
    py = placed[0].y;

    // ── Passenger dots animating during loading ──────────────────────────────
    const dotG = view.dots;
    dotG.clear();
    if (state.status === 'loading') {
      const animT = this.passengerAnimTimers.get(state.id) ?? 0;
      const dotCount = 5;
      for (let i = 0; i < dotCount; i++) {
        const phase = ((animT * 1.5) + (i / dotCount)) % 1;
        const angle = (i / dotCount) * Math.PI * 2 + animT * 3;
        const r = 12 - phase * 8;
        const dotX = px + Math.cos(angle) * r;
        const dotY = py + Math.sin(angle) * r - 8;
        drawCoin(dotG, dotX, dotY - 4, 3, Math.abs(Math.cos(animT * 6 + i)), 0.95 - phase * 0.5);
      }
    }

    // ── Status label when stopped or loading ─────────────────────────────────
    const label = view.label;
    label.visible = state.status !== 'running';
    if (label.visible) {
      const text = state.status === 'loading' ? 'LOADING' : 'STOPPED';
      if (label.text !== text) {
        label.text = text;
        label.style.fill = state.status === 'loading' ? PAL.coin : PAL.white;
      }
      label.x = px;
      label.y = py - 22;
    }
  }

  private renderWaitingDots(stationId: string, sx: number, sy: number, count: number): void {
    // Waiting passengers = a row of spinning coins to the right of the station
    const startX = sx + 22;
    const startY = sy - 8;
    const visibleCount = Math.min(Math.max(0, count), 10);
    for (let i = 0; i < visibleCount; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = startX + col * 9;
      const y = startY + row * 11;
      const spin = Math.abs(Math.cos(this.clock * 3 + i * 0.6));
      drawCoin(this.waitingG, x, y, 3.8, spin);
    }
    let label = this.waitingLabels.get(stationId);
    if (count > 10) {
      if (!label) {
        label = new Text({ text: '', style: labelStyle(PAL.white) });
        label.anchor.set(0, 0.5);
        this.container.addChild(label);
        this.waitingLabels.set(stationId, label);
      }
      const text = `x${count}`;
      if (label.text !== text) label.text = text;
      label.x = startX + 5 * 9 - 2;
      label.y = startY;
      label.visible = true;
    } else if (label) {
      label.visible = false;
    }
  }

  destroy(): void {
    this.views.clear();
    this.waitingLabels.clear();
    this.container.destroy({ children: true });
  }
}
