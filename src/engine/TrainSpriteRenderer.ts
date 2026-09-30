// src/engine/TrainSpriteRenderer.ts
// Renders moving trains on the blueprint PixiJS canvas during simulation mode.
import { Container, Graphics, Text } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import type { SimulationEngine, TrainRunState } from './SimulationEngine';
import { PAL, PIXEL_FONT, drawCoin, toColorNum, shade } from './MarioArt';

const GRID_SIZE = 30;
const HEAD_W = 32;
const HEAD_H = 14;
const CARRIAGE_W = 22;
const CARRIAGE_H = 14;
const TRAIL_LENGTH = 20;

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

    const isVertical = Math.abs(dirY) > Math.abs(dirX);
    const trailIsVertical = Math.abs(trailDirY) > Math.abs(trailDirX);

    // ── Train style colors ───────────────────────────────────────────────────
    const styles = this.trainStyles.get(state.id);
    const headColor = styles?.headColor ?? colorStr;

    const g = new Graphics();

    // ── Motion trail: little dust puffs behind a running train ──────────────
    if (state.status === 'running' && trail.length >= 2) {
      const tailIdx = Math.max(0, trail.length - 1 - Math.min(trail.length - 1, 4 + carriageCount * 2));
      for (let i = 0; i < 3; i++) {
        const ti = Math.max(0, tailIdx - i * 3);
        const p = trail[ti];
        const age = (i + 1) / 3;
        const r = 2.5 + age * 3;
        g.circle(p.x, p.y, r + 1.2).fill({ color: PAL.outline, alpha: 0.35 * (1 - age * 0.6) });
        g.circle(p.x, p.y, r).fill({ color: PAL.white, alpha: 0.9 * (1 - age * 0.6) });
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
          g.circle(sx, sy, pulseR + 4).stroke({ color: PAL.outline, width: 4, alpha: pulseAlpha + 0.2 });
          g.circle(sx, sy, pulseR + 4).stroke({ color: PAL.white, width: 2, alpha: pulseAlpha + 0.4 });
        }
      }
    }

    // ── Train head (rotated per segment direction) ───────────────────────────
    const [headRW, headRH] = isVertical ? [HEAD_H, HEAD_W] : [HEAD_W, HEAD_H];
    const hw = headRW / 2;
    const hh = headRH / 2;
    // Small bob so the train feels alive
    const bob = state.status === 'running' ? Math.round(Math.sin(this.clock * 18) * 0.8) : 0;
    const headC = toColorNum(headColor);
    g.roundRect(px - hw + 2, py - hh + 3, headRW, headRH, 5).fill({ color: 0x000000, alpha: 0.25 });
    g.roundRect(px - hw, py - hh + bob, headRW, headRH, 5)
      .fill({ color: headC })
      .stroke({ color: PAL.outline, width: 2.5 });
    // Shine stripe along the top/left edge
    if (isVertical) {
      g.rect(px - hw + 2.5, py - hh + 4 + bob, 2.5, headRH - 8).fill({ color: shade(headC, 1.5), alpha: 0.9 });
    } else {
      g.rect(px - hw + 4, py - hh + 2.5 + bob, headRW - 8, 2.5).fill({ color: shade(headC, 1.5), alpha: 0.9 });
    }
    // Windshield at the front end + headlight
    {
      const ws = 6;
      const fx = px + dirX * (hw - ws / 2 - 3);
      const fy = py + dirY * (hh - ws / 2 - 3) + bob;
      const [ww, wh] = isVertical ? [headRW - 6, ws] : [ws, headRH - 6];
      g.roundRect(fx - ww / 2, fy - wh / 2, ww, wh, 2).fill({ color: 0x1e3a6e }).stroke({ color: PAL.outline, width: 1.5 });
      g.rect(fx - ww / 2 + 1, fy - wh / 2 + 1, Math.max(1, ww / 3), Math.max(1, wh / 3)).fill({ color: 0x9ad6ff });
      const lx = px + dirX * (hw + 1);
      const ly = py + dirY * (hh + 1) + bob;
      g.circle(lx, ly, 2.8).fill({ color: PAL.coinLight }).stroke({ color: PAL.outline, width: 1.2 });
    }

    // ── Carriages: trail-based positioning ──────────────────────────────────
    // Each carriage is placed at an earlier position in the movement trail.
    // This is simple, reliable, and works at corners, stops, and interchange
    // stations without needing per-segment path lookups.
    {
      const firstOffset = HEAD_W / 2 + 4 + CARRIAGE_W / 2;
      const interCarriage = CARRIAGE_W + 3;

      for (let i = 0; i < carriageCount; i++) {
        const targetDist = firstOffset + i * interCarriage;

        let cpx = px;
        let cpy = py;
        let cIsVert = trailIsVertical;

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
              cIsVert = Math.abs(tdy) > Math.abs(tdx);
              remaining = 0;
            } else {
              remaining -= segDist;
            }
          }
          // If trail was too short, extend from the oldest trail point
          if (remaining > 0 && trail.length >= 2) {
            const tdx = trail[1].x - trail[0].x;
            const tdy = trail[1].y - trail[0].y;
            const segDist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (segDist > 0.1) {
              cpx = trail[0].x - (tdx / segDist) * remaining;
              cpy = trail[0].y - (tdy / segDist) * remaining;
            }
          }
        } else {
          // No trail yet — place behind head using trail direction
          cpx = px - trailDirX * targetDist;
          cpy = py - trailDirY * targetDist;
        }

        const [cw, ch] = cIsVert ? [CARRIAGE_H, CARRIAGE_W] : [CARRIAGE_W, CARRIAGE_H];
        const carriageColor = styles?.carriageColors[i] ?? colorStr;
        const cc = toColorNum(carriageColor);
        g.roundRect(cpx - cw / 2 + 2, cpy - ch / 2 + 3, cw, ch, 4).fill({ color: 0x000000, alpha: 0.22 });
        g.roundRect(cpx - cw / 2, cpy - ch / 2, cw, ch, 4)
          .fill({ color: cc })
          .stroke({ color: PAL.outline, width: 2.5 });
        // Two windows along the car
        const along = cIsVert ? [0, 1] : [1, 0];
        for (const k of [-1, 1]) {
          const wx = cpx + along[0] * k * (CARRIAGE_W / 4);
          const wy = cpy + along[1] * k * (CARRIAGE_W / 4);
          g.rect(wx - 2.5, wy - 2.5, 5, 5).fill({ color: 0xfff6c0 }).stroke({ color: PAL.outline, width: 1 });
        }
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
    g.fill({ color: PAL.white, alpha: 0.95 });
    g.moveTo(tipX, tipY);
    g.lineTo(leftX, leftY);
    g.lineTo(rightX, rightY);
    g.closePath();
    g.stroke({ color: PAL.outline, width: 1.5 });

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
