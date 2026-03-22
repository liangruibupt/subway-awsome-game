import { Container, Graphics, Text } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import { useMapStore } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
import type { Station } from '../types';

const GRID_SIZE = 30;

// Normal station dimensions
const NORMAL_OUTER_RADIUS = 8;
const NORMAL_INNER_RADIUS = 3;
const NORMAL_COLOR = 0x00cec9;
const NORMAL_TEXT_COLOR = '#81ecec';

// Interchange station dimensions
const INTERCHANGE_OUTER_RADIUS = 12;
const INTERCHANGE_INNER_RADIUS = 5;
const INTERCHANGE_COLOR = 0xffd93d;
const INTERCHANGE_TEXT_COLOR = '#ffeaa7';

// Glow extra radius
const GLOW_EXTRA = 6;
const GLOW_ALPHA = 0.15;

const STATION_FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const STATION_FONT_SIZE = 10;

export class StationRenderer {
  private container: Container;
  private unsubscribeMap: () => void;
  private unsubscribeUI: () => void;

  constructor(pixiApp: PixiApp) {
    this.container = new Container();
    // Add after grid (index 0) so stations render on top of grid
    pixiApp.worldContainer.addChild(this.container);

    // Re-render whenever stations change
    this.unsubscribeMap = useMapStore.subscribe(() => this.render());

    // Re-render on zoom change (LOD update)
    this.unsubscribeUI = useUIStore.subscribe(() => this.render());

    this.render();
  }

  render() {
    // Destroy previous visuals to free GPU memory
    const removed = this.container.removeChildren();
    for (const child of removed) {
      child.destroy({ children: true });
    }

    const stations = useMapStore.getState().stations;
    const zoom = useUIStore.getState().zoomLevel;
    const selectedId = useUIStore.getState().selectedStationId;

    for (const station of stations) {
      this.renderStation(station, zoom, station.id === selectedId);
    }
  }

  private renderStation(station: Station, zoom: number, isSelected: boolean) {
    // World-space pixel position (station.x/y are grid indices)
    const px = station.x * GRID_SIZE;
    const py = station.y * GRID_SIZE;

    const isInterchange = station.type === 'interchange';
    const isTerminal = station.type === 'terminal';

    const outerRadius = isInterchange ? INTERCHANGE_OUTER_RADIUS : NORMAL_OUTER_RADIUS;
    const innerRadius = isInterchange ? INTERCHANGE_INNER_RADIUS : NORMAL_INNER_RADIUS;
    const color = isInterchange ? INTERCHANGE_COLOR : NORMAL_COLOR;
    const textColor = isInterchange ? INTERCHANGE_TEXT_COLOR : NORMAL_TEXT_COLOR;

    if (zoom < 0.25) {
      // Tiny dots only — no glow, no labels
      const g = new Graphics();
      g.circle(px, py, 2).fill({ color, alpha: 1 });
      this.container.addChild(g);
      return;
    }

    if (zoom < 0.5) {
      // Reduced detail: smaller circles, no labels
      const smallOuter = outerRadius * 0.6;
      const smallInner = innerRadius * 0.6;
      const g = new Graphics();
      // Subtle glow
      g.circle(px, py, smallOuter + 3).fill({ color, alpha: 0.1 });
      // Outer ring
      g.circle(px, py, smallOuter).stroke({ color, width: 1.5, alpha: 1 });
      // Inner dot
      g.circle(px, py, smallInner).fill({ color, alpha: 1 });
      this.container.addChild(g);
      return;
    }

    // Full detail: glow + rings + name label
    const stationContainer = new Container();

    const g = new Graphics();

    // Glow — wider semi-transparent circle behind the main shape
    g.circle(px, py, outerRadius + GLOW_EXTRA).fill({ color, alpha: GLOW_ALPHA });

    // Outer ring (stroke only, no fill)
    g.circle(px, py, outerRadius).stroke({ color, width: 2, alpha: 1 });

    // Inner filled dot
    g.circle(px, py, innerRadius).fill({ color, alpha: 1 });

    // Terminal indicator: small square end-cap below the circle
    if (isTerminal) {
      const capW = 8;
      const capH = 4;
      g.rect(px - capW / 2, py + outerRadius + 2, capW, capH).fill({ color, alpha: 1 });
    }

    // Selected station: extra outer ring to highlight it
    if (isSelected) {
      g.circle(px, py, outerRadius + 4).stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });
    }

    stationContainer.addChild(g);

    // Station name label — centered above the circle
    const label = new Text({
      text: station.name,
      style: {
        fontFamily: STATION_FONT_FAMILY,
        fontSize: STATION_FONT_SIZE,
        fill: textColor,
      },
    });
    label.anchor.set(0.5, 1); // horizontal center, bottom-aligned
    label.x = px;
    label.y = py - outerRadius - 3;
    stationContainer.addChild(label);

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
