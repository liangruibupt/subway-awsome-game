import { useEffect, useRef, useState } from 'react';
import { PixiApp } from '../../engine/PixiApp';
import { GridRenderer } from '../../engine/GridRenderer';
import { CameraController } from '../../engine/CameraController';
import { StationRenderer } from '../../engine/StationRenderer';
import { TrackRenderer } from '../../engine/TrackRenderer';
import { InteractionManager } from '../../engine/InteractionManager';
import { AssemblyRenderer } from '../../engine/AssemblyRenderer';
import { StationNameDialog } from '../track-design/StationNameDialog';
import { useMapStore } from '../../stores/mapStore';
import { useUIStore } from '../../stores/uiStore';

interface PendingStation {
  gridX: number;
  gridY: number;
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Read the current game mode so the effect re-runs on mode change
  const mode = useUIStore((state) => state.mode);

  // Dialog state — lives in React so the overlay re-renders correctly
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<PendingStation>({ gridX: 0, gridY: 0 });

  // Stable ref to the "open dialog" callback so InteractionManager can call
  // it without needing a re-render or stale-closure issues.
  const openDialogRef = useRef<(gridX: number, gridY: number) => void>(() => {});

  // Holds the promise for the current init cycle so that a strict-mode re-run
  // waits for the previous init to finish and release the WebGL context before
  // starting a new one.
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
        pixiApp.destroy();
        resolveThisDone();
        return;
      }

      if (mode === 'assembly') {
        // ── Assembly mode: dark background + 2.5D turntable renderer ──────────
        pixiApp.app.renderer.background.color = 0x1a1a2e;

        const assemblyRenderer = new AssemblyRenderer(pixiApp);
        assemblyRenderer.init();

        cleanupFn = () => {
          assemblyRenderer.destroy();
          pixiApp.destroy();
          resolveThisDone();
        };
      } else {
        // ── Track-design / simulation mode: blueprint grid + station/track renderers
        pixiApp.app.renderer.background.color = 0x0a1628;

        const grid = new GridRenderer(pixiApp);
        const camera = new CameraController(pixiApp, grid);
        camera.updateGrid();

        // Renders tracks; subscribes to mapStore & uiStore internally
        // Created before StationRenderer so tracks appear below stations
        const trackRenderer = new TrackRenderer(pixiApp);

        // Renders stations; subscribes to mapStore & uiStore internally
        const stationRenderer = new StationRenderer(pixiApp);

        // Handles canvas click interactions; calls openDialogRef when placing stations
        const interaction = new InteractionManager(pixiApp, camera, (gridX, gridY) => {
          openDialogRef.current(gridX, gridY);
        });

        cleanupFn = () => {
          interaction.destroy();
          stationRenderer.destroy();
          trackRenderer.destroy();
          camera.destroy();
          pixiApp.destroy();
          resolveThisDone();
        };
      }
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
  }, [mode]); // re-run whenever the game mode changes

  // Keep the stable ref up-to-date with the current state setters.
  useEffect(() => {
    openDialogRef.current = (gridX: number, gridY: number) => {
      setPending({ gridX, gridY });
      setDialogOpen(true);
    };
  });

  const handleDialogConfirm = (name: string) => {
    useMapStore.getState().addStation(name, pending.gridX, pending.gridY);
    setDialogOpen(false);
  };

  const handleDialogCancel = () => {
    setDialogOpen(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* Station naming dialog — only shown in track-design / simulation modes */}
      {mode !== 'assembly' && (
        <StationNameDialog
          isOpen={dialogOpen}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
          position={{ x: pending.gridX, y: pending.gridY }}
        />
      )}
    </div>
  );
}
