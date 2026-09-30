import { Container, Graphics, Text } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import { useMapStore } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
import type { Station } from '../types';
import { PAL, LABEL_FONT, drawQuestionBlock, drawPipeTop } from './MarioArt';

const GRID_SIZE = 30;

// Station tile sizes (world px)
const NORMAL_SIZE = 22;
const INTERCHANGE_SIZE = 30;
const TERMINAL_RADIUS = 13;

const NORMAL_COLOR = 0xf89830;      // orange "level" tile
const NORMAL_LIGHT = 0xffd08a;
const NORMAL_DARK = 0xb85a00;

const STATION_FONT_SIZE = 12;

/**
 * Stations drawn like overworld level tiles:
 *  - normal      → orange level tile
 *  - interchange → "?" block
 *  - terminal    → warp pipe
 * with a white name plate underneath.
 */
export class StationRenderer {
  private container: Container;
  private unsubscribeMap: () => void;
  private unsubscribeUI: () => void;

  constructor(pixiApp: PixiApp) {
    this.container = new Container();
    pixiApp.worldContainer.addChild(this.container);

    this.unsubscribeMap = useMapStore.subscribe(() => this.render());
    this.unsubscribeUI = useUIStore.subscribe(() => this.render());

    this.render();
  }

  render() {
    const removed = this.container.removeChildren();
    for (const child of removed) {
      child.destroy({ children: true });
    }

    const stations = useMapStore.getState().stations;
    const zoom = useUIStore.getState().zoomLevel;
    const selectedId = useUIStore.getState().selectedStationId;

    stations.forEach((station, idx) => {
      this.renderStation(station, idx, zoom, station.id === selectedId);
    });
  }

  private drawTile(g: Graphics, px: number, py: number, station: Station, scale: number) {
    if (station.type === 'interchange') {
      const s = INTERCHANGE_SIZE * scale;
      g.rect(px - s / 2 + 3, py - s / 2 + 3, s, s).fill({ color: 0x000000, alpha: 0.25 });
      drawQuestionBlock(g, px - s / 2, py - s / 2, s);
      return INTERCHANGE_SIZE * scale / 2;
    }
    if (station.type === 'terminal') {
      drawPipeTop(g, px, py, TERMINAL_RADIUS * scale);
      return TERMINAL_RADIUS * scale;
    }
    const s = NORMAL_SIZE * scale;
    const h = s / 2;
    g.roundRect(px - h + 3, py - h + 3, s, s, 5 * scale).fill({ color: 0x000000, alpha: 0.25 });
    g.roundRect(px - h, py - h, s, s, 5 * scale).fill({ color: NORMAL_COLOR })
      .stroke({ color: PAL.outline, width: 2.5 });
    g.roundRect(px - h + 3 * scale, py - h + 3 * scale, s - 6 * scale, 3 * scale, 1.5).fill({ color: NORMAL_LIGHT });
    g.rect(px - h + 3 * scale, py + h - 5 * scale, s - 6 * scale, 2.5 * scale).fill({ color: NORMAL_DARK, alpha: 0.7 });
    return h;
  }

  private renderStation(station: Station, index: number, zoom: number, isSelected: boolean) {
    const px = station.x * GRID_SIZE;
    const py = station.y * GRID_SIZE;

    if (zoom < 0.25) {
      const g = new Graphics();
      const color = station.type === 'interchange' ? PAL.question
        : station.type === 'terminal' ? PAL.pipe : NORMAL_COLOR;
      g.rect(px - 5, py - 5, 10, 10).fill({ color }).stroke({ color: PAL.outline, width: 2 });
      this.container.addChild(g);
      return;
    }

    const stationContainer = new Container();
    const g = new Graphics();
    const scale = zoom < 0.5 ? 0.75 : 1;
    const half = this.drawTile(g, px, py, station, scale);

    // Selection: white bracket corners + little red arrow above
    if (isSelected) {
      const r = half + 6;
      const c = 7;
      const corners: [number, number, number, number][] = [
        [-1, -1, 1, 1], [1, -1, -1, 1], [-1, 1, 1, -1], [1, 1, -1, -1],
      ];
      for (const [sx, sy, dx, dy] of corners) {
        const cx = px + sx * r, cy = py + sy * r;
        g.moveTo(cx + dx * c, cy).lineTo(cx, cy).lineTo(cx, cy + dy * c);
      }
      g.stroke({ color: PAL.outline, width: 5, cap: 'square' });
      for (const [sx, sy, dx, dy] of corners) {
        const cx = px + sx * r, cy = py + sy * r;
        g.moveTo(cx + dx * c, cy).lineTo(cx, cy).lineTo(cx, cy + dy * c);
      }
      g.stroke({ color: PAL.white, width: 2.5, cap: 'square' });
      const ay = py - r - 6;
      g.poly([px - 6, ay - 8, px + 6, ay - 8, px, ay]).fill({ color: PAL.red }).stroke({ color: PAL.outline, width: 2 });
    }

    stationContainer.addChild(g);

    // Numbered tiles show their index like level panels
    if (station.type !== 'interchange' && station.type !== 'terminal' && zoom >= 0.5) {
      const num = new Text({
        text: String((index % 99) + 1),
        style: {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 9,
          fill: PAL.white,
          stroke: { color: PAL.outline, width: 3 },
        },
      });
      num.anchor.set(0.5, 0.5);
      num.x = px;
      num.y = py + 1;
      stationContainer.addChild(num);
    }

    if (zoom >= 0.5) {
      // Name plate below the tile
      const label = new Text({
        text: station.name,
        style: {
          fontFamily: LABEL_FONT,
          fontSize: STATION_FONT_SIZE,
          fontWeight: '700',
          fill: PAL.outline,
        },
      });
      label.anchor.set(0.5, 0);
      label.x = px;
      label.y = py + half + 7;

      const padX = 5;
      const w = label.width + padX * 2;
      const h = label.height + 2;
      const plate = new Graphics();
      plate.roundRect(px - w / 2 + 2, label.y - 1 + 2, w, h, 3).fill({ color: 0x000000, alpha: 0.25 });
      plate.roundRect(px - w / 2, label.y - 1, w, h, 3).fill({ color: 0xfff8e7 })
        .stroke({ color: PAL.outline, width: 2 });
      stationContainer.addChild(plate);
      stationContainer.addChild(label);
    }

    this.container.addChild(stationContainer);
  }

  destroy() {
    this.unsubscribeMap();
    this.unsubscribeUI();
    const removed = this.container.removeChildren();
    for (const child of removed) {
      child.destroy({ children: true });
    }
    this.container.destroy();
  }
}
