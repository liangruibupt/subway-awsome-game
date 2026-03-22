# Subway Awesome Game - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based subway building game with track design, train assembly, and run simulation.

**Architecture:** React app shell with PixiJS canvas for game rendering, zustand for state management. Three modes (Track Design, Assembly, Simulation) share a common data model. React handles all UI panels, PixiJS handles all canvas rendering.

**Tech Stack:** TypeScript, React 18, PixiJS 8, zustand, Vite

**Spec:** `docs/superpowers/specs/2026-03-22-subway-game-design.md`

---

## File Structure

```
src/
├── main.tsx                              # Entry point
├── App.tsx                               # Root layout, mode router
├── types/
│   └── index.ts                          # All interfaces: Station, Track, Line, Train, etc.
├── stores/
│   ├── mapStore.ts                       # Stations, tracks, lines
│   ├── trainStore.ts                     # Train assembly + customization
│   ├── simulationStore.ts                # Sim state, passengers, timing
│   ├── uiStore.ts                        # Mode, selection, zoom
│   └── saveStore.ts                      # Save/load, undo/redo
├── engine/
│   ├── PixiApp.ts                        # PixiJS app lifecycle
│   ├── GridRenderer.ts                   # Blueprint grid
│   ├── CameraController.ts              # Pan, zoom, viewport
│   ├── Quadtree.ts                       # Spatial index
│   ├── TrackRenderer.ts                  # Glowing track lines + LOD
│   ├── StationRenderer.ts               # Station nodes
│   ├── TrainSpriteRenderer.ts           # Sim mode train sprites
│   ├── PathFinder.ts                     # A* grid pathfinding
│   ├── SimulationEngine.ts              # Tick loop: movement, passengers
│   └── AssemblyRenderer.ts              # 2.5D turntable scene
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx
│   │   ├── LeftToolBar.tsx
│   │   ├── RightPanel.tsx
│   │   ├── BottomBar.tsx
│   │   └── GameCanvas.tsx               # Mount PixiJS
│   ├── track-design/
│   │   ├── TrackTools.tsx
│   │   ├── LineList.tsx
│   │   ├── StationProperties.tsx
│   │   └── StationNameDialog.tsx
│   ├── assembly/
│   │   ├── TrainCatalog.tsx
│   │   ├── CustomizationPanel.tsx
│   │   └── CarriageCounter.tsx
│   ├── simulation/
│   │   ├── SpeedControls.tsx
│   │   ├── DeploymentPanel.tsx
│   │   ├── LiveOpsPanel.tsx
│   │   └── TrainDetailPanel.tsx
│   ├── challenge/
│   │   ├── LevelSelect.tsx              # Level selection grid
│   │   ├── ObjectiveTracker.tsx         # HUD overlay during gameplay
│   │   └── VictoryScreen.tsx            # Completion + star rating
│   └── shared/
│       ├── MiniMap.tsx
│       ├── ColorPicker.tsx
│       └── SaveLoadDialog.tsx
├── data/
│   ├── trainCatalog.ts                  # Head + carriage definitions
│   ├── colors.ts                        # Preset palettes
│   └── challengeLevels.ts              # 3 MVP levels
└── utils/
    ├── grid.ts                          # Grid coord helpers
    ├── geometry.ts                      # Distance, intersection
    └── id.ts                            # nanoid wrapper
```

---

## Phase 1: Project Foundation

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Initialize project**

```bash
cd /Users/ruiliang/Documents/workspaces/subway-awsome-game
npm create vite@latest . -- --template react-ts
```

Select: React, TypeScript

- [ ] **Step 2: Install core dependencies**

```bash
npm install pixi.js@^8 zustand nanoid
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vitest**

Add to `vite.config.ts`:

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
```

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```

Expected: Dev server at localhost, React page renders.

- [ ] **Step 5: Verify tests run**

```bash
npx vitest run
```

Expected: Test runner works (0 tests initially).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite + React + TS project with PixiJS and zustand"
```

---

### Task 2: Define TypeScript types

**Files:**
- Create: `src/types/index.ts`
- Test: `tests/types.test.ts` (type-level sanity)

- [ ] **Step 1: Write type definitions**

```typescript
// src/types/index.ts
export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'normal' | 'interchange' | 'terminal';
  lineIds: string[];
}

export interface Track {
  id: string;
  lineId: string;
  path: { x: number; y: number }[];
  stationAId: string;
  stationBId: string;
}

export interface Line {
  id: string;
  name: string;
  color: string;
  stationIds: string[];
}

export interface TrainHead {
  type: string;
  era: 'classic' | 'modern' | 'future';
  city: string;
}

export interface Carriage {
  type: 'standard' | 'widebody';
  city: string;
}

export interface TrainStyle {
  bodyColor: string;
  pattern: 'solid' | 'stripe' | 'gradient' | 'tech';
  accentColor: string;
}

export interface Train {
  id: string;
  lineId: string;
  head: TrainHead;
  carriages: Carriage[];
  style: TrainStyle;
}

export interface SimulationStats {
  totalPassengers: number;
  onTimeRate: number;
  byLine: Record<string, { passengers: number; onTime: number }>;
}

export interface SimulationState {
  time: number;
  speed: 1 | 2 | 4;
  paused: boolean;
  stats: SimulationStats;
}

export interface GameSave {
  map: {
    gridSize: number;
    stations: Station[];
    tracks: Track[];
    lines: Line[];
  };
  trains: Train[];
  simulation: SimulationState;
  meta: {
    saveName: string;
    createdAt: string;
    lastModified: string;
    version: string;
  };
}

export type GameMode = 'track-design' | 'assembly' | 'simulation';
export type TrackTool = 'station' | 'connect' | 'edit' | 'delete' | 'pan';
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts && git commit -m "feat: define core TypeScript interfaces"
```

---

### Task 3: Create utility modules

**Files:**
- Create: `src/utils/id.ts`, `src/utils/grid.ts`, `src/utils/geometry.ts`
- Test: `tests/utils/grid.test.ts`, `tests/utils/geometry.test.ts`

- [ ] **Step 1: Write grid utility tests**

```typescript
// tests/utils/grid.test.ts
import { describe, it, expect } from 'vitest';
import { snapToGrid, gridToPixel, pixelToGrid } from '../../src/utils/grid';

describe('grid utils', () => {
  it('snaps to nearest grid intersection', () => {
    expect(snapToGrid(47, 30)).toBe(60);
    expect(snapToGrid(14, 30)).toBe(0);
    expect(snapToGrid(15, 30)).toBe(30);
  });

  it('converts grid coords to pixel coords', () => {
    expect(gridToPixel(2, 30)).toBe(60);
    expect(gridToPixel(0, 30)).toBe(0);
  });

  it('converts pixel coords to grid coords', () => {
    expect(pixelToGrid(60, 30)).toBe(2);
    expect(pixelToGrid(75, 30)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/utils/grid.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement grid utils**

```typescript
// src/utils/grid.ts
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function gridToPixel(gridCoord: number, gridSize: number): number {
  return gridCoord * gridSize;
}

export function pixelToGrid(pixel: number, gridSize: number): number {
  return Math.round(pixel / gridSize);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/utils/grid.test.ts
```

Expected: PASS

- [ ] **Step 5: Write geometry tests**

```typescript
// tests/utils/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { distance, manhattanPath } from '../../src/utils/geometry';

describe('geometry utils', () => {
  it('calculates euclidean distance', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
    expect(distance(1, 1, 1, 1)).toBe(0);
  });

  it('generates manhattan path between two grid points', () => {
    const path = manhattanPath({ x: 0, y: 0 }, { x: 3, y: 2 });
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 2 });
    // Path should only move in cardinal directions (one axis changes at a time)
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i].x - path[i - 1].x);
      const dy = Math.abs(path[i].y - path[i - 1].y);
      expect(dx + dy).toBe(1);
    }
  });
});
```

- [ ] **Step 6: Implement geometry utils + id util**

```typescript
// src/utils/geometry.ts
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function manhattanPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [{ ...from }];
  let { x, y } = from;
  // Move horizontally first, then vertically
  const dx = to.x > x ? 1 : -1;
  while (x !== to.x) {
    x += dx;
    path.push({ x, y });
  }
  const dy = to.y > y ? 1 : -1;
  while (y !== to.y) {
    y += dy;
    path.push({ x, y });
  }
  return path;
}

// src/utils/id.ts
import { nanoid } from 'nanoid';

export function generateId(): string {
  return nanoid(10);
}
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add src/utils/ tests/utils/ && git commit -m "feat: add grid, geometry, and id utilities with tests"
```

---

### Task 4: Create zustand stores

**Files:**
- Create: `src/stores/mapStore.ts`, `src/stores/trainStore.ts`, `src/stores/simulationStore.ts`, `src/stores/uiStore.ts`
- Test: `tests/stores/mapStore.test.ts`, `tests/stores/trainStore.test.ts`

- [ ] **Step 1: Write mapStore tests**

```typescript
// tests/stores/mapStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../../src/stores/mapStore';

describe('mapStore', () => {
  beforeEach(() => {
    useMapStore.getState().reset();
  });

  it('adds a station', () => {
    const { addStation } = useMapStore.getState();
    addStation('Central Hub', 3, 5);
    const { stations } = useMapStore.getState();
    expect(stations).toHaveLength(1);
    expect(stations[0].name).toBe('Central Hub');
    expect(stations[0].x).toBe(3);
    expect(stations[0].y).toBe(5);
    expect(stations[0].type).toBe('normal');
  });

  it('adds a line', () => {
    const { addLine } = useMapStore.getState();
    addLine('Line 1', '#ff6b6b');
    const { lines } = useMapStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0].color).toBe('#ff6b6b');
  });

  it('connects two stations with a track', () => {
    const { addStation, addLine, addTrack } = useMapStore.getState();
    addStation('A', 0, 0);
    addStation('B', 5, 3);
    addLine('Red', '#ff0000');
    const { stations, lines } = useMapStore.getState();
    addTrack(lines[0].id, stations[0].id, stations[1].id);
    const { tracks } = useMapStore.getState();
    expect(tracks).toHaveLength(1);
    expect(tracks[0].stationAId).toBe(stations[0].id);
    expect(tracks[0].path.length).toBeGreaterThan(1);
  });

  it('renames a station', () => {
    const { addStation, renameStation } = useMapStore.getState();
    addStation('Old', 0, 0);
    const { stations } = useMapStore.getState();
    renameStation(stations[0].id, 'New Name');
    expect(useMapStore.getState().stations[0].name).toBe('New Name');
  });

  it('deletes a station and associated tracks', () => {
    const { addStation, addLine, addTrack, deleteStation } = useMapStore.getState();
    addStation('A', 0, 0);
    addStation('B', 5, 0);
    addLine('Red', '#ff0000');
    const s = useMapStore.getState();
    addTrack(s.lines[0].id, s.stations[0].id, s.stations[1].id);
    deleteStation(useMapStore.getState().stations[0].id);
    expect(useMapStore.getState().stations).toHaveLength(1);
    expect(useMapStore.getState().tracks).toHaveLength(0);
  });

  it('auto-detects interchange stations', () => {
    const { addStation, addLine, addTrack } = useMapStore.getState();
    addStation('Hub', 3, 3);
    addStation('A', 0, 3);
    addStation('B', 3, 0);
    addLine('Red', '#ff0000');
    addLine('Blue', '#0000ff');
    const s = useMapStore.getState();
    addTrack(s.lines[0].id, s.stations[1].id, s.stations[0].id); // A -> Hub on Red
    addTrack(s.lines[1].id, s.stations[2].id, s.stations[0].id); // B -> Hub on Blue
    const hub = useMapStore.getState().stations.find(st => st.name === 'Hub');
    expect(hub?.type).toBe('interchange');
    expect(hub?.lineIds).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/stores/mapStore.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement mapStore**

```typescript
// src/stores/mapStore.ts
import { create } from 'zustand';
import type { Station, Track, Line } from '../types';
import { generateId } from '../utils/id';
import { manhattanPath } from '../utils/geometry';

interface MapState {
  gridSize: number;
  stations: Station[];
  tracks: Track[];
  lines: Line[];
  addStation: (name: string, x: number, y: number) => void;
  renameStation: (id: string, name: string) => void;
  deleteStation: (id: string) => void;
  addLine: (name: string, color: string) => void;
  deleteLine: (id: string) => void;
  addTrack: (lineId: string, stationAId: string, stationBId: string) => void;
  deleteTrack: (id: string) => void;
  reset: () => void;
}

const initialState = {
  gridSize: 30,
  stations: [] as Station[],
  tracks: [] as Track[],
  lines: [] as Line[],
};

export const useMapStore = create<MapState>((set, get) => ({
  ...initialState,

  addStation: (name, x, y) => set(state => ({
    stations: [...state.stations, {
      id: generateId(),
      name,
      x,
      y,
      type: 'normal',
      lineIds: [],
    }],
  })),

  renameStation: (id, name) => set(state => ({
    stations: state.stations.map(s => s.id === id ? { ...s, name } : s),
  })),

  deleteStation: (id) => set(state => ({
    stations: state.stations.filter(s => s.id !== id),
    tracks: state.tracks.filter(t => t.stationAId !== id && t.stationBId !== id),
  })),

  addLine: (name, color) => set(state => ({
    lines: [...state.lines, {
      id: generateId(),
      name,
      color,
      stationIds: [],
    }],
  })),

  deleteLine: (id) => set(state => ({
    lines: state.lines.filter(l => l.id !== id),
    tracks: state.tracks.filter(t => t.lineId !== id),
    stations: state.stations.map(s => ({
      ...s,
      lineIds: s.lineIds.filter(lid => lid !== id),
      type: s.lineIds.filter(lid => lid !== id).length >= 2 ? 'interchange' : 'normal',
    })),
  })),

  addTrack: (lineId, stationAId, stationBId) => {
    const state = get();
    const stationA = state.stations.find(s => s.id === stationAId);
    const stationB = state.stations.find(s => s.id === stationBId);
    if (!stationA || !stationB) return;

    const path = manhattanPath(
      { x: stationA.x, y: stationA.y },
      { x: stationB.x, y: stationB.y }
    );

    const track: Track = {
      id: generateId(),
      lineId,
      path,
      stationAId,
      stationBId,
    };

    // Update station lineIds and types
    const updateStation = (station: Station): Station => {
      const newLineIds = station.lineIds.includes(lineId)
        ? station.lineIds
        : [...station.lineIds, lineId];
      return {
        ...station,
        lineIds: newLineIds,
        type: newLineIds.length >= 2 ? 'interchange' : 'normal',
      };
    };

    // Update line stationIds
    const updatedLines = state.lines.map(l => {
      if (l.id !== lineId) return l;
      const ids = new Set(l.stationIds);
      ids.add(stationAId);
      ids.add(stationBId);
      return { ...l, stationIds: Array.from(ids) };
    });

    set({
      tracks: [...state.tracks, track],
      stations: state.stations.map(s => {
        if (s.id === stationAId || s.id === stationBId) return updateStation(s);
        return s;
      }),
      lines: updatedLines,
    });
  },

  deleteTrack: (id) => set(state => ({
    tracks: state.tracks.filter(t => t.id !== id),
  })),

  reset: () => set(initialState),
}));
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/stores/mapStore.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Write trainStore tests**

```typescript
// tests/stores/trainStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTrainStore } from '../../src/stores/trainStore';

describe('trainStore', () => {
  beforeEach(() => {
    useTrainStore.getState().reset();
  });

  it('creates a train with head', () => {
    const { createTrain } = useTrainStore.getState();
    createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const { trains } = useTrainStore.getState();
    expect(trains).toHaveLength(1);
    expect(trains[0].head.city).toBe('tokyo');
    expect(trains[0].carriages).toHaveLength(0);
  });

  it('adds carriages up to max 7', () => {
    const { createTrain, addCarriage } = useTrainStore.getState();
    createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    for (let i = 0; i < 8; i++) {
      addCarriage(trainId, { type: 'standard', city: 'tokyo' });
    }
    expect(useTrainStore.getState().trains[0].carriages).toHaveLength(7);
  });

  it('calculates train capacity', () => {
    const { createTrain, addCarriage, getTrainCapacity } = useTrainStore.getState();
    createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    addCarriage(trainId, { type: 'standard', city: 'tokyo' });
    addCarriage(trainId, { type: 'widebody', city: 'tokyo' });
    // head=40 + standard=60 + widebody=80 = 180
    expect(getTrainCapacity(trainId)).toBe(180);
  });

  it('updates train style', () => {
    const { createTrain, updateStyle } = useTrainStore.getState();
    createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    updateStyle(trainId, { bodyColor: '#ff0000', pattern: 'stripe', accentColor: '#ffd93d' });
    expect(useTrainStore.getState().trains[0].style.pattern).toBe('stripe');
  });
});
```

- [ ] **Step 6: Implement trainStore**

```typescript
// src/stores/trainStore.ts
import { create } from 'zustand';
import type { Train, TrainHead, Carriage, TrainStyle } from '../types';
import { generateId } from '../utils/id';

const HEAD_CAPACITY = 40;
const STANDARD_CAPACITY = 60;
const WIDEBODY_CAPACITY = 80;
const MAX_CARRIAGES = 7;

interface TrainState {
  trains: Train[];
  createTrain: (head: TrainHead) => void;
  deleteTrain: (id: string) => void;
  addCarriage: (trainId: string, carriage: Carriage) => void;
  removeCarriage: (trainId: string, index: number) => void;
  reorderCarriages: (trainId: string, fromIndex: number, toIndex: number) => void;
  updateStyle: (trainId: string, style: TrainStyle) => void;
  assignToLine: (trainId: string, lineId: string) => void;
  getTrainCapacity: (trainId: string) => number;
  reset: () => void;
}

export const useTrainStore = create<TrainState>((set, get) => ({
  trains: [],

  createTrain: (head) => set(state => ({
    trains: [...state.trains, {
      id: generateId(),
      lineId: '',
      head,
      carriages: [],
      style: { bodyColor: '#0984e3', pattern: 'solid', accentColor: '#ffd93d' },
    }],
  })),

  deleteTrain: (id) => set(state => ({
    trains: state.trains.filter(t => t.id !== id),
  })),

  addCarriage: (trainId, carriage) => set(state => ({
    trains: state.trains.map(t => {
      if (t.id !== trainId || t.carriages.length >= MAX_CARRIAGES) return t;
      return { ...t, carriages: [...t.carriages, carriage] };
    }),
  })),

  removeCarriage: (trainId, index) => set(state => ({
    trains: state.trains.map(t => {
      if (t.id !== trainId) return t;
      return { ...t, carriages: t.carriages.filter((_, i) => i !== index) };
    }),
  })),

  reorderCarriages: (trainId, fromIndex, toIndex) => set(state => ({
    trains: state.trains.map(t => {
      if (t.id !== trainId) return t;
      const carriages = [...t.carriages];
      const [moved] = carriages.splice(fromIndex, 1);
      carriages.splice(toIndex, 0, moved);
      return { ...t, carriages };
    }),
  })),

  updateStyle: (trainId, style) => set(state => ({
    trains: state.trains.map(t => t.id === trainId ? { ...t, style } : t),
  })),

  assignToLine: (trainId, lineId) => set(state => ({
    trains: state.trains.map(t => t.id === trainId ? { ...t, lineId } : t),
  })),

  getTrainCapacity: (trainId) => {
    const train = get().trains.find(t => t.id === trainId);
    if (!train) return 0;
    return HEAD_CAPACITY + train.carriages.reduce((sum, c) =>
      sum + (c.type === 'widebody' ? WIDEBODY_CAPACITY : STANDARD_CAPACITY), 0);
  },

  reset: () => set({ trains: [] }),
}));
```

- [ ] **Step 7: Implement uiStore and simulationStore**

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand';
import type { GameMode, TrackTool } from '../types';

interface UIState {
  mode: GameMode;
  tool: TrackTool;
  selectedStationId: string | null;
  selectedTrainId: string | null;
  zoomLevel: number;
  setMode: (mode: GameMode) => void;
  setTool: (tool: TrackTool) => void;
  selectStation: (id: string | null) => void;
  selectTrain: (id: string | null) => void;
  setZoom: (zoom: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'track-design',
  tool: 'station',
  selectedStationId: null,
  selectedTrainId: null,
  zoomLevel: 1,
  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  selectStation: (id) => set({ selectedStationId: id }),
  selectTrain: (id) => set({ selectedTrainId: id }),
  setZoom: (zoom) => set({ zoomLevel: Math.max(0.25, Math.min(4, zoom)) }),
}));
```

```typescript
// src/stores/simulationStore.ts
import { create } from 'zustand';
import type { SimulationState } from '../types';

interface SimStore extends SimulationState {
  setSpeed: (speed: 1 | 2 | 4) => void;
  togglePause: () => void;
  tick: (deltaMinutes: number) => void;
  addPassengers: (lineId: string, count: number) => void;
  recordArrival: (lineId: string, onTime: boolean) => void;
  reset: () => void;
}

const initialState: SimulationState = {
  time: 0,
  speed: 1,
  paused: true,
  stats: { totalPassengers: 0, onTimeRate: 100, byLine: {} },
};

export const useSimulationStore = create<SimStore>((set, get) => ({
  ...initialState,

  setSpeed: (speed) => set({ speed }),
  togglePause: () => set(state => ({ paused: !state.paused })),

  tick: (deltaMinutes) => set(state => {
    if (state.paused) return state;
    return { time: state.time + deltaMinutes * state.speed };
  }),

  addPassengers: (lineId, count) => set(state => {
    const byLine = { ...state.stats.byLine };
    if (!byLine[lineId]) byLine[lineId] = { passengers: 0, onTime: 0 };
    byLine[lineId] = { ...byLine[lineId], passengers: byLine[lineId].passengers + count };
    const totalPassengers = state.stats.totalPassengers + count;
    return { stats: { ...state.stats, totalPassengers, byLine } };
  }),

  recordArrival: (lineId, onTime) => set(state => {
    const byLine = { ...state.stats.byLine };
    if (!byLine[lineId]) byLine[lineId] = { passengers: 0, onTime: 0 };
    if (onTime) byLine[lineId] = { ...byLine[lineId], onTime: byLine[lineId].onTime + 1 };
    // Recalculate overall on-time rate
    const totalOnTime = Object.values(byLine).reduce((s, l) => s + l.onTime, 0);
    const totalArrivals = Object.values(byLine).reduce((s, l) => s + l.passengers, 0);
    const onTimeRate = totalArrivals > 0 ? (totalOnTime / totalArrivals) * 100 : 100;
    return { stats: { ...state.stats, onTimeRate, byLine } };
  }),

  reset: () => set(initialState),
}));
```

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```

Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
git add src/stores/ tests/stores/ && git commit -m "feat: add zustand stores (map, train, simulation, ui) with tests"
```

---

## Phase 2: App Shell & PixiJS Canvas

### Task 5: Build React app shell layout

**Files:**
- Create: `src/components/layout/TopBar.tsx`, `LeftToolBar.tsx`, `RightPanel.tsx`, `BottomBar.tsx`, `GameCanvas.tsx`
- Modify: `src/App.tsx`
- Create: `src/App.css`

- [ ] **Step 1: Create layout components**

Build the 5 layout components:
- `TopBar` — 3 mode tabs (TRACKS / ASSEMBLY / RUN), reads/writes `uiStore.mode`
- `LeftToolBar` — shows different tools per mode, reads `uiStore.mode`
- `RightPanel` — placeholder per mode, swaps content based on `uiStore.mode`
- `BottomBar` — status info row
- `GameCanvas` — `<div ref>` mount point for PixiJS (no PixiJS yet, just the div)

Style with dark theme CSS:
- Track design: `#0a1628` background
- Assembly: `#1a1a2e` background
- Monospace font: `'Courier New', monospace`
- Accent colors: `#81ecec` (cyan), `#a29bfe` (purple), `#00b894` (green)

- [ ] **Step 2: Wire up App.tsx**

```typescript
// src/App.tsx
import { TopBar } from './components/layout/TopBar';
import { LeftToolBar } from './components/layout/LeftToolBar';
import { RightPanel } from './components/layout/RightPanel';
import { BottomBar } from './components/layout/BottomBar';
import { GameCanvas } from './components/layout/GameCanvas';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <TopBar />
      <div className="main-area">
        <LeftToolBar />
        <GameCanvas />
        <RightPanel />
      </div>
      <BottomBar />
    </div>
  );
}
```

CSS grid layout: TopBar fixed top, BottomBar fixed bottom, main-area fills middle with 3-column (toolbar | canvas | panel).

- [ ] **Step 3: Verify layout renders with mode switching**

```bash
npm run dev
```

Expected: Dark themed layout. Clicking mode tabs switches content in left/right panels.

- [ ] **Step 4: Commit**

```bash
git add src/components/ src/App.tsx src/App.css && git commit -m "feat: build app shell layout with mode switching"
```

---

### Task 6: Initialize PixiJS canvas with blueprint grid

**Files:**
- Create: `src/engine/PixiApp.ts`, `src/engine/GridRenderer.ts`, `src/engine/CameraController.ts`
- Modify: `src/components/layout/GameCanvas.tsx`

- [ ] **Step 1: Create PixiApp manager**

```typescript
// src/engine/PixiApp.ts
import { Application, Container } from 'pixi.js';

export class PixiApp {
  app: Application;
  worldContainer: Container;

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
  }

  destroy() {
    this.app.destroy(true);
  }
}
```

- [ ] **Step 2: Create GridRenderer**

Renders blueprint-style grid with two line weights:
- Fine grid: every `gridSize` px, color `#1a3a5c`, width 0.5
- Coarse grid: every `5 * gridSize` px, color `#1a3a5c`, width 1.0

Uses PixiJS Graphics. Only draws lines visible in current viewport (viewport culling).

- [ ] **Step 3: Create CameraController**

Handles:
- `wheel` event → zoom (0.25 to 4.0), zoom toward mouse position
- `mousedown` + `mousemove` (middle button or space+left) → pan
- `pointermove` → track mouse grid position for BottomBar display
- Touch: pinch-to-zoom, two-finger pan
- Exposes `screenToWorld(x, y)` and `worldToScreen(x, y)` transforms
- Updates `uiStore.zoomLevel`

- [ ] **Step 4: Mount PixiJS in GameCanvas component**

```typescript
// src/components/layout/GameCanvas.tsx
import { useEffect, useRef } from 'react';
import { PixiApp } from '../../engine/PixiApp';
import { GridRenderer } from '../../engine/GridRenderer';
import { CameraController } from '../../engine/CameraController';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const pixiApp = new PixiApp();
    const initPromise = pixiApp.init(canvasRef.current).then(() => {
      const grid = new GridRenderer(pixiApp);
      const camera = new CameraController(pixiApp);
      grid.render();
    });

    return () => { pixiApp.destroy(); };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" />;
}
```

- [ ] **Step 5: Verify grid renders with pan and zoom**

```bash
npm run dev
```

Expected: Blueprint grid renders. Scroll to zoom, middle-click to pan. Grid lines cull outside viewport.

- [ ] **Step 6: Commit**

```bash
git add src/engine/ src/components/layout/GameCanvas.tsx && git commit -m "feat: PixiJS canvas with blueprint grid, pan and zoom"
```

---

## Phase 3: Track Design Mode

### Task 7: Station placement and rendering

**Files:**
- Create: `src/engine/StationRenderer.ts`, `src/components/track-design/StationNameDialog.tsx`, `src/components/track-design/TrackTools.tsx`

- [ ] **Step 1: Create StationRenderer**

Renders stations on the PixiJS canvas:
- Normal station: cyan glowing circle (outer ring + inner dot), station name label above
- Interchange station: larger, gold glow (`#ffd93d`)
- Terminal station: with end-of-line indicator
- Font for names: `"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif"`, size 9-10
- Subscribes to `mapStore.stations` — re-renders when stations change
- Handles LOD: at zoom < 0.5, hide names; at zoom < 0.25, shrink to dots

- [ ] **Step 2: Create TrackTools component**

Left toolbar for track-design mode with 4 tool buttons:
- Station tool (place stations)
- Connect tool (draw tracks)
- Delete tool
- Pan tool

Reads/writes `uiStore.tool`. Highlights active tool.

- [ ] **Step 3: Create StationNameDialog**

React modal popup for naming stations:
- `<input>` element with `autoFocus`, supports Chinese IME
- Triggers on station placement
- On confirm: calls `mapStore.addStation(name, x, y)`
- On cancel: aborts placement

- [ ] **Step 4: Wire station placement interaction**

In `GameCanvas` / interaction handler:
- When station tool active + click on canvas → snap to grid → open StationNameDialog → on confirm → add station to store → StationRenderer picks up change

- [ ] **Step 5: Verify station placement**

```bash
npm run dev
```

Expected: Select station tool, click canvas, popup asks for name, enter "中央枢纽", glowing cyan node appears at grid intersection with label.

- [ ] **Step 6: Commit**

```bash
git add src/engine/StationRenderer.ts src/components/track-design/ && git commit -m "feat: station placement with name dialog and blueprint rendering"
```

---

### Task 8: Track connection and rendering

**Files:**
- Create: `src/engine/TrackRenderer.ts`, `src/engine/PathFinder.ts`
- Create: `src/components/track-design/LineList.tsx`, `src/components/track-design/StationProperties.tsx`
- Test: `tests/engine/PathFinder.test.ts`

- [ ] **Step 1: Write PathFinder test**

```typescript
// tests/engine/PathFinder.test.ts
import { describe, it, expect } from 'vitest';
import { findGridPath } from '../../src/engine/PathFinder';

describe('PathFinder', () => {
  it('finds path between two grid points', () => {
    const path = findGridPath({ x: 0, y: 0 }, { x: 4, y: 3 });
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 3 });
    expect(path.length).toBe(8); // 4 horizontal + 3 vertical + start = 8
  });

  it('returns direct path for same-axis stations', () => {
    const path = findGridPath({ x: 0, y: 0 }, { x: 5, y: 0 });
    expect(path.length).toBe(6);
    path.forEach(p => expect(p.y).toBe(0));
  });
});
```

- [ ] **Step 2: Implement PathFinder and run test**

A* or simple manhattan pathfinder that generates grid-aligned paths. Run test to verify PASS.

- [ ] **Step 3: Create TrackRenderer**

Renders tracks on PixiJS canvas:
- Glowing lines using the line's color
- Double render: wider blurred line underneath + sharp line on top for glow effect
- Use PixiJS `Graphics` with `moveTo`/`lineTo` along track path points
- Subscribes to `mapStore.tracks`
- LOD: at low zoom, reduce glow and line width

- [ ] **Step 4: Create LineList component (right panel)**

Shows all lines with:
- Color dot + name + station count
- Click to highlight line on canvas
- "Add Line" button → opens color picker, creates new line

- [ ] **Step 5: Create StationProperties component (right panel)**

When a station is selected:
- Shows station name (editable)
- Shows assigned lines
- Shows type (normal/interchange/terminal)
- Rename button

- [ ] **Step 6: Wire connect tool interaction**

When connect tool active:
- Click station A → highlight it
- Click station B → call `mapStore.addTrack(activeLineId, stationA.id, stationB.id)`
- TrackRenderer picks up change, draws glowing path

- [ ] **Step 7: Wire edit-path tool interaction**

When edit tool active:
- Click on a track segment → show draggable waypoint handles at each path point
- Drag a waypoint → recalculate path from that waypoint to adjacent waypoints along grid
- On release → update track path in `mapStore` via `updateTrackPath(trackId, newPath)`
- Add `updateTrackPath` method to `mapStore`

- [ ] **Step 8: Verify track connection and path editing end-to-end**

```bash
npm run dev
```

Expected: Place 2 stations, select connect tool, click A then B, glowing red track appears along grid. Right panel shows Line 1 with 2 stations. Select edit tool, click track, drag waypoint, path adjusts along grid.

- [ ] **Step 9: Commit**

```bash
git add src/engine/TrackRenderer.ts src/engine/PathFinder.ts src/components/track-design/ tests/engine/ && git commit -m "feat: track connection with glowing lines and line management"
```

---

### Task 9: Quadtree spatial index for hit testing

**Files:**
- Create: `src/engine/Quadtree.ts`
- Test: `tests/engine/Quadtree.test.ts`

- [ ] **Step 1: Write Quadtree tests**

```typescript
// tests/engine/Quadtree.test.ts
import { describe, it, expect } from 'vitest';
import { Quadtree } from '../../src/engine/Quadtree';

describe('Quadtree', () => {
  it('inserts and queries points in range', () => {
    const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 });
    qt.insert({ id: 'a', x: 10, y: 10 });
    qt.insert({ id: 'b', x: 90, y: 90 });
    qt.insert({ id: 'c', x: 50, y: 50 });

    const results = qt.query({ x: 0, y: 0, w: 60, h: 60 });
    expect(results.map(r => r.id)).toContain('a');
    expect(results.map(r => r.id)).toContain('c');
    expect(results.map(r => r.id)).not.toContain('b');
  });

  it('finds nearest point', () => {
    const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 });
    qt.insert({ id: 'a', x: 10, y: 10 });
    qt.insert({ id: 'b', x: 50, y: 50 });
    const nearest = qt.findNearest(12, 12, 20);
    expect(nearest?.id).toBe('a');
  });
});
```

- [ ] **Step 2: Implement Quadtree and run tests**

Simple quadtree with `insert`, `query(rect)`, `findNearest(x, y, radius)`. Used for fast station click detection.

- [ ] **Step 3: Integrate into station click handling**

Rebuild quadtree when stations change. On canvas click, query quadtree for nearest station within click radius.

- [ ] **Step 4: Commit**

```bash
git add src/engine/Quadtree.ts tests/engine/Quadtree.test.ts && git commit -m "feat: quadtree spatial index for station hit testing"
```

---

## Phase 4: Train Assembly Mode

### Task 10: Train catalog data and assembly UI

**Files:**
- Create: `src/data/trainCatalog.ts`, `src/data/colors.ts`
- Create: `src/components/assembly/TrainCatalog.tsx`, `src/components/assembly/CustomizationPanel.tsx`, `src/components/assembly/CarriageCounter.tsx`

- [ ] **Step 1: Define train catalog data**

```typescript
// src/data/trainCatalog.ts
export interface CatalogItem {
  type: string;
  era: 'classic' | 'modern' | 'future';
  city: string;
  label: string;
  kind: 'head' | 'carriage';
  carriageType?: 'standard' | 'widebody';
}

export const trainCatalog: CatalogItem[] = [
  // Modern era
  { type: 'tokyo-modern', era: 'modern', city: 'tokyo', label: 'Tokyo', kind: 'head' },
  { type: 'beijing-modern', era: 'modern', city: 'beijing', label: 'Beijing', kind: 'head' },
  // Classic era
  { type: 'london-classic', era: 'classic', city: 'london', label: 'London', kind: 'head' },
  { type: 'newyork-classic', era: 'classic', city: 'newyork', label: 'New York', kind: 'head' },
  // Future era
  { type: 'neo-future', era: 'future', city: 'neo', label: 'Neo', kind: 'head' },
  { type: 'quantum-future', era: 'future', city: 'quantum', label: 'Quantum', kind: 'head' },
  // Carriages
  { type: 'standard', era: 'modern', city: 'generic', label: 'Standard', kind: 'carriage', carriageType: 'standard' },
  { type: 'widebody', era: 'modern', city: 'generic', label: 'Wide-body', kind: 'carriage', carriageType: 'widebody' },
];
```

- [ ] **Step 2: Define color presets**

```typescript
// src/data/colors.ts
export const presetColors = [
  '#e17055', '#0984e3', '#00b894', '#6c5ce7', '#636e72',
  '#fdcb6e', '#ff6b6b', '#fd79a8', '#ffeaa7', '#74b9ff',
];

export const patternOptions = ['solid', 'stripe', 'gradient', 'tech'] as const;
```

- [ ] **Step 3: Build TrainCatalog component**

Left panel in assembly mode:
- Era tabs (Classic / Modern / Future)
- Heads section: grid of clickable items with label
- Carriages section: Standard and Wide-body items
- Click head → calls `trainStore.createTrain(head)` (or swaps if train exists)
- Click carriage → calls `trainStore.addCarriage(trainId, carriage)`

- [ ] **Step 4: Build CustomizationPanel component**

Right panel in assembly mode:
- Body color: grid of `presetColors` circles + custom picker
- Pattern: 4 option buttons (Solid/Stripe/Gradient/Tech)
- Accent color: grid of color circles
- "Apply" button → calls `trainStore.updateStyle(trainId, style)`

- [ ] **Step 5: Build CarriageCounter component**

Displays "3 / 8 CARRIAGES" below the canvas area. Reads from `trainStore`.

- [ ] **Step 6: Verify assembly UI**

```bash
npm run dev
```

Expected: Switch to ASSEMBLY mode. Left panel shows catalog with era tabs. Right panel shows color/pattern picker. Clicking items updates store (verify via dev tools).

- [ ] **Step 7: Commit**

```bash
git add src/data/ src/components/assembly/ && git commit -m "feat: train catalog, customization panel, and assembly UI"
```

---

### Task 11: 2.5D Assembly renderer with turntable

**Files:**
- Create: `src/engine/AssemblyRenderer.ts`

- [ ] **Step 1: Create AssemblyRenderer**

PixiJS scene for assembly mode:
- Dark purple background (#1a1a2e)
- Isometric platform: glowing ellipse with dashed inner ring
- Draws assembled train on platform using isometric sprite representations:
  - Head car: isometric 3D-like shape using PixiJS Graphics (polygons with shading)
  - Each carriage: isometric box with windows, doors, color from `trainStore.style`
  - Empty slots: dashed outline ghosts with "+"
- Different visual for standard vs widebody (wider polygon, bigger windows, XL badge)

- [ ] **Step 2: Implement turntable rotation**

- Mouse drag left/right rotates `worldContainer` (2D rotation simulated by scaling X axis)
- 5 pre-rendered angle states (0°, 72°, 144°, 216°, 288°)
- Between angles: interpolate sprite appearances
- Auto-rotate when idle (slow rotation via PixiJS ticker)
- Display current angle and view name

- [ ] **Step 3: Subscribe to trainStore**

Re-render train on platform whenever `trainStore.trains` changes (head, carriages, style updates).

- [ ] **Step 4: Verify turntable**

```bash
npm run dev
```

Expected: Assembly mode shows 2.5D train on glowing platform. Drag to rotate. Add carriages from catalog, they appear on platform. Change color, train updates in real-time.

- [ ] **Step 5: Commit**

```bash
git add src/engine/AssemblyRenderer.ts && git commit -m "feat: 2.5D assembly renderer with turntable rotation"
```

---

## Phase 5: Run Simulation

### Task 12: Simulation engine

**Files:**
- Create: `src/engine/SimulationEngine.ts`
- Test: `tests/engine/SimulationEngine.test.ts`

- [ ] **Step 1: Write SimulationEngine tests**

```typescript
// tests/engine/SimulationEngine.test.ts
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('SimulationEngine', () => {
  it('moves train along line path', () => {
    const engine = new SimulationEngine();
    engine.setLine({
      id: 'l1', name: 'Red', color: '#ff0000',
      stationIds: ['s1', 's2', 's3'],
    });
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 5, y: 0 },
      { id: 's3', x: 10, y: 0 },
    ]);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 180 });

    engine.tick(1); // 1 simulated second
    const train = engine.getTrainState('t1');
    expect(train.progress).toBeGreaterThan(0);
    expect(train.direction).toBe(1); // forward
  });

  it('generates passengers at stations', () => {
    const engine = new SimulationEngine();
    engine.setStations([{ id: 's1', x: 0, y: 0 }]);
    engine.tick(60); // 1 simulated minute
    const waiting = engine.getWaitingPassengers('s1');
    expect(waiting).toBeGreaterThanOrEqual(2);
    expect(waiting).toBeLessThanOrEqual(5);
  });

  it('applies rush hour multiplier', () => {
    const engine = new SimulationEngine();
    engine.setStations([{ id: 's1', x: 0, y: 0 }]);
    engine.setTime(120); // 8:00 AM = minute 120 from 6AM
    engine.tick(60);
    const waiting = engine.getWaitingPassengers('s1');
    // Rush hour 3x, so 6-15 passengers per minute
    expect(waiting).toBeGreaterThanOrEqual(6);
  });

  it('boards passengers when train stops', () => {
    const engine = new SimulationEngine();
    engine.setLine({
      id: 'l1', name: 'Red', color: '#ff0000',
      stationIds: ['s1', 's2'],
    });
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 3, y: 0 },
    ]);
    engine.preloadPassengers('s1', 50);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 180 });

    // Tick enough for train to reach s2 and stop
    for (let i = 0; i < 100; i++) engine.tick(1);
    const train = engine.getTrainState('t1');
    expect(train.passengers).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement SimulationEngine**

Core tick-based simulation:
- `tick(deltaSeconds)`: called per frame
- **Train movement:** Each train has `progress` (0-1 between current and next station), `currentStationIndex`, `direction` (+1 or -1). Per tick, advance progress based on speed and grid distance.
- **Station stops:** When progress reaches 1.0, stop at station. Dwell for 10 sim-seconds. Board/alight passengers. Then advance to next station (or reverse at terminal).
- **Passenger generation:** Per tick, for each station, accumulate fractional passengers. When >= 1, spawn integer count. Base rate 2-5 per sim-minute. Rush hour (time 120±30 or 720±30 from 6AM) → 3x multiplier.
- **Boarding:** When stopped, transfer min(waiting, remainingCapacity) passengers to train. Alight random count at each stop.
- **On-time tracking:** Record expected vs actual arrival times.

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/engine/SimulationEngine.test.ts
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/SimulationEngine.ts tests/engine/SimulationEngine.test.ts && git commit -m "feat: simulation engine with train movement, passengers, and on-time tracking"
```

---

### Task 13: Simulation mode rendering and UI

**Files:**
- Create: `src/engine/TrainSpriteRenderer.ts`
- Create: `src/components/simulation/SpeedControls.tsx`, `DeploymentPanel.tsx`, `LiveOpsPanel.tsx`, `TrainDetailPanel.tsx`

- [ ] **Step 1: Create TrainSpriteRenderer**

Renders trains on the blueprint canvas during simulation:
- Colored rounded rectangles for head + carriages
- Position interpolated along track path based on `progress`
- Motion trail: fading polyline behind train (last N positions)
- Pulsing ring animation when approaching station
- "STOPPED" label when dwelling
- Passenger dots: small yellow circles animating between station and train during boarding

- [ ] **Step 2: Build DeploymentPanel**

Right panel sub-component:
- Lists all lines with their color and name
- "Deploy Train" button per line → opens train inventory picker
- Shows currently deployed trains per line

- [ ] **Step 3: Build SpeedControls**

Top bar addition in simulation mode:
- 1x / 2x / 4x toggle buttons
- Play / Pause button
- Time display: formats `simulationStore.time` as "HH:MM AM/PM"

- [ ] **Step 4: Build LiveOpsPanel**

Right panel in simulation mode:
- Total passengers + trend
- On-time rate progress bar
- Per-line: color dot, name, status, train count, passenger count
- Subscribes to `simulationStore.stats`

- [ ] **Step 5: Build TrainDetailPanel**

Sub-panel when a train is clicked:
- Train name + current station
- Car count
- Capacity bar (current / max passengers)
- Next station + ETA
- Speed
- Status (Running / Stopped / Loading)

- [ ] **Step 6: Wire simulation loop**

In `GameCanvas`, when mode is `simulation`:
- Connect PixiJS ticker to `SimulationEngine.tick(delta)`
- SimulationEngine reads map data from `mapStore`, train data from `trainStore`
- Each tick updates `simulationStore` stats
- `TrainSpriteRenderer` reads train positions from engine and renders

- [ ] **Step 7: Verify full simulation**

```bash
npm run dev
```

Expected: Deploy a train to a line. Press play. Train moves along track with glow trail. Stops at stations, passenger dots animate. LiveOpsPanel shows increasing passenger count. Speed controls work.

- [ ] **Step 8: Commit**

```bash
git add src/engine/TrainSpriteRenderer.ts src/components/simulation/ && git commit -m "feat: simulation mode with train animation, deployment, and live ops panel"
```

---

## Phase 6: Save System

### Task 14: Save, load, export, undo/redo

**Files:**
- Create: `src/stores/saveStore.ts`, `src/components/shared/SaveLoadDialog.tsx`
- Test: `tests/stores/saveStore.test.ts`

- [ ] **Step 1: Write saveStore tests**

```typescript
// tests/stores/saveStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSaveStore } from '../../src/stores/saveStore';
import { useMapStore } from '../../src/stores/mapStore';

describe('saveStore', () => {
  beforeEach(() => {
    useSaveStore.getState().reset();
    useMapStore.getState().reset();
    localStorage.clear();
  });

  it('saves and loads game state', () => {
    useMapStore.getState().addStation('Test', 1, 1);
    useSaveStore.getState().save('slot1', 'My City');
    useMapStore.getState().reset();
    expect(useMapStore.getState().stations).toHaveLength(0);

    useSaveStore.getState().load('slot1');
    expect(useMapStore.getState().stations).toHaveLength(1);
    expect(useMapStore.getState().stations[0].name).toBe('Test');
  });

  it('exports game as JSON string', () => {
    useMapStore.getState().addStation('Export Test', 2, 3);
    const json = useSaveStore.getState().exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.map.stations[0].name).toBe('Export Test');
  });

  it('supports undo/redo', () => {
    const { pushUndoState, undo, redo } = useSaveStore.getState();
    useMapStore.getState().addStation('A', 0, 0);
    pushUndoState();
    useMapStore.getState().addStation('B', 1, 1);
    pushUndoState();

    undo();
    expect(useMapStore.getState().stations).toHaveLength(1);
    redo();
    expect(useMapStore.getState().stations).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement saveStore**

- `save(slot, name)`: serialize all stores to `GameSave`, write to `localStorage`
- `load(slot)`: read from `localStorage`, hydrate all stores
- `exportJSON()`: returns serialized `GameSave` as string
- `importJSON(json)`: parse and hydrate stores
- `pushUndoState()`: snapshot current state to undo stack
- `undo()` / `redo()`: restore from stack
- Auto-save: debounced `save('autosave')` called from store subscribers

- [ ] **Step 3: Build SaveLoadDialog component**

Modal with:
- 5 save slots showing name + last modified
- Save / Load / Delete buttons per slot
- Export button (triggers JSON file download)
- Import button (file input, reads JSON)

- [ ] **Step 4: Wire Ctrl+Z / Ctrl+Y**

Add global keydown listener for undo/redo shortcuts. Call `pushUndoState()` after each user action (station add/delete, track connect, train modify).

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/stores/saveStore.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/saveStore.ts src/components/shared/SaveLoadDialog.tsx tests/stores/saveStore.test.ts && git commit -m "feat: save system with slots, export/import, and undo/redo"
```

---

## Phase 7: Challenge Mode

### Task 15: Challenge level definitions and game flow

**Files:**
- Create: `src/data/challengeLevels.ts`

- [ ] **Step 1: Define 3 MVP levels**

```typescript
// src/data/challengeLevels.ts
export interface ChallengeLevel {
  id: string;
  name: string;
  description: string;
  prebuilt?: {
    stations: { name: string; x: number; y: number }[];
    lines?: { name: string; color: string; stationNames: string[] }[];
  };
  objectives: {
    type: 'connect-stations' | 'transport-passengers' | 'on-time-rate';
    target: number;
    maxLines?: number;
    timeLimitMinutes?: number;
  }[];
  stars: {
    one: string;
    two: string;
    three: string;
  };
  unlocks: string[];
}

export const challengeLevels: ChallengeLevel[] = [
  {
    id: 'first-line',
    name: 'First Line',
    description: 'Build a single line connecting 3 stations. Learn the basics!',
    prebuilt: {
      stations: [
        { name: '西城站', x: 2, y: 5 },
        { name: '中央枢纽', x: 8, y: 5 },
        { name: '东城站', x: 14, y: 5 },
      ],
    },
    objectives: [
      { type: 'connect-stations', target: 3, maxLines: 1 },
    ],
    stars: {
      one: 'Connect all 3 stations',
      two: 'Complete in under 2 minutes',
      three: 'Use the shortest possible route',
    },
    unlocks: ['london-classic'],
  },
  {
    id: 'crosstown',
    name: 'Crosstown',
    description: 'Connect 5 residential zones with no more than 2 lines.',
    prebuilt: {
      stations: [
        { name: '北区', x: 7, y: 2 },
        { name: '西区', x: 2, y: 7 },
        { name: '中心区', x: 7, y: 7 },
        { name: '东区', x: 12, y: 7 },
        { name: '南区', x: 7, y: 12 },
      ],
    },
    objectives: [
      { type: 'connect-stations', target: 5, maxLines: 2 },
    ],
    stars: {
      one: 'Connect all 5 zones',
      two: 'Use no more than 2 lines',
      three: 'Create at least 1 interchange station',
    },
    unlocks: ['newyork-classic'],
  },
  {
    id: 'rush-hour',
    name: 'Rush Hour',
    description: 'Deploy trains on a 3-line network to handle rush hour traffic.',
    prebuilt: {
      stations: [
        { name: '西城站', x: 2, y: 5 },
        { name: '中央枢纽', x: 8, y: 5 },
        { name: '科技园', x: 14, y: 5 },
        { name: '北站', x: 8, y: 1 },
        { name: '南广场', x: 8, y: 9 },
        { name: '大中心站', x: 14, y: 9 },
        { name: '河滨站', x: 2, y: 9 },
      ],
      lines: [
        { name: '1号线', color: '#ff6b6b', stationNames: ['西城站', '中央枢纽', '科技园'] },
        { name: '2号线', color: '#74b9ff', stationNames: ['北站', '中央枢纽', '南广场'] },
        { name: '3号线', color: '#55efc4', stationNames: ['河滨站', '南广场', '大中心站'] },
      ],
    },
    objectives: [
      { type: 'transport-passengers', target: 5000, timeLimitMinutes: 10 },
      { type: 'on-time-rate', target: 85 },
    ],
    stars: {
      one: 'Transport 5,000 passengers',
      two: 'Maintain 85%+ on-time rate',
      three: 'Transport 8,000 passengers with 95%+ on-time',
    },
    unlocks: ['neo-future'],
  },
];
```

- [ ] **Step 2: Build challenge mode UI components**

Create `src/components/challenge/`:

- `LevelSelect.tsx` — Grid of 3 level cards. Each shows: level name, description, lock/unlock icon, star rating. Accessed from TopBar via a "Challenge" button (shown alongside Sandbox when not in a challenge). On click → loads prebuilt data into `mapStore`, switches to appropriate mode.
- `ObjectiveTracker.tsx` — Floating HUD overlay (top-center) during challenge gameplay. Shows objective progress bars (e.g., "Stations connected: 2/3", "Passengers: 3200/5000"). Subscribes to `mapStore` and `simulationStore`.
- `VictoryScreen.tsx` — Modal dialog on objective completion. Shows star rating (1-3 stars), unlock rewards, "Next Level" / "Replay" / "Back to Menu" buttons.

Integration:
- `uiStore` gains a `challengeId: string | null` field. When set, the game is in challenge mode.
- `App.tsx` renders `ObjectiveTracker` as overlay when `challengeId` is set.
- `TopBar` shows "Exit Challenge" button when in challenge mode.

- [ ] **Step 3: Wire objective checking**

Subscribe to `mapStore` and `simulationStore`. After each change, check if level objectives are met. Show completion dialog with star rating.

- [ ] **Step 4: Commit**

```bash
git add src/data/challengeLevels.ts src/components/challenge/ && git commit -m "feat: challenge mode with 3 MVP levels and objective tracking"
```

---

## Phase 8: Polish

### Task 16: Mini-map

**Files:**
- Create: `src/components/shared/MiniMap.tsx`

- [ ] **Step 1: Build MiniMap component**

Bottom-right overlay:
- Small canvas rendering all stations (dots) and tracks (thin lines) at miniature scale
- White rectangle shows current viewport
- Click on mini-map to jump camera to that location
- Updates in real-time as player builds

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/MiniMap.tsx && git commit -m "feat: mini-map with viewport indicator"
```

---

### Task 17: LOD system

**Files:**
- Modify: `src/engine/StationRenderer.ts`, `src/engine/TrackRenderer.ts`

- [ ] **Step 1: Implement LOD thresholds**

Subscribe to `uiStore.zoomLevel`:
- `>= 1.0`: full detail (names, glow, trains, interchange markers)
- `0.5 - 1.0`: station circles + names, glow, hide trains
- `0.25 - 0.5`: stations as dots, hide names, thin colored lines

Update renderers to check zoom level and adjust:
- Text visibility
- Glow filter intensity
- Line width
- Station circle radius

- [ ] **Step 2: Verify LOD transitions**

Zoom in and out. Details should appear/disappear smoothly at thresholds.

- [ ] **Step 3: Commit**

```bash
git add src/engine/StationRenderer.ts src/engine/TrackRenderer.ts && git commit -m "feat: LOD system for zoom-dependent detail levels"
```

---

### Task 18: Decorative city elements

**Files:**
- Create: `src/engine/CityDecorations.ts`

- [ ] **Step 1: Add auto-generated city elements**

Simple decorative background elements for sandbox mode:
- Small rectangular building blocks (semi-transparent, various sizes)
- River/water areas (blue-tinted rectangles)
- Randomly placed within the initial viewport area
- Very subtle — should not distract from track building
- Only visible at zoom >= 0.5

- [ ] **Step 2: Commit**

```bash
git add src/engine/CityDecorations.ts && git commit -m "feat: decorative city background elements"
```

---

### Task 19: Final integration testing and cleanup

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Manual end-to-end testing**

Test the full flow:
1. Track Design: place 5+ stations, create 2 lines, connect tracks
2. Assembly: build 2 trains with different styles
3. Simulation: deploy trains, run sim, verify passengers and on-time tracking
4. Save/Load: save game, reload, verify state persists
5. Challenge: complete Level 1 "First Line"
6. Canvas: zoom in/out to verify LOD, pan around large map

- [ ] **Step 3: Build for production**

```bash
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: final integration and cleanup"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-4 | Project scaffold, types, utils, stores |
| 2 | 5-6 | App shell, PixiJS canvas, blueprint grid |
| 3 | 7-9 | Track design: stations, tracks, quadtree |
| 4 | 10-11 | Train assembly: catalog, turntable, customization |
| 5 | 12-13 | Simulation: engine, rendering, live ops |
| 6 | 14 | Save/load, export, undo/redo |
| 7 | 15 | Challenge mode: 3 levels, objectives |
| 8 | 16-19 | Polish: mini-map, LOD, decorations, testing |
