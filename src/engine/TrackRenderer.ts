import { Graphics } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import { useMapStore } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';

const GRID_SIZE = 30;

/**
 * Renders all track segments as glowing neon lines on the PixiJS canvas.
 *
 * Double-render technique:
 *  1. Glow pass  — wide line (~8px) at low alpha (~0.15) for the halo effect
 *  2. Sharp pass — thin line (~3px) at full opacity for the crisp center
 *
 * LOD:
 *  - zoom < 0.5  → reduced glow width
 *  - zoom < 0.25 → single thin line only (no glow)
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

  render() {
    this.graphics.clear();

    const { tracks, lines } = useMapStore.getState();
    const zoom = useUIStore.getState().zoomLevel;

    if (tracks.length === 0) return;

    // Build a quick color lookup from line id → color string
    const lineColorMap = new Map<string, string>();
    for (const line of lines) {
      lineColorMap.set(line.id, line.color);
    }

    const showGlow = zoom >= 0.5;
    const glowWidth = zoom >= 0.5 ? 8 : 4;

    for (const track of tracks) {
      const colorStr = lineColorMap.get(track.lineId) ?? '#ffffff';
      const path = track.path;
      if (path.length < 2) continue;

      if (zoom < 0.25) {
        // Minimal LOD: single thin line only
        this.graphics.moveTo(path[0].x * GRID_SIZE, path[0].y * GRID_SIZE);
        for (let i = 1; i < path.length; i++) {
          this.graphics.lineTo(path[i].x * GRID_SIZE, path[i].y * GRID_SIZE);
        }
        this.graphics.stroke({ color: colorStr, width: 1, alpha: 0.5 });
        continue;
      }

      // --- Glow pass ---
      if (showGlow) {
        this.graphics.moveTo(path[0].x * GRID_SIZE, path[0].y * GRID_SIZE);
        for (let i = 1; i < path.length; i++) {
          this.graphics.lineTo(path[i].x * GRID_SIZE, path[i].y * GRID_SIZE);
        }
        this.graphics.stroke({ color: colorStr, width: glowWidth, alpha: 0.15 });
      }

      // --- Sharp pass ---
      this.graphics.moveTo(path[0].x * GRID_SIZE, path[0].y * GRID_SIZE);
      for (let i = 1; i < path.length; i++) {
        this.graphics.lineTo(path[i].x * GRID_SIZE, path[i].y * GRID_SIZE);
      }
      // Full detail at zoom >= 0.5; reduced width/alpha at 0.25–0.5
      const sharpWidth = zoom >= 0.5 ? 3 : 2;
      const sharpAlpha = zoom >= 0.5 ? 1 : 0.6;
      this.graphics.stroke({ color: colorStr, width: sharpWidth, alpha: sharpAlpha });
    }
  }

  destroy() {
    this.unsubscribeMap();
    this.unsubscribeUI();
    this.graphics.destroy();
  }
}
