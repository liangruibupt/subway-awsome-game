import { Application, Container } from 'pixi.js';

/** Module-level singleton — survives React StrictMode double-mounts. */
let instance: PixiApp | null = null;
let initPromise: Promise<PixiApp> | null = null;

export class PixiApp {
  app: Application;
  worldContainer: Container;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
  }

  private async _init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      resizeTo: canvas.parentElement!,
      backgroundColor: 0x0a1628,
      antialias: true,
    });
    this.app.stage.addChild(this.worldContainer);
  }

  /** Remove all children from worldContainer without destroying the app. */
  clearWorld() {
    const removed = this.worldContainer.removeChildren();
    for (const child of removed) {
      child.destroy({ children: true });
    }
  }

  /** Remove all non-worldContainer children from stage. */
  clearStageExtras() {
    const stage = this.app.stage;
    const toRemove = stage.children.filter(c => c !== this.worldContainer);
    for (const child of toRemove) {
      stage.removeChild(child);
      child.destroy({ children: true });
    }
  }

  /**
   * Get or create the singleton PixiApp instance.
   * Safe to call multiple times — returns the same instance.
   */
  static async getInstance(canvas: HTMLCanvasElement): Promise<PixiApp> {
    if (instance && initPromise) {
      return initPromise;
    }
    const app = new PixiApp();
    instance = app;
    initPromise = app._init(canvas).then(() => app);
    return initPromise;
  }

  /** Destroy the singleton. Only call on real unmount. */
  static destroyInstance() {
    if (instance) {
      instance.app.destroy(false);
      instance = null;
      initPromise = null;
    }
  }
}
