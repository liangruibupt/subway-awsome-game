import { Graphics } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import { useUIStore } from '../stores/uiStore';
import {
  PAL, seededRand, drawBush, drawTree, drawFlower, drawBrickBlock,
  drawQuestionBlock, drawMushroomHouse, drawPond, drawHill,
} from './MarioArt';

const GRID_SIZE = 30;
const NUM_ITEMS = 2400;
const WORLD_RANGE = 100; // grid units in each direction from origin
const CULL_MARGIN = GRID_SIZE * 5; // extra padding beyond viewport edges

type DecoKind = 'bush' | 'tree' | 'flowers' | 'house' | 'bricks' | 'question' | 'pond' | 'hill' | 'rock';

interface Deco {
  kind: DecoKind;
  x: number; // world pixels (cell centre)
  y: number;
  s: number; // scale / variant
  v: number; // extra variant value
  r: number; // bounding radius for culling
}

// Weighted table of what grows on the world map
const KIND_TABLE: [DecoKind, number][] = [
  ['bush', 26], ['tree', 20], ['flowers', 22], ['house', 5],
  ['bricks', 6], ['question', 5], ['pond', 4], ['hill', 4], ['rock', 6],
];
const KIND_TOTAL = KIND_TABLE.reduce((s, [, w]) => s + w, 0);

const FLOWER_COLORS = [0xffffff, 0xff6fa8, 0xffe14a, 0xff7a3c];

/**
 * Scatters deterministic "world map" scenery (bushes, trees, pipes, blocks,
 * mushroom houses…) around the map as decorative background. Rendered below
 * tracks/stations.
 */
export class CityDecorations {
  private graphics: Graphics;
  private items: Deco[] = [];
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

    this.generate();
    this.unsubscribeUI = useUIStore.subscribe(() => this.render());
    this.render();
  }

  private generate() {
    const rand = makeRand();
    for (let i = 0; i < NUM_ITEMS; i++) {
      const gx = Math.round((rand() - 0.5) * 2 * WORLD_RANGE);
      const gy = Math.round((rand() - 0.5) * 2 * WORLD_RANGE);
      // Keep the spawn area around the origin tidy so first stations are clear
      if (Math.abs(gx) < 4 && Math.abs(gy) < 3) continue;

      let pick = rand() * KIND_TOTAL;
      let kind: DecoKind = 'bush';
      for (const [k, w] of KIND_TABLE) {
        if (pick < w) { kind = k; break; }
        pick -= w;
      }
      const s = 0.8 + rand() * 0.5;
      const v = rand();
      const r = kind === 'hill' || kind === 'pond' ? GRID_SIZE * 2.5 : GRID_SIZE * 1.2;
      this.items.push({
        kind,
        x: gx * GRID_SIZE + GRID_SIZE / 2,
        y: gy * GRID_SIZE + GRID_SIZE / 2,
        s, v, r,
      });
    }
    // Draw big flat things first (ponds/hills), then everything else top→bottom
    const order: Record<DecoKind, number> = {
      pond: 0, hill: 1, flowers: 2, rock: 3, bush: 4, bricks: 4, question: 4, house: 5, tree: 5,
    };
    this.items.sort((a, b) => order[a.kind] - order[b.kind] || a.y - b.y);
  }

  render() {
    const g = this.graphics;
    g.clear();

    const { cameraX, cameraY, zoomLevel } = useUIStore.getState();
    const screen = this.pixiApp.app.screen;

    const viewLeft   = -cameraX / zoomLevel - CULL_MARGIN;
    const viewTop    = -cameraY / zoomLevel - CULL_MARGIN;
    const viewRight  = viewLeft  + screen.width  / zoomLevel + CULL_MARGIN * 2;
    const viewBottom = viewTop   + screen.height / zoomLevel + CULL_MARGIN * 2;
    const detailed = zoomLevel >= 0.35;

    for (const d of this.items) {
      if (d.x + d.r < viewLeft || d.x - d.r > viewRight ||
          d.y + d.r < viewTop  || d.y - d.r > viewBottom) {
        continue;
      }
      if (!detailed && (d.kind === 'flowers' || d.kind === 'rock')) continue;
      this.drawItem(g, d);
    }
  }

  private drawItem(g: Graphics, d: Deco) {
    const { x, y, s, v } = d;
    switch (d.kind) {
      case 'bush':
        drawBush(g, x, y, s * 0.9);
        break;
      case 'tree':
        drawTree(g, x, y - 2, s * 0.9);
        break;
      case 'flowers': {
        const n = 3 + Math.floor(v * 3);
        for (let i = 0; i < n; i++) {
          const a = v * 10 + i * 2.1;
          const rr = 4 + i * 3;
          drawFlower(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr,
            FLOWER_COLORS[(i + Math.floor(v * 4)) % FLOWER_COLORS.length]);
        }
        break;
      }
      case 'house':
        drawMushroomHouse(g, x, y - 2, s * 0.85);
        break;
      case 'bricks': {
        const size = 18;
        const count = 2 + Math.floor(v * 3);
        const qAt = Math.floor(v * 7) % (count + 1); // maybe one "?" in the row
        const startX = x - (count * size) / 2;
        for (let i = 0; i < count; i++) {
          if (i === qAt) drawQuestionBlock(g, startX + i * size, y - size / 2, size);
          else drawBrickBlock(g, startX + i * size, y - size / 2, size);
        }
        break;
      }
      case 'question':
        drawQuestionBlock(g, x - 11, y - 11, 22);
        break;
      case 'pond':
        drawPond(g, x, y, 70 * s, 42 * s);
        break;
      case 'hill':
        // Top-down mound: a hill silhouette reads nicely even from above
        drawHill(g, x, y + 20 * s, 90 * s, 44 * s, v > 0.5 ? PAL.hill : 0x4cbf4c);
        break;
      case 'rock':
        g.ellipse(x, y + 3, 9 * s, 4 * s).fill({ color: 0x000000, alpha: 0.15 });
        g.roundRect(x - 7 * s, y - 6 * s, 14 * s, 10 * s, 4 * s)
          .fill({ color: 0xb8a48c }).stroke({ color: PAL.outline, width: 2 });
        g.rect(x - 4 * s, y - 4 * s, 4 * s, 2 * s).fill({ color: 0xe8dccb });
        break;
    }
  }

  destroy() {
    this.unsubscribeUI();
    this.graphics.destroy();
  }
}

function makeRand() {
  return seededRand(42);
}
