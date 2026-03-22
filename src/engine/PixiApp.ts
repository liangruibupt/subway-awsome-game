import { Application, Container } from 'pixi.js';

export class PixiApp {
  app: Application;
  worldContainer: Container;
  private _initDone = false;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
  }

  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      resizeTo: canvas.parentElement!,
      backgroundColor: 0x0a1628,
      antialias: true,
    });
    this.app.stage.addChild(this.worldContainer);
    this._initDone = true;
  }

  destroy() {
    // Guard: don't call app.destroy() if init() hasn't set up the resize observer yet.
    // This happens in React strict mode when cleanup runs before the async init resolves.
    if (!this._initDone) return;
    this.app.destroy(true);
  }
}
