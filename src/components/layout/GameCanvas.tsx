import { useEffect, useRef, useState, useCallback } from 'react';
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
  const pixiAppRef = useRef<PixiApp | null>(null);
  const cleanupRenderersRef = useRef<(() => void) | null>(null);

  const mode = useUIStore((state) => state.mode);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<PendingStation>({ gridX: 0, gridY: 0 });
  const [pixiReady, setPixiReady] = useState(false);

  const openDialogRef = useRef<(gridX: number, gridY: number) => void>(() => {});

  useEffect(() => {
    openDialogRef.current = (gridX: number, gridY: number) => {
      setPending({ gridX, gridY });
      setDialogOpen(true);
    };
  });

  // Initialize PixiApp singleton once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    PixiApp.getInstance(canvas).then((pixiApp) => {
      if (cancelled) return;
      pixiAppRef.current = pixiApp;
      setPixiReady(true);
    });

    return () => {
      cancelled = true;
      // Clean up renderers but don't destroy PixiApp (singleton survives)
      if (cleanupRenderersRef.current) {
        cleanupRenderersRef.current();
        cleanupRenderersRef.current = null;
      }
    };
  }, []);

  // Switch renderers when mode changes
  useEffect(() => {
    const pixiApp = pixiAppRef.current;
    if (!pixiApp || !pixiReady) return;

    // Clean up previous renderers
    if (cleanupRenderersRef.current) {
      cleanupRenderersRef.current();
      cleanupRenderersRef.current = null;
    }

    // Clear everything
    pixiApp.clearWorld();
    pixiApp.clearStageExtras();

    if (mode === 'assembly') {
      pixiApp.app.renderer.background.color = 0x1a1a2e;
      pixiApp.worldContainer.visible = false;

      const assemblyRenderer = new AssemblyRenderer(pixiApp);
      assemblyRenderer.init();

      cleanupRenderersRef.current = () => {
        assemblyRenderer.destroy();
        pixiApp.worldContainer.visible = true;
      };
    } else {
      pixiApp.app.renderer.background.color = 0x0a1628;
      pixiApp.worldContainer.visible = true;

      const grid = new GridRenderer(pixiApp);
      const camera = new CameraController(pixiApp, grid);
      camera.updateGrid();

      const trackRenderer = new TrackRenderer(pixiApp);
      const stationRenderer = new StationRenderer(pixiApp);

      const interaction = new InteractionManager(pixiApp, camera, (gridX, gridY) => {
        openDialogRef.current(gridX, gridY);
      });

      cleanupRenderersRef.current = () => {
        interaction.destroy();
        stationRenderer.destroy();
        trackRenderer.destroy();
        camera.destroy();
      };
    }
  }, [mode, pixiReady]);

  const handleDialogConfirm = useCallback((name: string) => {
    useMapStore.getState().addStation(name, pending.gridX, pending.gridY);
    setDialogOpen(false);
  }, [pending]);

  const handleDialogCancel = useCallback(() => {
    setDialogOpen(false);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

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
