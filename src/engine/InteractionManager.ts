import { Graphics } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import type { CameraController } from './CameraController';
import { useUIStore } from '../stores/uiStore';
import { useMapStore } from '../stores/mapStore';
import { snapToGrid } from '../utils/grid';
import { Quadtree } from './Quadtree';

const GRID_SIZE = 30;

/** Large enough to encompass the entire playable world in world-space pixels. */
const WORLD_SIZE = 10_000;

/**
 * Click radius (in world-space pixels) within which a station is considered
 * "hit" for the delete tool.
 */
const DELETE_HIT_RADIUS = 20;

/** Same radius used for the connect tool to pick a station. */
const CONNECT_HIT_RADIUS = 20;

/** Callback called when the station tool is active and the user clicks a grid point. */
type StationPlacementCallback = (gridX: number, gridY: number) => void;

/**
 * InteractionManager attaches to the PixiJS canvas and routes pointer events
 * to the appropriate game action based on the currently selected tool.
 */
export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private camera: CameraController;
  private onStationPlacement: StationPlacementCallback;

  /** ID of the first station clicked when using the connect tool. */
  private connectSourceId: string | null = null;

  /** PixiJS graphics object used to draw the dashed preview line. */
  private previewGraphics: Graphics;

  /** Current mouse position in world-space (updated on pointermove). */
  private mouseWorldX = 0;
  private mouseWorldY = 0;

  /** Spatial index of station world-pixel positions for O(log n) hit testing. */
  private stationQuadtree: Quadtree;

  /** Unsubscribe function for the mapStore subscription. */
  private unsubscribeMapStore: () => void;

  constructor(
    pixiApp: PixiApp,
    camera: CameraController,
    onStationPlacement: StationPlacementCallback,
  ) {
    this.canvas = pixiApp.app.canvas as HTMLCanvasElement;
    this.camera = camera;
    this.onStationPlacement = onStationPlacement;

    // Preview line graphics — sits on top of everything in world space
    this.previewGraphics = new Graphics();
    pixiApp.worldContainer.addChild(this.previewGraphics);

    // Build quadtree from current stations and subscribe to future changes
    this.stationQuadtree = new Quadtree({ x: 0, y: 0, w: WORLD_SIZE, h: WORLD_SIZE });
    this.rebuildQuadtree();
    this.unsubscribeMapStore = useMapStore.subscribe((state, prev) => {
      if (state.stations !== prev.stations) {
        this.rebuildQuadtree();
      }
    });

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
  }

  private handlePointerDown = (e: PointerEvent) => {
    // Only handle primary (left) mouse button
    if (e.button !== 0) return;

    const tool = useUIStore.getState().tool;

    // Convert client coordinates to canvas-local coordinates
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (tool === 'station') {
      this.handleStationPlacement(screenX, screenY);
    } else if (tool === 'delete') {
      this.handleDelete(screenX, screenY);
    } else if (tool === 'connect') {
      this.handleConnect(screenX, screenY);
    }
    // 'pan', 'edit': no-op here — handled elsewhere
  };

  private handlePointerMove = (e: PointerEvent) => {
    const tool = useUIStore.getState().tool;
    if (tool !== 'connect') {
      this.previewGraphics.clear();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = this.camera.screenToWorld(screenX, screenY);

    // Snap mouse position to grid for a clean preview
    const snappedX = snapToGrid(world.x, GRID_SIZE);
    const snappedY = snapToGrid(world.y, GRID_SIZE);
    this.mouseWorldX = snappedX;
    this.mouseWorldY = snappedY;

    this.renderPreview();
  };

  private handleStationPlacement(screenX: number, screenY: number) {
    // Screen → world pixel coordinates
    const world = this.camera.screenToWorld(screenX, screenY);

    // Snap world pixel coords to the nearest grid intersection
    const snappedX = snapToGrid(world.x, GRID_SIZE);
    const snappedY = snapToGrid(world.y, GRID_SIZE);

    // Convert snapped pixel coordinates to grid indices (integers)
    const gridX = Math.round(snappedX / GRID_SIZE);
    const gridY = Math.round(snappedY / GRID_SIZE);

    this.onStationPlacement(gridX, gridY);
  }

  private handleDelete(screenX: number, screenY: number) {
    // Screen → world pixel coordinates
    const world = this.camera.screenToWorld(screenX, screenY);

    const hit = this.stationQuadtree.findNearest(world.x, world.y, DELETE_HIT_RADIUS);

    if (hit !== null) {
      useMapStore.getState().deleteStation(hit.id);
      // Deselect if we just deleted the selected station
      if (useUIStore.getState().selectedStationId === hit.id) {
        useUIStore.getState().selectStation(null);
      }
    }
  }

  private handleConnect(screenX: number, screenY: number) {
    const world = this.camera.screenToWorld(screenX, screenY);

    // Find the nearest station within hit radius via quadtree
    const hit = this.stationQuadtree.findNearest(world.x, world.y, CONNECT_HIT_RADIUS);
    const nearestId = hit ? hit.id : null;

    if (nearestId === null) {
      // Clicked empty space — cancel connection
      this.connectSourceId = null;
      useUIStore.getState().selectStation(null);
      this.previewGraphics.clear();
      return;
    }

    if (this.connectSourceId === null) {
      // First click: set the source station and highlight it
      this.connectSourceId = nearestId;
      useUIStore.getState().selectStation(nearestId);
      return;
    }

    if (nearestId === this.connectSourceId) {
      // Clicked the same station again — cancel
      this.connectSourceId = null;
      useUIStore.getState().selectStation(null);
      this.previewGraphics.clear();
      return;
    }

    // Second click on a different station — create the track
    const { lines, addTrack } = useMapStore.getState();

    // Use the first available line, or do nothing if no lines exist
    if (lines.length === 0) {
      console.warn('No lines exist. Create a line first before connecting stations.');
      this.connectSourceId = null;
      useUIStore.getState().selectStation(null);
      this.previewGraphics.clear();
      return;
    }

    // Use the first line as the active line
    const activeLineId = lines[0].id;

    addTrack(activeLineId, this.connectSourceId, nearestId);

    // Reset state
    this.connectSourceId = null;
    useUIStore.getState().selectStation(null);
    this.previewGraphics.clear();
  }

  /** Rebuild the station quadtree from the current mapStore state. */
  private rebuildQuadtree(): void {
    this.stationQuadtree.clear();
    for (const station of useMapStore.getState().stations) {
      this.stationQuadtree.insert({
        id: station.id,
        x: station.x * GRID_SIZE,
        y: station.y * GRID_SIZE,
      });
    }
  }

  /**
   * Draws a dashed preview line from the source station to the current mouse
   * position when the connect tool is active and a source has been picked.
   */
  private renderPreview() {
    this.previewGraphics.clear();

    if (this.connectSourceId === null) return;

    const stations = useMapStore.getState().stations;
    const source = stations.find((s) => s.id === this.connectSourceId);
    if (!source) return;

    const lines = useMapStore.getState().lines;
    const activeLineColor = lines.length > 0 ? lines[0].color : '#ffffff';

    const sx = source.x * GRID_SIZE;
    const sy = source.y * GRID_SIZE;
    const tx = this.mouseWorldX;
    const ty = this.mouseWorldY;

    // Dashed line: draw short segments manually (PixiJS v8 has no native dash support)
    const DASH_LEN = 10;
    const GAP_LEN = 6;

    // Horizontal segment first (manhattan), then vertical
    const mx = tx; // corner point
    const my = sy;

    this.drawDashedLine(sx, sy, mx, my, DASH_LEN, GAP_LEN, activeLineColor);
    this.drawDashedLine(mx, my, tx, ty, DASH_LEN, GAP_LEN, activeLineColor);
  }

  private drawDashedLine(
    x1: number, y1: number,
    x2: number, y2: number,
    dashLen: number, gapLen: number,
    color: string,
  ) {
    const totalLen = Math.hypot(x2 - x1, y2 - y1);
    if (totalLen < 1) return;

    const dx = (x2 - x1) / totalLen;
    const dy = (y2 - y1) / totalLen;

    let traveled = 0;
    let drawing = true;

    while (traveled < totalLen) {
      const segLen = drawing ? dashLen : gapLen;
      const end = Math.min(traveled + segLen, totalLen);

      if (drawing) {
        const ax = x1 + dx * traveled;
        const ay = y1 + dy * traveled;
        const bx = x1 + dx * end;
        const by = y1 + dy * end;
        this.previewGraphics.moveTo(ax, ay).lineTo(bx, by);
      }

      traveled = end;
      drawing = !drawing;
    }

    if (totalLen > 0) {
      this.previewGraphics.stroke({ color, width: 2, alpha: 0.7 });
    }
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.unsubscribeMapStore();
    this.previewGraphics.destroy();
  }
}
