// src/engine/TrainSpriteRenderer.ts
// Renders moving trains on the blueprint PixiJS canvas during simulation mode.
import { Container, Graphics, Text } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import type { SimulationEngine, TrainRunState } from './SimulationEngine';

const GRID_SIZE = 30;
const HEAD_W = 30;
const HEAD_H = 10;
const CARRIAGE_W = 20;
const CARRIAGE_H = 10;
const TRAIL_LENGTH = 8;

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

    for (const state of trainStates) {
      const px = state.worldX * GRID_SIZE;
      const py = state.worldY * GRID_SIZE;
      const colorStr = this.lineMap.get(state.lineId)?.color ?? '#ffffff';
      const carriageCount = this.trainCarriageCounts.get(state.id) ?? 0;

      // Update trail
      if (!this.trails.has(state.id)) this.trails.set(state.id, []);
      const trail = this.trails.get(state.id)!;
      trail.push({ x: px, y: py });
      if (trail.length > TRAIL_LENGTH) trail.shift();

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
      const y = anim.sy + (anim.ty - anim.sy) * anim.t;
      animG.circle(x, y, 3).fill({ color: 0xffd93d, alpha: 1 - anim.t });
    }
    for (const anim of this.alightingAnims) {
      const x = anim.tx + (anim.sx - anim.tx) * anim.t; // train→station
      const y = anim.ty + (anim.sy - anim.ty) * anim.t;
      animG.circle(x, y, 3).fill({ color: 0xffd93d, alpha: anim.t });
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

    const isVertical = Math.abs(dirY) > Math.abs(dirX);

    // ── Train style colors ───────────────────────────────────────────────────
    const styles = this.trainStyles.get(state.id);
    const headColor = styles?.headColor ?? colorStr;

    const g = new Graphics();

    // ── Motion trail (fading polyline) ──────────────────────────────────────
    if (trail.length >= 2) {
      for (let i = 1; i < trail.length; i++) {
        const alpha = (i / trail.length) * 0.4;
        g.moveTo(trail[i - 1].x, trail[i - 1].y);
        g.lineTo(trail[i].x, trail[i].y);
        g.stroke({ color: colorStr, width: 3, alpha });
      }
    }

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
          g.circle(sx, sy, pulseR).stroke({ color: colorStr, width: 2, alpha: pulseAlpha });
        }
      }
    }

    // ── Train head (rotated per segment direction) ───────────────────────────
    const [headRW, headRH] = isVertical ? [HEAD_H, HEAD_W] : [HEAD_W, HEAD_H];
    const hw = headRW / 2;
    const hh = headRH / 2;
    g.roundRect(px - hw, py - hh, headRW, headRH, 3).fill({ color: headColor, alpha: 1 });

    // ── Carriages placed along the actual track path ─────────────────────────
    if (hasPath) {
      const pixelPathLen = pathLength * GRID_SIZE;
      const firstOffset = HEAD_W / 2 + 4 + CARRIAGE_W / 2;
      const interCarriage = CARRIAGE_W + 3;

      for (let i = 0; i < carriageCount; i++) {
        const offsetPx = firstOffset + i * interCarriage;
        const carriageProgress = state.progress - offsetPx / pixelPathLen;

        let cpx: number, cpy: number, cIsVert: boolean;

        if (carriageProgress >= 0) {
          // Carriage is on the current track segment — use path interpolation
          const pos = getPositionOnPath(trackPath!, carriageProgress, pathLength);
          cpx = pos.x * GRID_SIZE;
          cpy = pos.y * GRID_SIZE;
          const cDLen = Math.sqrt(pos.dx * pos.dx + pos.dy * pos.dy);
          cIsVert = cDLen > 0
            ? Math.abs(pos.dy / cDLen) > Math.abs(pos.dx / cDLen)
            : isVertical;
        } else {
          // Carriage extends past the start of current segment — place behind head in a straight line
          const behindX = -dirX;
          const behindY = -dirY;
          cpx = px + behindX * offsetPx;
          cpy = py + behindY * offsetPx;
          cIsVert = isVertical;
        }

        const [cw, ch] = cIsVert ? [CARRIAGE_H, CARRIAGE_W] : [CARRIAGE_W, CARRIAGE_H];
        const carriageColor = styles?.carriageColors[i] ?? colorStr;
        g.roundRect(cpx - cw / 2, cpy - ch / 2, cw, ch, 2)
          .fill({ color: carriageColor, alpha: 0.85 });
      }
    } else {
      // Fallback: straight line behind head using trail direction
      const behindX = -dirX;
      const behindY = -dirY;
      for (let i = 0; i < carriageCount; i++) {
        const offset = hw + 4 + i * (CARRIAGE_W + 3) + CARRIAGE_W / 2;
        const cx = px + behindX * offset;
        const cy = py + behindY * offset;
        const carriageColor = styles?.carriageColors[i] ?? colorStr;
        g.roundRect(cx - CARRIAGE_W / 2, cy - CARRIAGE_H / 2, CARRIAGE_W, CARRIAGE_H, 2)
          .fill({ color: carriageColor, alpha: 0.85 });
      }
    }

    // ── Direction indicator (small triangle pointing forward) ────────────────
    const arrowStartX = px + dirX * (hw + 2);
    const arrowStartY = py + dirY * (hh + 2);
    const arrowLen = 5;
    const arrowWidth = 4;
    const tipX = arrowStartX + dirX * arrowLen;
    const tipY = arrowStartY + dirY * arrowLen;
    const leftX = arrowStartX - dirY * arrowWidth;
    const leftY = arrowStartY + dirX * arrowWidth;
    const rightX = arrowStartX + dirY * arrowWidth;
    const rightY = arrowStartY - dirX * arrowWidth;

    g.moveTo(tipX, tipY);
    g.lineTo(leftX, leftY);
    g.lineTo(rightX, rightY);
    g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.8 });

    trainContainer.addChild(g);

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
        dotG.circle(dotX, dotY, 2).fill({ color: 0xffd93d, alpha: 0.9 - phase * 0.5 });
      }
      trainContainer.addChild(dotG);
    }

    // ── Status label when stopped or loading ─────────────────────────────────
    if (state.status !== 'running') {
      const labelText = state.status === 'loading' ? 'LOADING' : 'STOPPED';
      const labelColor = state.status === 'loading' ? '#81ecec' : '#ffd93d';
      const label = new Text({
        text: labelText,
        style: {
          fontFamily: 'Courier New, monospace',
          fontSize: 8,
          fill: labelColor,
        },
      });
      label.anchor.set(0.5, 1);
      label.x = px;
      label.y = py - 18;
      trainContainer.addChild(label);
    }

    this.container.addChild(trainContainer);
  }

  private renderWaitingDots(sx: number, sy: number, count: number): void {
    const g = new Graphics();
    const startY = sy + 16;
    const visibleCount = Math.min(count, 10);
    for (let i = 0; i < visibleCount; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = sx - 4 + col * 8;
      const y = startY + row * 8;
      g.circle(x, y, 3).fill({ color: 0xffd93d, alpha: 1 });
    }
    this.container.addChild(g);
    if (count > 10) {
      const label = new Text({
        text: String(count),
        style: {
          fontFamily: 'Courier New, monospace',
          fontSize: 8,
          fill: '#ffffff',
        },
      });
      label.anchor.set(0.5, 0);
      label.x = sx;
      label.y = startY + Math.ceil(visibleCount / 2) * 8;
      this.container.addChild(label);
    }
  }

  destroy(): void {
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });
    this.container.destroy();
  }
}
