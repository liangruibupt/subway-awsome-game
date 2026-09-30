import { Graphics } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import { PAL } from './MarioArt';

const GRID_SIZE = 30;
const COARSE_MULTIPLIER = 5;
const BUFFER_CELLS = 3;

/**
 * Grassy "world map" ground: a soft two-tone checkerboard of grass tiles,
 * with faint tile seams so players can still see where things snap.
 */
export class GridRenderer {
  private graphics: Graphics;

  constructor(pixiApp: PixiApp) {
    this.graphics = new Graphics();
    // Insert at index 0 so grid renders behind all other world content
    pixiApp.worldContainer.addChildAt(this.graphics, 0);
  }

  render(
    viewportX: number,
    viewportY: number,
    viewportWidth: number,
    viewportHeight: number,
    scale: number,
  ) {
    const g = this.graphics;
    g.clear();

    const buffer = GRID_SIZE * BUFFER_CELLS;
    const coarseSize = GRID_SIZE * COARSE_MULTIPLIER;

    const startX = Math.floor((viewportX - buffer) / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor((viewportY - buffer) / GRID_SIZE) * GRID_SIZE;
    const endX = viewportX + viewportWidth + buffer;
    const endY = viewportY + viewportHeight + buffer;

    // Base grass fill for the visible area (renderer background is grass too)
    g.rect(startX, startY, endX - startX, endY - startY).fill({ color: PAL.grass });

    // --- Checker tiles (skip when zoomed far out: too many rects, invisible anyway) ---
    if (scale >= 0.35) {
      for (let x = startX; x <= endX; x += GRID_SIZE) {
        const cx = Math.round(x / GRID_SIZE);
        for (let y = startY; y <= endY; y += GRID_SIZE) {
          const cy = Math.round(y / GRID_SIZE);
          if (((cx + cy) & 1) === 0) g.rect(x, y, GRID_SIZE, GRID_SIZE);
        }
      }
      g.fill({ color: PAL.grassDark, alpha: 0.35 });
    }

    // --- Fine tile seams ---
    if (scale >= 0.5) {
      for (let x = startX; x <= endX; x += GRID_SIZE) {
        g.moveTo(x, startY);
        g.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += GRID_SIZE) {
        g.moveTo(startX, y);
        g.lineTo(endX, y);
      }
      g.stroke({ color: 0x2f7a1e, alpha: 0.14, width: 1 });
    }

    // --- Coarse "region" seams every 5 tiles ---
    const coarseStartX = Math.floor((viewportX - buffer) / coarseSize) * coarseSize;
    const coarseStartY = Math.floor((viewportY - buffer) / coarseSize) * coarseSize;
    for (let x = coarseStartX; x <= endX; x += coarseSize) {
      g.moveTo(x, startY);
      g.lineTo(x, endY);
    }
    for (let y = coarseStartY; y <= endY; y += coarseSize) {
      g.moveTo(startX, y);
      g.lineTo(endX, y);
    }
    g.stroke({ color: 0x2f7a1e, alpha: 0.28, width: 1.5 });
  }
}
