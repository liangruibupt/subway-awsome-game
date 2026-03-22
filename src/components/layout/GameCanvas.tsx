import { useEffect, useRef } from 'react';
import { PixiApp } from '../../engine/PixiApp';
import { GridRenderer } from '../../engine/GridRenderer';
import { CameraController } from '../../engine/CameraController';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Holds the promise for the current init cycle so that a strict-mode re-run
  // waits for the previous init to finish and release the WebGL context before
  // starting a new one.  Without this, both PixiJS instances share (then
  // corrupt) the same canvas context.
  const prevInitDoneRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    // Capture the previous cycle's "done" promise before overwriting the ref.
    const prevDone = prevInitDoneRef.current;
    let resolveThisDone!: () => void;
    prevInitDoneRef.current = new Promise<void>((res) => { resolveThisDone = res; });

    const run = async () => {
      // Block until the previous PixiApp has finished destroying itself so its
      // WebGL context is fully released before we create a new one.
      await prevDone;

      if (cancelled) {
        resolveThisDone();
        return;
      }

      const pixiApp = new PixiApp();
      try {
        await pixiApp.init(canvas);
      } catch (err) {
        console.error('PixiApp init error:', err);
        resolveThisDone();
        return;
      }

      if (cancelled) {
        pixiApp.destroy();   // release WebGL context before next cycle starts
        resolveThisDone();
        return;
      }

      const grid = new GridRenderer(pixiApp);
      const camera = new CameraController(pixiApp, grid);
      camera.updateGrid();

      cleanupFn = () => {
        camera.destroy();
        pixiApp.destroy();
        resolveThisDone();
      };
    };

    run();

    return () => {
      cancelled = true;
      if (cleanupFn) {
        cleanupFn();
        cleanupFn = null;
      } else {
        // run() hasn't finished yet; resolveThisDone will be called from within
        // run() once it notices cancelled === true.
      }
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
