import type { PixiApp } from './PixiApp';
import type { CameraController } from './CameraController';
import { useUIStore } from '../stores/uiStore';
import { useMapStore } from '../stores/mapStore';
import { snapToGrid } from '../utils/grid';

const GRID_SIZE = 30;

/**
 * Click radius (in world-space pixels) within which a station is considered
 * "hit" for the delete tool.  A simple distance check is used here; Task 9
 * will upgrade this to a quadtree for large maps.
 */
const DELETE_HIT_RADIUS = 20;

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

  constructor(
    pixiApp: PixiApp,
    camera: CameraController,
    onStationPlacement: StationPlacementCallback,
  ) {
    this.canvas = pixiApp.app.canvas as HTMLCanvasElement;
    this.camera = camera;
    this.onStationPlacement = onStationPlacement;

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
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
    }
    // 'pan', 'connect', 'edit': no-op here — handled elsewhere
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

    const stations = useMapStore.getState().stations;

    let nearestId: string | null = null;
    let nearestDist = DELETE_HIT_RADIUS; // only match within this radius

    for (const station of stations) {
      // station.x/y are grid indices; convert to world pixels for comparison
      const stationPx = station.x * GRID_SIZE;
      const stationPy = station.y * GRID_SIZE;
      const dist = Math.hypot(stationPx - world.x, stationPy - world.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = station.id;
      }
    }

    if (nearestId !== null) {
      useMapStore.getState().deleteStation(nearestId);
    }
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
  }
}
