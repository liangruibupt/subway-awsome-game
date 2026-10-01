// src/engine/TrainSpriteRenderer.ts
// Renders moving trains on the overworld PixiJS canvas during simulation mode.
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

export class TrainSpriteRenderer {
  private container: Container;
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
    pixiApp.worldContainer.addChild(this.container);
    this.engine = engine;
    this.stationMap = stationMap;
    this.lineMap = lineMap;
    this.trainCarriageCounts = trainCarriageCounts;
    this.trainStyles = trainStyles;
  }

  update(deltaSeconds: number): void {
    // Clear previous frame's visuals
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });

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

    // Render waiting passenger dots at stations
    for (const [stationId, stationData] of this.stationMap) {
      const waiting = this.engine.getWaitingPassengers(stationId);
      if (waiting <= 0) continue;
      const sx = stationData.x * GRID_SIZE;
      const sy = stationData.y * GRID_SIZE;
      this.renderWaitingDots(sx, sy, waiting);
    }

    // Render boarding and alighting animations
    const animG = new Graphics();
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
    this.container.addChild(animG);

    // Clean up stale timers
    const activeIds = new Set(trainStates.map(s => s.id));
    for (const id of [...this.pulseTimers.keys(), ...this.passengerAnimTimers.keys()]) {
      if (!activeIds.has(id)) {
        this.pulseTimers.delete(id);
        this.passengerAnimTimers.delete(id);
      }
    }
  }

  private renderTrain(
    state: TrainRunState,
    px: number,
    py: number,
    colorStr: string,
    carriageCount: number,
  ): void {
    const trainContainer = new Container();

    // ── Train style colors ───────────────────────────────────────────────────
    const styles = this.trainStyles.get(state.id);
    const headColor = styles?.headColor ?? colorStr;

    const g = new Graphics();

    // ── Pulsing ring around the current station when stopped/loading ─────────
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
    // terminal the whole train is kept on the track.
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
      if (geo.total >= front + back) {
        const lo = d === 1 ? back : front;
        const hi = d === 1 ? geo.total - front : geo.total - back;
        head = Math.max(lo, Math.min(hi, head));
      }
      for (const off of offsets) {
        const p = pointAt(geo.points, geo.cum, head - d * off);
        placed.push({
          x: p.x * GRID_SIZE,
          y: p.y * GRID_SIZE,
          angle: d === 1 ? p.angle : p.angle + Math.PI,
        });
      }
    } else {
      for (const off of offsets) placed.push({ x: px - off * GRID_SIZE, y: py, angle: 0 });
    }

    const layer = new Container();
    {
      const hg = new Graphics();
      drawMetroTop(hg, HEAD_W, HEAD_H, toColorNum(headColor), { head: true, tail: carriageCount === 0 });
      hg.x = placed[0].x;
      hg.y = placed[0].y;
      hg.rotation = placed[0].angle;
      layer.addChild(hg);
    }
    for (let i = 0; i < carriageCount; i++) {
      const carriageColor = styles?.carriageColors[i] ?? colorStr;
      const cg = new Graphics();
      drawMetroTop(cg, CARRIAGE_W, CARRIAGE_H, toColorNum(carriageColor), {
        gangway: true,
        tail: i === carriageCount - 1,
      });
      cg.x = placed[i + 1].x;
      cg.y = placed[i + 1].y;
      cg.rotation = placed[i + 1].angle;
      // Stack front-to-back so each gangway tucks under the car in front of it
      layer.addChildAt(cg, 0);
    }
    // Labels / coin effects follow the drawn head
    px = placed[0].x;
    py = placed[0].y;

    trainContainer.addChild(g);
    trainContainer.addChild(layer);

    // ── Passenger dots animating during loading ──────────────────────────────
    if (state.status === 'loading') {
      const animT = this.passengerAnimTimers.get(state.id) ?? 0;
      const dotG = new Graphics();
      const dotCount = 5;
      for (let i = 0; i < dotCount; i++) {
        const phase = ((animT * 1.5) + (i / dotCount)) % 1;
        const angle = (i / dotCount) * Math.PI * 2 + animT * 3;
        const r = 12 - phase * 8;
        const dotX = px + Math.cos(angle) * r;
        const dotY = py + Math.sin(angle) * r - 8;
        drawCoin(dotG, dotX, dotY - 4, 3, Math.abs(Math.cos(animT * 6 + i)), 0.95 - phase * 0.5);
      }
      trainContainer.addChild(dotG);
    }

    // ── Status label when stopped or loading ─────────────────────────────────
    if (state.status !== 'running') {
      const labelText = state.status === 'loading' ? 'LOADING' : 'STOPPED';
      const labelColor = state.status === 'loading' ? PAL.coin : PAL.white;
      const label = new Text({
        text: labelText,
        style: {
          fontFamily: PIXEL_FONT,
          fontSize: 7,
          fill: labelColor,
          stroke: { color: PAL.outline, width: 3 },
        },
      });
      label.anchor.set(0.5, 1);
      label.x = px;
      label.y = py - 22;
      trainContainer.addChild(label);
    }

    this.container.addChild(trainContainer);
  }

  private renderWaitingDots(sx: number, sy: number, count: number): void {
    const g = new Graphics();
    // Waiting passengers = a row of spinning coins to the right of the station
    const startX = sx + 22;
    const startY = sy - 8;
    const visibleCount = Math.min(count, 10);
    for (let i = 0; i < visibleCount; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = startX + col * 9;
      const y = startY + row * 11;
      const spin = Math.abs(Math.cos(this.clock * 3 + i * 0.6));
      drawCoin(g, x, y, 3.8, spin);
    }
    this.container.addChild(g);
    if (count > 10) {
      const label = new Text({
        text: `x${count}`,
        style: {
          fontFamily: PIXEL_FONT,
          fontSize: 7,
          fill: PAL.white,
          stroke: { color: PAL.outline, width: 3 },
        },
      });
      label.anchor.set(0, 0.5);
      label.x = startX + 5 * 9 - 2;
      label.y = startY;
      this.container.addChild(label);
    }
  }

  destroy(): void {
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });
    this.container.destroy();
  }
}
