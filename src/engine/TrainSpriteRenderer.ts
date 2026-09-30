// src/engine/TrainSpriteRenderer.ts
// Renders moving trains on the blueprint PixiJS canvas during simulation mode.
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
const TRAIL_LENGTH = 200;

interface PathPosition {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

function getPositionOnPath(
  path: { x: number; y: number }[],
  progress: number,
  totalLen: number,
): PathPosition {
  const targetDist = totalLen * Math.max(0, Math.min(1, progress));
  let traveled = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
    if (traveled + segLen >= targetDist) {
      const t = segLen > 0 ? (targetDist - traveled) / segLen : 0;
      const x = path[i - 1].x + (path[i].x - path[i - 1].x) * t;
      const y = path[i - 1].y + (path[i].y - path[i - 1].y) * t;
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      return { x, y, dx: dx || 0, dy: dy || 0 };
    }
    traveled += segLen;
  }
  return { x: path[path.length - 1].x, y: path[path.length - 1].y, dx: 0, dy: 0 };
}

export class TrainSpriteRenderer {
  private container: Container;
  private engine: SimulationEngine;
  private stationMap: Map<string, { x: number; y: number; name: string }>;
  private lineMap: Map<string, { color: string; stationIds: string[] }>;
  private trainCarriageCounts: Map<string, number>;
  private trainStyles: Map<string, { headColor: string; carriageColors: string[] }>;

  private trails = new Map<string, { x: number; y: number }[]>();
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

      // Update trail
      if (!this.trails.has(state.id)) this.trails.set(state.id, []);
      const trail = this.trails.get(state.id)!;
      const last = trail[trail.length - 1];
      // Only record real movement, so a long dwell doesn't flatten the trail
      // (carriages keep trailing the way the train actually came in).
      if (!last || Math.abs(last.x - px) + Math.abs(last.y - py) > 0.5) {
        trail.push({ x: px, y: py });
        if (trail.length > TRAIL_LENGTH) trail.shift();
      }

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

      this.renderTrain(state, px, py, colorStr, carriageCount, trail);
    }

    // Advance and prune animation dots
    for (const anim of this.boardingAnims) anim.t += deltaSeconds * 2;
    for (const anim of this.alightingAnims) anim.t += deltaSeconds * 2;
    this.boardingAnims = this.boardingAnims.filter(a => a.t < 1);
    this.alightingAnims = this.alightingAnims.filter(a => a.t < 1);

    // Detect boarding / alighting for trains at stations
    for (const state of trainStates) {
      if (state.status === 'stopped' || state.status === 'loading') {
        const line = this.lineMap.get(state.lineId);
        if (line && state.currentStationIndex < line.stationIds.length) {
          const stationId = line.stationIds[state.currentStationIndex];
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

    // Clean up stale trails/timers
    const activeIds = new Set(trainStates.map(s => s.id));
    for (const id of [...this.trails.keys()]) {
      if (!activeIds.has(id)) {
        this.trails.delete(id);
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
    trail: { x: number; y: number }[],
  ): void {
    const trainContainer = new Container();

    // ── Get track path for path-based car positioning ────────────────────────
    const trackPath = this.engine.getTrainTrackPath(state.id);
    const pathLength = this.engine.getTrainPathLength(state.id);
    const hasPath = trackPath !== null && trackPath.length >= 2 && pathLength > 0;

    // ── Determine head direction from the current path segment ───────────────
    let dirX = 1;
    let dirY = 0;

    if (hasPath) {
      const headPos = getPositionOnPath(trackPath!, state.progress, pathLength);
      const dLen = Math.sqrt(headPos.dx * headPos.dx + headPos.dy * headPos.dy);
      if (dLen > 0) {
        dirX = headPos.dx / dLen;
        dirY = headPos.dy / dLen;
      }
    } else if (trail.length >= 2) {
      const prev = trail[trail.length - 2];
      const curr = trail[trail.length - 1];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5) {
        dirX = dx / dist;
        dirY = dy / dist;
      }
    }

    // Direction for carriage placement: use TRAIL (actual movement history)
    // not path segment direction. This matters when stopped at a station —
    // the path points forward but carriages should trail behind the arrival direction.
    let trailDirX = dirX;
    let trailDirY = dirY;
    if (trail.length >= 2) {
      // Find the last significant movement in the trail
      for (let i = trail.length - 1; i >= 1; i--) {
        const dx = trail[i].x - trail[i - 1].x;
        const dy = trail[i].y - trail[i - 1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.5) {
          trailDirX = dx / dist;
          trailDirY = dy / dist;
          break;
        }
      }
    }

    // ── Train style colors ───────────────────────────────────────────────────
    const styles = this.trainStyles.get(state.id);
    const headColor = styles?.headColor ?? colorStr;

    const g = new Graphics();

    // ── Pulsing ring around the current station when stopped/loading ─────────
    if (state.status !== 'running') {
      const line = this.lineMap.get(state.lineId);
      if (line && state.currentStationIndex < line.stationIds.length) {
        const stationId = line.stationIds[state.currentStationIndex];
        const station = this.stationMap.get(stationId);
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
    }

    // ── Driving car (rotated to the current path direction) ──────────────────
    const layer = new Container();
    const isLastHead = carriageCount === 0;
    {
      const hg = new Graphics();
      drawMetroTop(hg, HEAD_W, HEAD_H, toColorNum(headColor), { head: true, tail: isLastHead });
      hg.x = px;
      hg.y = py;
      hg.rotation = Math.atan2(dirY, dirX);
      layer.addChild(hg);
    }

    // ── Carriages: trail-based positioning ──────────────────────────────────
    // Each carriage is placed at an earlier position in the movement trail,
    // rotated to the trail segment it sits on, so cars follow corners and
    // diagonals naturally.
    {
      const firstOffset = HEAD_W / 2 + CAR_GAP + CARRIAGE_W / 2;
      const interCarriage = CARRIAGE_W + CAR_GAP;
      const cars: Graphics[] = [];

      for (let i = 0; i < carriageCount; i++) {
        const targetDist = firstOffset + i * interCarriage;

        let cpx = px - trailDirX * targetDist;
        let cpy = py - trailDirY * targetDist;
        let angle = Math.atan2(trailDirY, trailDirX);

        if (trail.length >= 2) {
          let remaining = targetDist;
          // Walk backward through the trail from the head position
          for (let j = trail.length - 1; j >= 1 && remaining > 0; j--) {
            const tdx = trail[j].x - trail[j - 1].x;
            const tdy = trail[j].y - trail[j - 1].y;
            const segDist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (segDist < 0.1) continue;

            if (segDist >= remaining) {
              const t = remaining / segDist;
              cpx = trail[j].x - tdx * t;
              cpy = trail[j].y - tdy * t;
              angle = Math.atan2(tdy, tdx);
              remaining = 0;
            } else {
              remaining -= segDist;
            }
          }
          // If trail was too short, extend from the oldest trail point
          if (remaining > 0) {
            let tdx = trail[1].x - trail[0].x;
            let tdy = trail[1].y - trail[0].y;
            let segDist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (segDist <= 0.1) { tdx = trailDirX; tdy = trailDirY; segDist = 1; }
            cpx = trail[0].x - (tdx / segDist) * remaining;
            cpy = trail[0].y - (tdy / segDist) * remaining;
            angle = Math.atan2(tdy, tdx);
          }
        }

        const carriageColor = styles?.carriageColors[i] ?? colorStr;
        const cg = new Graphics();
        drawMetroTop(cg, CARRIAGE_W, CARRIAGE_H, toColorNum(carriageColor), {
          gangway: true,
          tail: i === carriageCount - 1,
        });
        cg.x = cpx;
        cg.y = cpy;
        cg.rotation = angle;
        cars.push(cg);
      }
      // Stack front-to-back so each gangway tucks under the car in front of it
      for (const car of cars) layer.addChildAt(car, 0);
    }

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
        text: String(count),
        style: {
          fontFamily: PIXEL_FONT,
          fontSize: 7,
          fill: PAL.white,
          stroke: { color: PAL.outline, width: 3 },
        },
      });
      label.text = `x${count}`;
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
