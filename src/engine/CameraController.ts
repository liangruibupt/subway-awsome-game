import { useUIStore } from '../stores/uiStore';
import type { PixiApp } from './PixiApp';
import type { GridRenderer } from './GridRenderer';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const GRID_SIZE = 30;

export class CameraController {
  private pixiApp: PixiApp;
  private gridRenderer: GridRenderer;
  private canvas: HTMLCanvasElement;

  private isPanning = false;
  private panButton = -1; // which mouse button started the pan (-1 = none)
  private isSpaceHeld = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Touch state
  private touches: Map<number, { x: number; y: number }> = new Map();
  private lastPinchDistance = 0;

  constructor(pixiApp: PixiApp, gridRenderer: GridRenderer) {
    this.pixiApp = pixiApp;
    this.gridRenderer = gridRenderer;
    this.canvas = pixiApp.app.canvas as HTMLCanvasElement;

    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd);

    // Use window so drag continues even if pointer leaves the canvas
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  /** Converts canvas-relative screen coordinates to world coordinates. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const wc = this.pixiApp.worldContainer;
    const scale = wc.scale.x;
    return {
      x: (screenX - wc.x) / scale,
      y: (screenY - wc.y) / scale,
    };
  }

  /** Re-renders the grid to match the current viewport. Call after any pan/zoom. */
  updateGrid() {
    const wc = this.pixiApp.worldContainer;
    const scale = wc.scale.x;
    const screen = this.pixiApp.app.screen;

    const viewportX = -wc.x / scale;
    const viewportY = -wc.y / scale;
    const viewportWidth = screen.width / scale;
    const viewportHeight = screen.height / scale;

    this.gridRenderer.render(viewportX, viewportY, viewportWidth, viewportHeight, scale);
    useUIStore.getState().setCameraPos(wc.x, wc.y);
  }

  /** Pan the camera so that the given world-pixel point is centred on screen. */
  jumpTo(worldX: number, worldY: number) {
    const wc = this.pixiApp.worldContainer;
    const scale = wc.scale.x;
    const screen = this.pixiApp.app.screen;
    wc.x = screen.width / 2 - worldX * scale;
    wc.y = screen.height / 2 - worldY * scale;
    this.updateGrid();
  }

  // ─── Zoom ────────────────────────────────────────────────────────────────

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    const wc = this.pixiApp.worldContainer;
    const currentScale = wc.scale.x;

    // 10% zoom per scroll step, direction matches scroll direction
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentScale * factor));

    // Mouse position relative to the canvas element
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // World coordinate currently under the mouse
    const worldX = (screenX - wc.x) / currentScale;
    const worldY = (screenY - wc.y) / currentScale;

    // Shift the container so that same world point stays under the mouse
    wc.x = screenX - worldX * newScale;
    wc.y = screenY - worldY * newScale;
    wc.scale.set(newScale);

    useUIStore.getState().setZoom(newScale);
    this.updateGrid();
  };

  // ─── Pan (pointer) ───────────────────────────────────────────────────────

  private handlePointerDown = (e: PointerEvent) => {
    const isMiddle = e.button === 1;
    const isSpaceLeft = e.button === 0 && this.isSpaceHeld;

    if (isMiddle || isSpaceLeft) {
      this.isPanning = true;
      this.panButton = e.button;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      e.preventDefault();
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    const wc = this.pixiApp.worldContainer;
    const scale = wc.scale.x;

    if (this.isPanning) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      wc.x += dx;
      wc.y += dy;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.updateGrid();
    }

    // Track world-space mouse position for BottomBar display
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - wc.x) / scale;
    const worldY = (screenY - wc.y) / scale;
    const gridX = Math.floor(worldX / GRID_SIZE);
    const gridY = Math.floor(worldY / GRID_SIZE);

    useUIStore.getState().setMouseGrid(gridX, gridY);
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (e.button === this.panButton) {
      this.isPanning = false;
      this.panButton = -1;
    }
  };

  // ─── Keyboard ────────────────────────────────────────────────────────────

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      this.isSpaceHeld = true;
      // Prevent spacebar from scrolling the page while in the game
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      this.isSpaceHeld = false;
      // Stop a space-initiated pan when space is released
      if (this.panButton === 0) {
        this.isPanning = false;
        this.panButton = -1;
      }
    }
  };

  // ─── Touch (pinch zoom + two-finger pan) ─────────────────────────────────

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      this.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (this.touches.size === 2) {
      const [t1, t2] = Array.from(this.touches.values());
      this.lastPinchDistance = Math.hypot(t2.x - t1.x, t2.y - t1.y);
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();

    const prevTouches = new Map(this.touches);
    for (const t of Array.from(e.changedTouches)) {
      this.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }

    if (this.touches.size === 2) {
      const [t1, t2] = Array.from(this.touches.values());
      const [p1, p2] = Array.from(prevTouches.values());
      const wc = this.pixiApp.worldContainer;

      // Pinch zoom
      const newDist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
      if (this.lastPinchDistance > 0) {
        const currentScale = wc.scale.x;
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentScale * (newDist / this.lastPinchDistance)));

        const rect = this.canvas.getBoundingClientRect();
        const cx = (t1.x + t2.x) / 2 - rect.left;
        const cy = (t1.y + t2.y) / 2 - rect.top;
        const worldX = (cx - wc.x) / currentScale;
        const worldY = (cy - wc.y) / currentScale;

        wc.x = cx - worldX * newScale;
        wc.y = cy - worldY * newScale;
        wc.scale.set(newScale);
        useUIStore.getState().setZoom(newScale);
      }
      this.lastPinchDistance = newDist;

      // Two-finger pan (centroid movement)
      if (p1 && p2) {
        const prevCx = (p1.x + p2.x) / 2;
        const prevCy = (p1.y + p2.y) / 2;
        const newCx = (t1.x + t2.x) / 2;
        const newCy = (t1.y + t2.y) / 2;
        wc.x += newCx - prevCx;
        wc.y += newCy - prevCy;
      }

      this.updateGrid();
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      this.touches.delete(t.identifier);
    }
    if (this.touches.size < 2) {
      this.lastPinchDistance = 0;
    }
  };

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  destroy() {
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
