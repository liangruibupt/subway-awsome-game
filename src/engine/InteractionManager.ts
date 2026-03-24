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
const TRACK_HIT_DIST = 15;    // world pixels — how close a click must be to select a track
const WAYPOINT_HIT_RADIUS = 10; // world pixels — how close a click must be to grab a waypoint

/** Point-to-segment distance used for track hit-testing. */
function pointToSegmentDist(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

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

  // Edit tool state
  private editSelectedTrackId: string | null = null;
  private editDragWaypointIdx: number | null = null;
  private editDragPath: { x: number; y: number }[] | null = null;
  private editHandlesGraphics: Graphics;

  // Quadtree
  private stationQuadtree: Quadtree;
  private unsubscribeMapStore: () => void;
  private unsubscribeUIStore: () => void;

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

    this.editHandlesGraphics = new Graphics();
    pixiApp.worldContainer.addChild(this.editHandlesGraphics);

    this.stationQuadtree = new Quadtree({ x: 0, y: 0, w: WORLD_SIZE, h: WORLD_SIZE });
    this.rebuildQuadtree();
    this.unsubscribeMapStore = useMapStore.subscribe((state, prev) => {
      if (state.stations !== prev.stations) {
        this.rebuildQuadtree();
      }
      // Re-render handles when tracks update (e.g. after path commit)
      if (state.tracks !== prev.tracks && this.editSelectedTrackId !== null) {
        this.editDragPath = null;
        this.renderEditHandles();
      }
    });
    this.unsubscribeUIStore = useUIStore.subscribe((state, prev) => {
      // Clear edit selection when switching away from the edit tool
      if (state.tool !== prev.tool && state.tool !== 'edit') {
        this.editSelectedTrackId = null;
        this.editDragWaypointIdx = null;
        this.editDragPath = null;
        this.editHandlesGraphics.clear();
      }
    });

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('dblclick', this.handleDblClick);
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
    } else if (tool === 'edit') {
      const world = this.camera.screenToWorld(screenX, screenY);
      this.handleEditPointerDown(world.x, world.y);
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

    // Handle edit tool — drag a waypoint
    if (tool === 'edit' && this.editDragWaypointIdx !== null && this.editDragPath !== null) {
      const world = this.camera.screenToWorld(screenX, screenY);
      const snappedX = snapToGrid(world.x, GRID_SIZE);
      const snappedY = snapToGrid(world.y, GRID_SIZE);
      const gridX = Math.round(snappedX / GRID_SIZE);
      const gridY = Math.round(snappedY / GRID_SIZE);
      this.editDragPath[this.editDragWaypointIdx] = { x: gridX, y: gridY };
      this.renderEditHandles();
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

    if (tool === 'edit') {
      // Commit waypoint drag if one was in progress
      if (
        this.editDragWaypointIdx !== null &&
        this.editDragPath !== null &&
        this.editSelectedTrackId !== null
      ) {
        useMapStore.getState().updateTrackPath(this.editSelectedTrackId, this.editDragPath);
        // editDragPath and editDragWaypointIdx are cleared by the mapStore subscriber
        this.editDragWaypointIdx = null;
        this.editDragPath = null;
        this.renderEditHandles();
      }
      return;
    }

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

  // ─── Edit Tool ─────────────────────────────────────────────────────────────

  private handleEditPointerDown(wx: number, wy: number) {
    // 1. Check if clicking near a waypoint of the currently selected track → start drag
    if (this.editSelectedTrackId !== null) {
      const track = useMapStore.getState().tracks.find(t => t.id === this.editSelectedTrackId);
      if (track) {
        const idx = this.findNearestWaypoint(wx, wy, track.path);
        if (idx !== null) {
          this.editDragWaypointIdx = idx;
          this.editDragPath = track.path.map(p => ({ ...p }));
          return;
        }
      }
    }

    // 2. If a track is selected and the click is near a segment (not near a handle) → insert waypoint
    if (this.editSelectedTrackId !== null) {
      const track = useMapStore.getState().tracks.find(t => t.id === this.editSelectedTrackId);
      if (track) {
        const segIdx = this.findNearestSegment(wx, wy, track.path);
        if (segIdx !== null) {
          const snappedX = snapToGrid(wx, GRID_SIZE);
          const snappedY = snapToGrid(wy, GRID_SIZE);
          const gridX = Math.round(snappedX / GRID_SIZE);
          const gridY = Math.round(snappedY / GRID_SIZE);
          const newPath = [
            ...track.path.slice(0, segIdx + 1),
            { x: gridX, y: gridY },
            ...track.path.slice(segIdx + 1),
          ];
          useMapStore.getState().updateTrackPath(this.editSelectedTrackId!, newPath);
          this.renderEditHandles();
          return;
        }
      }
    }

    // 3. Check if clicking near any track segment → select that track
    const trackId = this.findNearestTrack(wx, wy);
    if (trackId !== null) {
      this.editSelectedTrackId = trackId;
      this.editDragWaypointIdx = null;
      this.editDragPath = null;
      this.renderEditHandles();
      return;
    }

    // 4. Clicked empty space → deselect
    this.editSelectedTrackId = null;
    this.editDragWaypointIdx = null;
    this.editDragPath = null;
    this.editHandlesGraphics.clear();
  }

  private findNearestTrack(wx: number, wy: number): string | null {
    const tracks = useMapStore.getState().tracks;
    let bestId: string | null = null;
    let bestDist = TRACK_HIT_DIST;

    for (const track of tracks) {
      const path = track.path;
      for (let i = 0; i + 1 < path.length; i++) {
        const x1 = path[i].x * GRID_SIZE;
        const y1 = path[i].y * GRID_SIZE;
        const x2 = path[i + 1].x * GRID_SIZE;
        const y2 = path[i + 1].y * GRID_SIZE;
        const dist = pointToSegmentDist(wx, wy, x1, y1, x2, y2);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = track.id;
        }
      }
    }
    return bestId;
  }

  private findNearestWaypoint(
    wx: number, wy: number,
    path: { x: number; y: number }[],
  ): number | null {
    for (let i = 0; i < path.length; i++) {
      const px = path[i].x * GRID_SIZE;
      const py = path[i].y * GRID_SIZE;
      const dist = Math.sqrt((wx - px) ** 2 + (wy - py) ** 2);
      if (dist <= WAYPOINT_HIT_RADIUS) return i;
    }
    return null;
  }

  private findNearestSegment(
    wx: number, wy: number,
    path: { x: number; y: number }[],
  ): number | null {
    let bestIdx: number | null = null;
    let bestDist = TRACK_HIT_DIST;
    for (let i = 0; i + 1 < path.length; i++) {
      const x1 = path[i].x * GRID_SIZE;
      const y1 = path[i].y * GRID_SIZE;
      const x2 = path[i + 1].x * GRID_SIZE;
      const y2 = path[i + 1].y * GRID_SIZE;
      const dist = pointToSegmentDist(wx, wy, x1, y1, x2, y2);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private renderEditHandles() {
    this.editHandlesGraphics.clear();
    if (this.editSelectedTrackId === null) return;

    const tracks = useMapStore.getState().tracks;
    const track = tracks.find(t => t.id === this.editSelectedTrackId);
    if (!track) return;

    // During a drag, show the preview path; otherwise show the committed path
    const path = this.editDragPath ?? track.path;

    // Draw the preview path line in cyan
    if (path.length >= 2) {
      this.editHandlesGraphics.moveTo(path[0].x * GRID_SIZE, path[0].y * GRID_SIZE);
      for (let i = 1; i < path.length; i++) {
        this.editHandlesGraphics.lineTo(path[i].x * GRID_SIZE, path[i].y * GRID_SIZE);
      }
      this.editHandlesGraphics.stroke({ color: '#00ffff', width: 2, alpha: 0.6 });
    }

    // Draw a handle circle at each waypoint
    for (let i = 0; i < path.length; i++) {
      const px = path[i].x * GRID_SIZE;
      const py = path[i].y * GRID_SIZE;
      const isActive = i === this.editDragWaypointIdx;
      // Active (dragging) handle: gold; resting handles: cyan
      const color = isActive ? '#ffd700' : '#00ffff';
      this.editHandlesGraphics.circle(px, py, 5).fill({ color, alpha: 1 });
    }
  }

  private handleDblClick = (e: MouseEvent) => {
    const tool = useUIStore.getState().tool;
    if (tool !== 'edit' || this.editSelectedTrackId === null) return;

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = this.camera.screenToWorld(screenX, screenY);

    const track = useMapStore.getState().tracks.find(t => t.id === this.editSelectedTrackId);
    if (!track || track.path.length <= 2) return;

    const idx = this.findNearestWaypoint(world.x, world.y, track.path);
    if (idx === null) return;
    if (idx === 0 || idx === track.path.length - 1) return; // don't delete endpoints

    const newPath = track.path.filter((_, i) => i !== idx);
    useMapStore.getState().updateTrackPath(this.editSelectedTrackId!, newPath);
  };

  // ─── Quadtree ──────────────────────────────────────────────────────────────

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
    this.canvas.removeEventListener('dblclick', this.handleDblClick);
    this.unsubscribeMapStore();
    this.unsubscribeUIStore();
    this.previewGraphics.destroy();
    this.editHandlesGraphics.destroy();
  }
}
