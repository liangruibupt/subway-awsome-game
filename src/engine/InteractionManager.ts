import { Graphics } from 'pixi.js';
import type { PixiApp } from './PixiApp';
import type { CameraController } from './CameraController';
import { useUIStore } from '../stores/uiStore';
import { useMapStore } from '../stores/mapStore';
import { snapToGrid } from '../utils/grid';
import { Quadtree } from './Quadtree';

const GRID_SIZE = 30;
const WORLD_SIZE = 10_000;
const HIT_RADIUS = 20;

type StationPlacementCallback = (gridX: number, gridY: number) => void;

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private camera: CameraController;
  private onStationPlacement: StationPlacementCallback;

  // Connect tool state
  private connectSourceId: string | null = null;
  private previewGraphics: Graphics;
  private mouseWorldX = 0;
  private mouseWorldY = 0;

  // Drag-to-move state
  private draggingStationId: string | null = null;
  private dragStarted = false;
  private pointerDownX = 0;
  private pointerDownY = 0;

  // Quadtree
  private stationQuadtree: Quadtree;
  private unsubscribeMapStore: () => void;

  constructor(
    pixiApp: PixiApp,
    camera: CameraController,
    onStationPlacement: StationPlacementCallback,
  ) {
    this.canvas = pixiApp.app.canvas as HTMLCanvasElement;
    this.camera = camera;
    this.onStationPlacement = onStationPlacement;

    this.previewGraphics = new Graphics();
    pixiApp.worldContainer.addChild(this.previewGraphics);

    this.stationQuadtree = new Quadtree({ x: 0, y: 0, w: WORLD_SIZE, h: WORLD_SIZE });
    this.rebuildQuadtree();
    this.unsubscribeMapStore = useMapStore.subscribe((state, prev) => {
      if (state.stations !== prev.stations) {
        this.rebuildQuadtree();
      }
    });

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const tool = useUIStore.getState().tool;

    this.pointerDownX = e.clientX;
    this.pointerDownY = e.clientY;
    this.dragStarted = false;

    if (tool === 'station') {
      // Check if clicking on an existing station → start drag
      const world = this.camera.screenToWorld(screenX, screenY);
      const hit = this.stationQuadtree.findNearest(world.x, world.y, HIT_RADIUS);
      if (hit) {
        this.draggingStationId = hit.id;
        useUIStore.getState().selectStation(hit.id);
        return;
      }
      // No station nearby — will create new one on pointerup (if no drag happened)
    } else if (tool === 'delete') {
      this.handleDelete(screenX, screenY);
    } else if (tool === 'connect') {
      this.handleConnect(screenX, screenY);
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    const tool = useUIStore.getState().tool;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Handle station dragging
    if (this.draggingStationId && tool === 'station') {
      const dx = Math.abs(e.clientX - this.pointerDownX);
      const dy = Math.abs(e.clientY - this.pointerDownY);
      if (dx > 3 || dy > 3) this.dragStarted = true;

      if (this.dragStarted) {
        const world = this.camera.screenToWorld(screenX, screenY);
        const snappedX = snapToGrid(world.x, GRID_SIZE);
        const snappedY = snapToGrid(world.y, GRID_SIZE);
        const gridX = Math.round(snappedX / GRID_SIZE);
        const gridY = Math.round(snappedY / GRID_SIZE);
        useMapStore.getState().moveStation(this.draggingStationId, gridX, gridY);
      }
      return;
    }

    // Handle connect preview
    if (tool === 'connect') {
      const world = this.camera.screenToWorld(screenX, screenY);
      this.mouseWorldX = snapToGrid(world.x, GRID_SIZE);
      this.mouseWorldY = snapToGrid(world.y, GRID_SIZE);
      this.renderPreview();
    } else {
      this.previewGraphics.clear();
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    const tool = useUIStore.getState().tool;

    if (tool === 'station') {
      if (this.draggingStationId) {
        // Was dragging — just release
        this.draggingStationId = null;
        if (!this.dragStarted) {
          // Clicked on station without dragging — just select it (already done in pointerdown)
        }
        this.dragStarted = false;
        return;
      }

      // Clicked empty space (no station was under cursor at pointerdown) → create new station
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      this.handleStationPlacement(screenX, screenY);
    }

    this.draggingStationId = null;
    this.dragStarted = false;
  };

  private handleStationPlacement(screenX: number, screenY: number) {
    const world = this.camera.screenToWorld(screenX, screenY);
    const snappedX = snapToGrid(world.x, GRID_SIZE);
    const snappedY = snapToGrid(world.y, GRID_SIZE);
    const gridX = Math.round(snappedX / GRID_SIZE);
    const gridY = Math.round(snappedY / GRID_SIZE);
    this.onStationPlacement(gridX, gridY);
  }

  private handleDelete(screenX: number, screenY: number) {
    const world = this.camera.screenToWorld(screenX, screenY);
    const hit = this.stationQuadtree.findNearest(world.x, world.y, HIT_RADIUS);
    if (hit) {
      useMapStore.getState().deleteStation(hit.id);
      if (useUIStore.getState().selectedStationId === hit.id) {
        useUIStore.getState().selectStation(null);
      }
    }
  }

  private handleConnect(screenX: number, screenY: number) {
    const world = this.camera.screenToWorld(screenX, screenY);
    const hit = this.stationQuadtree.findNearest(world.x, world.y, HIT_RADIUS);
    const nearestId = hit ? hit.id : null;

    if (nearestId === null) {
      this.connectSourceId = null;
      useUIStore.getState().selectStation(null);
      this.previewGraphics.clear();
      return;
    }

    if (this.connectSourceId === null) {
      this.connectSourceId = nearestId;
      useUIStore.getState().selectStation(nearestId);
      return;
    }

    if (nearestId === this.connectSourceId) {
      this.connectSourceId = null;
      useUIStore.getState().selectStation(null);
      this.previewGraphics.clear();
      return;
    }

    const { lines, addTrack } = useMapStore.getState();
    if (lines.length === 0) {
      console.warn('No lines exist. Create a line first before connecting stations.');
      this.connectSourceId = null;
      useUIStore.getState().selectStation(null);
      this.previewGraphics.clear();
      return;
    }

    // Use selected line, or fall back to first line
    const selectedLineId = useUIStore.getState().selectedLineId;
    const activeLineId = selectedLineId && lines.find(l => l.id === selectedLineId)
      ? selectedLineId
      : lines[0].id;
    addTrack(activeLineId, this.connectSourceId, nearestId);

    this.connectSourceId = null;
    useUIStore.getState().selectStation(null);
    this.previewGraphics.clear();
  }

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

  private renderPreview() {
    this.previewGraphics.clear();
    if (this.connectSourceId === null) return;

    const stations = useMapStore.getState().stations;
    const source = stations.find((s) => s.id === this.connectSourceId);
    if (!source) return;

    const lines = useMapStore.getState().lines;
    const selectedLineId = useUIStore.getState().selectedLineId;
    const activeLine = selectedLineId ? lines.find(l => l.id === selectedLineId) : lines[0];
    const activeLineColor = activeLine?.color ?? '#ffffff';

    const sx = source.x * GRID_SIZE;
    const sy = source.y * GRID_SIZE;
    const tx = this.mouseWorldX;
    const ty = this.mouseWorldY;

    const DASH_LEN = 10;
    const GAP_LEN = 6;
    const mx = tx;
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
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.unsubscribeMapStore();
    this.previewGraphics.destroy();
  }
}
