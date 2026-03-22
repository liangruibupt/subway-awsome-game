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

export class TrainSpriteRenderer {
  private container: Container;
  private engine: SimulationEngine;
  private stationMap: Map<string, { x: number; y: number; name: string }>;
  private lineMap: Map<string, { color: string; stationIds: string[] }>;
  private trainCarriageCounts: Map<string, number>;

  private trails = new Map<string, { x: number; y: number }[]>();
  private pulseTimers = new Map<string, number>();
  private passengerAnimTimers = new Map<string, number>();

  constructor(
    pixiApp: PixiApp,
    engine: SimulationEngine,
    stationMap: Map<string, { x: number; y: number; name: string }>,
    lineMap: Map<string, { color: string; stationIds: string[] }>,
    trainCarriageCounts: Map<string, number>,
  ) {
    this.container = new Container();
    pixiApp.worldContainer.addChild(this.container);
    this.engine = engine;
    this.stationMap = stationMap;
    this.lineMap = lineMap;
    this.trainCarriageCounts = trainCarriageCounts;
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

    // Calculate movement direction from trail
    let dirX = 1;
    let dirY = 0;
    if (trail.length >= 2) {
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

    // ── Train head (centered at px, py) ─────────────────────────────────────
    const hw = HEAD_W / 2;
    const hh = HEAD_H / 2;
    g.roundRect(px - hw, py - hh, HEAD_W, HEAD_H, 3).fill({ color: colorStr, alpha: 1 });

    // ── Carriages behind head ────────────────────────────────────────────────
    const behindX = -dirX;
    const behindY = -dirY;
    for (let i = 0; i < carriageCount; i++) {
      const offset = hw + 4 + i * (CARRIAGE_W + 3) + CARRIAGE_W / 2;
      const cx = px + behindX * offset;
      const cy = py + behindY * offset;
      g.roundRect(cx - CARRIAGE_W / 2, cy - CARRIAGE_H / 2, CARRIAGE_W, CARRIAGE_H, 2)
        .fill({ color: colorStr, alpha: 0.85 });
    }

    // ── Direction indicator (small triangle pointing forward) ────────────────
    const arrowStartX = px + dirX * (hw + 2);
    const arrowStartY = py + dirY * (hw + 2);
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

  destroy(): void {
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });
    this.container.destroy();
  }
}
