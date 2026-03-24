import { useEffect, useRef, useState, useCallback } from 'react';
import { PixiApp } from '../../engine/PixiApp';
import { GridRenderer } from '../../engine/GridRenderer';
import { CameraController } from '../../engine/CameraController';
import { StationRenderer } from '../../engine/StationRenderer';
import { TrackRenderer } from '../../engine/TrackRenderer';
import { CityDecorations } from '../../engine/CityDecorations';
import { InteractionManager } from '../../engine/InteractionManager';
import { AssemblyRenderer } from '../../engine/AssemblyRenderer';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { TrainSpriteRenderer } from '../../engine/TrainSpriteRenderer';
import { StationNameDialog } from '../track-design/StationNameDialog';
import { MiniMap } from '../shared/MiniMap';
import { useMapStore } from '../../stores/mapStore';
import { useTrainStore } from '../../stores/trainStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useUIStore } from '../../stores/uiStore';

interface PendingStation {
  gridX: number;
  gridY: number;
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixiAppRef = useRef<PixiApp | null>(null);
  const cleanupRenderersRef = useRef<(() => void) | null>(null);
  const cameraRef = useRef<CameraController | null>(null);

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
      // ── Track-design & simulation: blueprint view ──
      pixiApp.app.renderer.background.color = 0x0a1628;
      pixiApp.worldContainer.visible = true;

      const grid = new GridRenderer(pixiApp);
      const camera = new CameraController(pixiApp, grid);
      camera.updateGrid();
      cameraRef.current = camera;

      // TrackRenderer first (addChildAt 1), then CityDecorations (addChildAt 1)
      // so final z-order is: grid(0) → decorations(1) → tracks(2) → stations(3)
      const trackRenderer = new TrackRenderer(pixiApp);
      const cityDecorations = new CityDecorations(pixiApp);
      const stationRenderer = new StationRenderer(pixiApp);

      const interaction = new InteractionManager(pixiApp, camera, (gridX, gridY) => {
        openDialogRef.current(gridX, gridY);
      });

      // Simulation engine + train sprite renderer (only active in simulation mode)
      let simEngine: SimulationEngine | null = null;
      let trainSpriteRenderer: TrainSpriteRenderer | null = null;
      let simTickerFn: ((ticker: { deltaMS: number }) => void) | null = null;

      if (mode === 'simulation') {
        // Disable track editing interactions in simulation mode
        interaction.destroy();

        simEngine = new SimulationEngine();

        // Load map data into engine (stations + lines are static)
        const mapState = useMapStore.getState();
        simEngine.setStations(mapState.stations.map(s => ({ id: s.id, x: s.x, y: s.y, type: s.type })));
        for (const line of mapState.lines) {
          simEngine.setLine({ id: line.id, name: line.name, color: line.color, stationIds: line.stationIds });
        }
        for (const track of mapState.tracks) {
          simEngine.setTrackPath(track.stationAId, track.stationBId, track.path);
        }

        const stationMap = new Map<string, { x: number; y: number; name: string }>();
        for (const s of mapState.stations) {
          stationMap.set(s.id, { x: s.x, y: s.y, name: s.name });
        }

        const lineMap = new Map<string, { color: string; stationIds: string[] }>();
        for (const l of mapState.lines) {
          lineMap.set(l.id, { color: l.color, stationIds: l.stationIds });
        }

        const trainCarriageCounts = new Map<string, number>();
        const trainStyles = new Map<string, { headColor: string; carriageColors: string[] }>();

        useSimulationStore.getState().reset();

        trainSpriteRenderer = new TrainSpriteRenderer(
          pixiApp, simEngine, stationMap, lineMap, trainCarriageCounts, trainStyles
        );

        const engineRef = simEngine;
        const spriteRef = trainSpriteRenderer;
        let trainsLoaded = false;

        simTickerFn = (ticker: { deltaMS: number }) => {
          const simStore = useSimulationStore.getState();

          // Lazy-load trains on first unpause (so user can deploy THEN press play)
          if (!simStore.paused && !trainsLoaded) {
            trainsLoaded = true;
            const trainState = useTrainStore.getState();
            for (const train of trainState.trains) {
              if (train.lineId) {
                const capacity = trainState.getTrainCapacity(train.id);
                engineRef.addTrain({ id: train.id, lineId: train.lineId, capacity });
                trainCarriageCounts.set(train.id, train.carriages.length);
                const HEAD_CITY_COLORS: Record<string, string> = {
                  'tokyo':   '#e8e8e8',
                  'beijing': '#5dade2',
                  'london':  '#c0392b',
                  'newyork': '#7f8c8d',
                  'neo':     '#2d3436',
                  'quantum': '#6c5ce7',
                };
                trainStyles.set(train.id, {
                  headColor: HEAD_CITY_COLORS[train.head.city] ?? '#0984e3',
                  carriageColors: train.carriages.map(c => c.style.bodyColor),
                });
              }
            }
          }

          if (simStore.paused) {
            spriteRef.update(0);
            return;
          }

          engineRef.setDwellTime(simStore.dwellTime);
          const deltaSeconds = (ticker.deltaMS / 1000) * simStore.speed;
          const { boardingPerStation, alightingPerStation } = useSimulationStore.getState();
          engineRef.tick(deltaSeconds, boardingPerStation, alightingPerStation);
          spriteRef.update(deltaSeconds);

          // Update time in store
          useSimulationStore.setState({ time: engineRef.getTime() });

          // Update passenger stats
          const allTrains = engineRef.getAllTrainStates();
          for (const t of allTrains) {
            if (t.status === 'loading') {
              useSimulationStore.getState().addPassengers(t.lineId, 1);
            }
          }
        };

        pixiApp.app.ticker.add(simTickerFn);
      }

      cleanupRenderersRef.current = () => {
        if (simTickerFn) {
          pixiApp.app.ticker.remove(simTickerFn);
        }
        if (trainSpriteRenderer) {
          trainSpriteRenderer.destroy();
        }
        if (mode !== 'simulation') {
          // Only destroy interaction if we didn't already destroy it for simulation
          interaction.destroy();
        }
        stationRenderer.destroy();
        cityDecorations.destroy();
        trackRenderer.destroy();
        camera.destroy();
        cameraRef.current = null;
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

  const handleJump = useCallback((worldX: number, worldY: number) => {
    cameraRef.current?.jumpTo(worldX, worldY);
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

      {mode !== 'assembly' && (
        <MiniMap onJump={handleJump} />
      )}
    </div>
  );
}
