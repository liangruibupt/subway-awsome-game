import { Graphics } from 'pixi.js';
import type { PixiApp } from './PixiApp';

const GRID_SIZE = 30;
const COARSE_MULTIPLIER = 5;
const BUFFER_CELLS = 3;

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
    _scale: number,
  ) {
    const g = this.graphics;
    g.clear();

    const buffer = GRID_SIZE * BUFFER_CELLS;
    const coarseSize = GRID_SIZE * COARSE_MULTIPLIER;

    // Bounds of the region to draw (world coordinates)
    const startX = Math.floor((viewportX - buffer) / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor((viewportY - buffer) / GRID_SIZE) * GRID_SIZE;
    const endX = viewportX + viewportWidth + buffer;
    const endY = viewportY + viewportHeight + buffer;

    // --- Fine grid (every 30px) ---
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      g.moveTo(x, startY);
      g.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      g.moveTo(startX, y);
      g.lineTo(endX, y);
    }
    g.stroke({ color: 0x1a3a5c, alpha: 0.4, width: 0.5 });

    // --- Coarse grid (every 150px) drawn on top ---
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
    g.stroke({ color: 0x1a3a5c, alpha: 0.8, width: 1.0 });
  }
}
