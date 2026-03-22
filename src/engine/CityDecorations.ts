import { Graphics } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import { useUIStore } from '../stores/uiStore';

const GRID_SIZE = 30;
const NUM_BUILDINGS = 100;
const WORLD_RANGE = 100; // grid units in each direction from origin
const BUILDING_COLOR = 0x1a3a5c;
const CULL_MARGIN = GRID_SIZE * 5; // extra padding beyond viewport edges

interface Building {
  x: number; // world pixels
  y: number;
  w: number;
  h: number;
  alpha: number;
}

/**
 * Simple LCG (linear congruential generator) seeded PRNG.
 * Uses the Numerical Recipes parameters so output is deterministic
 * for a given seed, regardless of platform.
 */
function makeSeededRand(seed: number) {
  let s = (seed >>> 0) || 1; // ensure non-zero uint32
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Generates ~100 small building-outline rectangles scattered around the
 * world as decorative background texture.  Rendered below tracks/stations
 * using semi-transparent fills.
 */
export class CityDecorations {
  private graphics: Graphics;
  private buildings: Building[] = [];
  private pixiApp: PixiApp;
  private unsubscribeUI: () => void;

  constructor(pixiApp: PixiApp) {
    this.pixiApp = pixiApp;
    this.graphics = new Graphics();
    // addChildAt(1) inserts after the grid (index 0).
    // When TrackRenderer also calls addChildAt(1) AFTER this, it pushes
    // CityDecorations up to index 2 and sits at index 1 itself — so the
    // final z-order is: grid < decorations < tracks < stations.
    // Therefore GameCanvas must create TrackRenderer BEFORE CityDecorations.
    pixiApp.worldContainer.addChildAt(this.graphics, 1);

    this.generateBuildings();
    this.unsubscribeUI = useUIStore.subscribe(() => this.render());
    this.render();
  }

  private generateBuildings() {
    const rand = makeSeededRand(42);
    for (let i = 0; i < NUM_BUILDINGS; i++) {
      const gx = (rand() - 0.5) * 2 * WORLD_RANGE;
      const gy = (rand() - 0.5) * 2 * WORLD_RANGE;
      const gw = 1 + Math.floor(rand() * 3); // 1, 2, or 3 grid units
      const gh = 1 + Math.floor(rand() * 2); // 1 or 2 grid units
      const alpha = 0.08 + rand() * 0.07;    // 0.08–0.15

      this.buildings.push({
        x: gx * GRID_SIZE,
        y: gy * GRID_SIZE,
        w: gw * GRID_SIZE,
        h: gh * GRID_SIZE,
        alpha,
      });
    }
  }

  render() {
    this.graphics.clear();

    const { cameraX, cameraY, zoomLevel } = useUIStore.getState();
    const screen = this.pixiApp.app.screen;

    // Visible world-pixel rectangle (with culling margin)
    const viewLeft   = -cameraX / zoomLevel - CULL_MARGIN;
    const viewTop    = -cameraY / zoomLevel - CULL_MARGIN;
    const viewRight  = viewLeft  + screen.width  / zoomLevel + CULL_MARGIN * 2;
    const viewBottom = viewTop   + screen.height / zoomLevel + CULL_MARGIN * 2;

    for (const b of this.buildings) {
      // Axis-aligned rectangle intersection check
      if (b.x + b.w < viewLeft || b.x > viewRight ||
          b.y + b.h < viewTop  || b.y > viewBottom) {
        continue;
      }
      this.graphics.rect(b.x, b.y, b.w, b.h).fill({ color: BUILDING_COLOR, alpha: b.alpha });
    }
  }

  destroy() {
    this.unsubscribeUI();
    this.graphics.destroy();
  }
}
