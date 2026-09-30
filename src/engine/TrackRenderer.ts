import { Graphics } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import { useMapStore } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
import { PAL, toColorNum, shade } from './MarioArt';

const GRID_SIZE = 30;
const TIE_SPACING = 10;
const TIE_HALF = 8;

type Pt = { x: number; y: number };

/**
 * Renders track segments as chunky "world map" paths: a dark outline, a
 * sandy dirt bed with wooden sleepers, and a bold line-coloured rail band.
 *
 * LOD:
 *  - zoom < 0.5  → no sleepers
 *  - zoom < 0.25 → single coloured line only
 */
export class TrackRenderer {
  private graphics: Graphics;
  private unsubscribeMap: () => void;
  private unsubscribeUI: () => void;

  constructor(pixiApp: PixiApp) {
    this.graphics = new Graphics();
    // Insert before stations (index 1) so tracks render between grid and stations
    pixiApp.worldContainer.addChildAt(this.graphics, 1);

    this.unsubscribeMap = useMapStore.subscribe(() => this.render());
    this.unsubscribeUI = useUIStore.subscribe(() => this.render());

    this.render();
  }

  private polyline(path: Pt[]) {
    const g = this.graphics;
    g.moveTo(path[0].x * GRID_SIZE, path[0].y * GRID_SIZE);
    for (let i = 1; i < path.length; i++) {
      g.lineTo(path[i].x * GRID_SIZE, path[i].y * GRID_SIZE);
    }
  }

  private sleepers(path: Pt[]) {
    const g = this.graphics;
    for (let i = 1; i < path.length; i++) {
      const ax = path[i - 1].x * GRID_SIZE, ay = path[i - 1].y * GRID_SIZE;
      const bx = path[i].x * GRID_SIZE, by = path[i].y * GRID_SIZE;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1) continue;
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      const nx = -uy, ny = ux;
      for (let d = TIE_SPACING / 2; d < len; d += TIE_SPACING) {
        const cx = ax + ux * d, cy = ay + uy * d;
        g.moveTo(cx + nx * TIE_HALF, cy + ny * TIE_HALF);
        g.lineTo(cx - nx * TIE_HALF, cy - ny * TIE_HALF);
      }
    }
    g.stroke({ color: PAL.wood, width: 3.5, alpha: 1 });
  }

  render() {
    this.graphics.clear();

    const { tracks, lines } = useMapStore.getState();
    const zoom = useUIStore.getState().zoomLevel;

    if (tracks.length === 0) return;

    const lineColorMap = new Map<string, string>();
    for (const line of lines) {
      lineColorMap.set(line.id, line.color);
    }

    const round = { cap: 'round', join: 'round' } as const;

    // Draw each pass for ALL tracks before the next pass, so crossings and
    // shared stations blend into one continuous road instead of overlapping.
    const valid = tracks.filter(t => t.path.length >= 2);

    if (zoom < 0.25) {
      for (const track of valid) {
        this.polyline(track.path);
        this.graphics.stroke({ color: lineColorMap.get(track.lineId) ?? '#ffffff', width: 4, alpha: 0.9, ...round });
      }
      return;
    }

    // 1) Dark outline of the path bed
    for (const track of valid) {
      this.polyline(track.path);
      this.graphics.stroke({ color: PAL.outline, width: 22, ...round });
    }
    // 2) Sandy path bed
    for (const track of valid) {
      this.polyline(track.path);
      this.graphics.stroke({ color: PAL.dirt, width: 17, ...round });
    }
    // 2b) Subtle inner shading on the bed
    for (const track of valid) {
      this.polyline(track.path);
      this.graphics.stroke({ color: PAL.dirtDark, width: 11, alpha: 0.35, ...round });
    }
    // 3) Wooden sleepers
    if (zoom >= 0.5) {
      for (const track of valid) this.sleepers(track.path);
    }
    // 4) Rail band in the line colour with a dark rim and a shiny centre
    for (const track of valid) {
      const color = toColorNum(lineColorMap.get(track.lineId) ?? '#ffffff');
      this.polyline(track.path);
      this.graphics.stroke({ color: PAL.outline, width: 9, ...round });
      this.polyline(track.path);
      this.graphics.stroke({ color, width: 6, ...round });
      if (zoom >= 0.5) {
        this.polyline(track.path);
        this.graphics.stroke({ color: shade(color, 1.45), width: 1.5, alpha: 0.8, ...round });
      }
    }
  }

  destroy() {
    this.unsubscribeMap();
    this.unsubscribeUI();
    this.graphics.destroy();
  }
}
