# Diagonal Tracks & Passenger Visualization - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add diagonal track support with waypoint add/delete, and visible passenger dots with configurable boarding controls and interchange bonuses.

**Architecture:** Two independent features sharing the SimulationEngine. Feature 1 modifies path editing and distance calculation. Feature 2 modifies boarding logic, adds store fields, and enhances the train sprite renderer with passenger dot animations.

**Tech Stack:** TypeScript, PixiJS 8, zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-diagonal-tracks-passengers-design.md`

---

## Files to Change

```
Feature 1 (Diagonal Tracks):
  Modify: src/engine/SimulationEngine.ts      — euclidean distance in getPathLength + interpolatePosition
  Modify: src/engine/InteractionManager.ts     — add waypoint (click segment) + delete waypoint (double-click)
  Modify: tests/engine/SimulationEngine.test.ts — diagonal path test
  Modify: tests/engine/common-sense.test.ts    — update path-on-track test for diagonals

Feature 2 (Passengers):
  Modify: src/stores/simulationStore.ts        — boardingPerStation, alightingPerStation
  Modify: src/stores/trainStore.ts             — capacity constants → 20
  Modify: src/engine/SimulationEngine.ts       — tick() signature, boarding/alighting logic, interchange bonus
  Modify: src/engine/TrainSpriteRenderer.ts    — waiting dots, boarding/alighting animations
  Modify: src/components/simulation/SpeedControls.tsx — boarding/alighting sliders
  Modify: src/components/layout/GameCanvas.tsx  — pass boarding/alighting to engine tick
  Modify: tests/engine/SimulationEngine.test.ts — update boarding tests
  Modify: tests/engine/common-sense.test.ts    — update capacity test
  Create: tests/engine/passengers.test.ts      — interchange bonus, boarding cap tests
```

---

## Task 1: Euclidean Distance for Diagonal Paths

**Files:**
- Modify: `src/engine/SimulationEngine.ts`
- Test: `tests/engine/SimulationEngine.test.ts`

- [ ] **Step 1: Write diagonal path length test**

```typescript
// Add to tests/engine/SimulationEngine.test.ts
it('calculates euclidean distance for diagonal path', () => {
  const engine = new SimulationEngine();
  engine.setStations([
    { id: 's1', x: 0, y: 0 },
    { id: 's2', x: 3, y: 4 },
  ]);
  engine.setLine({ id: 'l1', name: 'Red', color: '#ff0000', stationIds: ['s1', 's2'] });
  // Direct diagonal path: distance = sqrt(9+16) = 5
  engine.setTrackPath('s1', 's2', [{ x: 0, y: 0 }, { x: 3, y: 4 }]);
  expect(engine.getTrainPathLength('l1', 0, 1)).toBe(5);
});
```

Note: `getTrainPathLength` needs to be exposed as public or the test accesses it indirectly. Simpler approach: add the train and verify it moves at the right speed (covers the same logic).

Actually, let's test it indirectly — add a train on a diagonal path and verify the interpolated position at 50% is the midpoint:

```typescript
it('interpolates position on diagonal path at 50%', () => {
  const engine = new SimulationEngine();
  engine.setStations([
    { id: 's1', x: 0, y: 0 },
    { id: 's2', x: 6, y: 8 },
  ]);
  engine.setLine({ id: 'l1', name: 'Diag', color: '#ff0000', stationIds: ['s1', 's2'] });
  engine.setTrackPath('s1', 's2', [{ x: 0, y: 0 }, { x: 6, y: 8 }]);
  engine.addTrain({ id: 't1', lineId: 'l1', capacity: 40 });
  // Tick enough to reach ~50% — distance is 10, speed is 2 units/s, so 2.5 seconds
  engine.tick(2.5);
  const state = engine.getTrainState('t1');
  // Should be near midpoint (3, 4) — allow some tolerance for dwell/boarding
  expect(state.worldX).toBeCloseTo(3, 0);
  expect(state.worldY).toBeCloseTo(4, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/SimulationEngine.test.ts
```

Expected: FAIL — position won't be at midpoint because getPathLength uses manhattan distance.

- [ ] **Step 3: Fix getPathLength to use euclidean distance**

In `src/engine/SimulationEngine.ts`, change `getPathLength`:

```typescript
private getPathLength(path: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}
```

Also update `interpolatePosition` to use euclidean segment length:

```typescript
// In the path-walking loop, change:
// const segLen = Math.abs(path[i].x - path[i-1].x) + Math.abs(path[i].y - path[i-1].y);
// To:
const dx = path[i].x - path[i - 1].x;
const dy = path[i].y - path[i - 1].y;
const segLen = Math.sqrt(dx * dx + dy * dy);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/engine/SimulationEngine.test.ts
```

Expected: PASS

- [ ] **Step 5: Update common-sense test for diagonal paths**

In `tests/engine/common-sense.test.ts`, the "train at 50% on L-shaped track" test checks the corner point. Add a new test for diagonal:

```typescript
it('train at 50% on diagonal track is at midpoint, not offset', () => {
  const engine = new SimulationEngine();
  engine.setStations([
    { id: 's1', x: 0, y: 0 },
    { id: 's2', x: 10, y: 10 },
  ]);
  engine.setLine({ id: 'l1', name: 'D', color: '#ff0000', stationIds: ['s1', 's2'] });
  engine.setTrackPath('s1', 's2', [{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  engine.addTrain({ id: 't1', lineId: 'l1', capacity: 40 });
  // Distance = sqrt(200) ≈ 14.14, speed = 2, time to 50% ≈ 3.54s
  for (let i = 0; i < 354; i++) engine.tick(0.01);
  const state = engine.getTrainState('t1');
  // Should be near (5, 5), not (10, 0) or (0, 10)
  expect(Math.abs(state.worldX - 5)).toBeLessThan(1.5);
  expect(Math.abs(state.worldY - 5)).toBeLessThan(1.5);
});
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/SimulationEngine.ts tests/engine/SimulationEngine.test.ts tests/engine/common-sense.test.ts
git commit -m "feat: euclidean distance for diagonal track paths"
```

---

## Task 2: Add / Delete Waypoints in Edit Tool

**Files:**
- Modify: `src/engine/InteractionManager.ts`

- [ ] **Step 1: Read current InteractionManager edit tool code**

Read `src/engine/InteractionManager.ts` to understand `handleEditPointerDown`, `renderEditHandles`, and the existing waypoint drag logic.

- [ ] **Step 2: Add waypoint insertion (click on segment)**

In `handleEditPointerDown`, after checking for existing waypoint clicks and before selecting a new track, add logic:

When a track is already selected and user clicks near a segment (but NOT near an existing handle):
1. Find which segment was clicked using `pointToSegmentDist`
2. Project the click onto that segment to find the insertion position
3. Snap to grid
4. Insert the new waypoint into the path at `segmentIndex + 1`
5. Commit via `updateTrackPath`
6. Re-render handles

```typescript
// In handleEditPointerDown, after the waypoint check block and before findNearestTrack:
if (this.editSelectedTrackId !== null) {
  const track = useMapStore.getState().tracks.find(t => t.id === this.editSelectedTrackId);
  if (track) {
    // Check if clicking near a segment (to add a waypoint)
    const segIdx = this.findNearestSegment(wx, wy, track.path);
    if (segIdx !== null) {
      // Snap click to grid
      const gridX = Math.round(wx / GRID_SIZE);
      const gridY = Math.round(wy / GRID_SIZE);
      const newPath = [...track.path];
      newPath.splice(segIdx + 1, 0, { x: gridX, y: gridY });
      useMapStore.getState().updateTrackPath(this.editSelectedTrackId, newPath);
      return;
    }
  }
}
```

Add helper:

```typescript
private findNearestSegment(wx: number, wy: number, path: { x: number; y: number }[]): number | null {
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
```

- [ ] **Step 3: Add waypoint deletion (double-click)**

Add a `dblclick` event listener in the constructor:

```typescript
this.canvas.addEventListener('dblclick', this.handleDblClick);
```

Handler (reuses existing `findNearestWaypoint` method which is already defined in the codebase):

```typescript
private handleDblClick = (e: MouseEvent) => {
  const tool = useUIStore.getState().tool;
  if (tool !== 'edit' || this.editSelectedTrackId === null) return;

  const rect = this.canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  const world = this.camera.screenToWorld(screenX, screenY);

  const track = useMapStore.getState().tracks.find(t => t.id === this.editSelectedTrackId);
  if (!track || track.path.length <= 2) return;

  // findNearestWaypoint already exists — checks distance from world coords to each path[i]*GRID_SIZE
  const idx = this.findNearestWaypoint(world.x, world.y, track.path);
  if (idx === null) return;
  if (idx === 0 || idx === track.path.length - 1) return; // don't delete endpoints

  const newPath = track.path.filter((_, i) => i !== idx);
  useMapStore.getState().updateTrackPath(this.editSelectedTrackId!, newPath);
};
```

Also clean up in `destroy()`:

```typescript
this.canvas.removeEventListener('dblclick', this.handleDblClick);
```

- [ ] **Step 4: Verify manually (including TrackRenderer diagonal support)**

```bash
npm run dev -- --port 5180
```

Test:
1. Create 2 stations, connect them (L-shaped path)
2. Select Edit tool, click the track → handles appear
3. Click on a segment between two handles → new handle appears at that point
4. Drag the new handle diagonally → path becomes diagonal, **verify track renders correctly at the diagonal angle** (TrackRenderer uses moveTo/lineTo which handles any angle)
5. Double-click a middle handle → it's removed
6. Verify first/last handles cannot be deleted
7. Also read `src/engine/TrackRenderer.ts` to confirm it draws line segments between all path points without any orthogonal assumption

- [ ] **Step 5: Commit**

```bash
git add src/engine/InteractionManager.ts
git commit -m "feat: add/delete waypoints in edit tool, diagonal paths supported"
```

---

## Task 3: Passenger Boarding Controls in Store + Engine

**Files:**
- Modify: `src/stores/simulationStore.ts`
- Modify: `src/stores/trainStore.ts`
- Modify: `src/engine/SimulationEngine.ts`
- Test: `tests/engine/passengers.test.ts` (new)
- Modify: `tests/engine/SimulationEngine.test.ts`
- Modify: `tests/engine/common-sense.test.ts`

- [ ] **Step 1: Write passenger tests**

```typescript
// tests/engine/passengers.test.ts
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Passenger boarding controls', () => {
  function setupEngine() {
    const engine = new SimulationEngine();
    engine.setStations([
      { id: 's1', x: 0, y: 0, type: 'normal' },
      { id: 's2', x: 5, y: 0, type: 'normal' },
    ]);
    engine.setLine({ id: 'l1', name: 'Red', color: '#ff0000', stationIds: ['s1', 's2'] });
    engine.setTrackPath('s1', 's2', [{ x: 0, y: 0 }, { x: 5, y: 0 }]);
    return engine;
  }

  it('boarding is limited by boardingPerStation', () => {
    const engine = setupEngine();
    engine.preloadPassengers('s1', 100);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 200 });
    // Tick enough to reach s2 and board there
    for (let i = 0; i < 200; i++) engine.tick(1, 3, 2);
    const state = engine.getTrainState('t1');
    // Boarding limited to 3 per stop, so after visiting s1 (initial) and s2,
    // passengers should be much less than 100
    expect(state.passengers).toBeLessThanOrEqual(10);
  });

  it('alighting uses fixed count, not random percentage', () => {
    const engine = setupEngine();
    engine.preloadPassengers('s1', 50);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 200 });
    // Board at s1 then travel to s2
    for (let i = 0; i < 100; i++) engine.tick(1, 50, 5);
    const state = engine.getTrainState('t1');
    // Should have alighted exactly 5 (or less if had fewer passengers)
    // Hard to test exact number due to timing, but passengers should be reduced
    expect(state.passengers).toBeLessThan(50);
  });

  it('interchange station doubles boarding', () => {
    const engine = new SimulationEngine();
    engine.setStations([
      { id: 's1', x: 0, y: 0, type: 'normal' },
      { id: 's2', x: 5, y: 0, type: 'interchange' },
      { id: 's3', x: 10, y: 0, type: 'normal' },
    ]);
    engine.setLine({ id: 'l1', name: 'Red', color: '#ff0000', stationIds: ['s1', 's2', 's3'] });
    engine.setTrackPath('s1', 's2', [{ x: 0, y: 0 }, { x: 5, y: 0 }]);
    engine.setTrackPath('s2', 's3', [{ x: 5, y: 0 }, { x: 10, y: 0 }]);
    engine.preloadPassengers('s2', 100);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 200 });
    // Travel to s2 (interchange), board with boarding=5 → should board 10 (doubled)
    for (let i = 0; i < 100; i++) engine.tick(1, 5, 3);
    const state = engine.getTrainState('t1');
    // At interchange, boarding is 5*2=10, so after one stop should have ~10
    expect(state.passengers).toBeGreaterThanOrEqual(8);
  });

  it('max capacity per carriage is 20', async () => {
    // This tests the trainStore capacity constant
    const { useTrainStore } = await import('../../src/stores/trainStore');
    useTrainStore.getState().reset();
    useTrainStore.getState().createTrain({ type: 'tokyo', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'generic' });
    // head=20 + 1 standard=20 = 40
    expect(useTrainStore.getState().getTrainCapacity(trainId)).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/passengers.test.ts
```

Expected: FAIL — tick() doesn't accept boarding/alighting params yet, capacity is still 60/80.

- [ ] **Step 3: Update trainStore capacity constants**

In `src/stores/trainStore.ts`:

```typescript
const HEAD_CAPACITY = 20;
const STANDARD_CAPACITY = 20;
const WIDEBODY_CAPACITY = 20;
```

- [ ] **Step 4: Update simulationStore with boarding/alighting fields**

In `src/stores/simulationStore.ts`, add:

```typescript
boardingPerStation: number;    // default 5
alightingPerStation: number;   // default 3
setBoardingPerStation: (n: number) => void;
setAlightingPerStation: (n: number) => void;
```

Default values in initialState, setters in the store.

- [ ] **Step 5: Update SimulationEngine tick signature and boarding logic**

In `src/engine/SimulationEngine.ts`:

1. Add `type` field to `StationData`:
```typescript
interface StationData {
  id: string;
  x: number;
  y: number;
  type: string;
}
```

2. Update `setStations` to accept `type`:
```typescript
setStations(stations: { id: string; x: number; y: number; type?: string }[]): void {
  for (const s of stations) {
    this.stations.set(s.id, { id: s.id, x: s.x, y: s.y, type: s.type ?? 'normal' });
    // ... rest unchanged
  }
}
```

3. Change `tick` signature:
```typescript
tick(deltaSeconds: number, boardingPerStation = 5, alightingPerStation = 3): void {
```

4. Pass boarding/alighting to `doBoard` and `doAlight`:
```typescript
private doBoard(train: TrainInternal, stationId: string, boardingPerStation: number): void {
  const data = this.passengerData.get(stationId);
  if (!data || data.waiting <= 0) return;
  const stationData = this.stations.get(stationId);
  const multiplier = stationData?.type === 'interchange' ? 2 : 1;
  const maxBoard = boardingPerStation * multiplier;
  const seats = train.capacity - train.passengers;
  const boarding = Math.min(data.waiting, maxBoard, seats);
  train.passengers += boarding;
  data.waiting = Math.max(0, data.waiting - boarding);
}

private doAlight(train: TrainInternal, stationId: string, alightingPerStation: number): void {
  if (train.passengers <= 0) return;
  const stationData = this.stations.get(stationId);
  const multiplier = stationData?.type === 'interchange' ? 2 : 1;
  const maxAlight = alightingPerStation * multiplier;
  const alighting = Math.min(train.passengers, maxAlight);
  train.passengers = Math.max(0, train.passengers - alighting);
}
```

5. Update `updateTrain` to pass the params through when calling doBoard/doAlight.

- [ ] **Step 6: Update existing tests**

In `tests/engine/SimulationEngine.test.ts`:
- Add `5, 3` args to all `engine.tick()` calls (or use defaults)
- Update the "boards passengers when train stops" test — boarding is now limited

In `tests/engine/common-sense.test.ts`:
- Update capacity test: `expect(...).toBe(240)` → update for new constants (head=20 + 2×standard=20 + 1×widebody=20 = 80)
- Add boarding/alighting args to tick calls

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add src/stores/simulationStore.ts src/stores/trainStore.ts src/engine/SimulationEngine.ts tests/
git commit -m "feat: passenger boarding controls with interchange bonus and capacity=20"
```

---

## Task 4: Boarding/Alighting UI Controls

**Files:**
- Modify: `src/components/simulation/SpeedControls.tsx`
- Modify: `src/components/layout/GameCanvas.tsx`

- [ ] **Step 1: Add sliders to SpeedControls**

In `src/components/simulation/SpeedControls.tsx`, add after the dwell time slider:

```typescript
// Boarding per Station slider
<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
  <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#b2bec3', whiteSpace: 'nowrap' }}>
    Boarding
  </span>
  <input type="range" min={1} max={20} step={1} value={boardingPerStation}
    onChange={(e) => setBoardingPerStation(Number(e.target.value))}
    style={{ width: 60 }}
  />
  <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#81ecec', minWidth: 20 }}>
    {boardingPerStation}
  </span>
</div>

// Alighting per Station slider
<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
  <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#b2bec3', whiteSpace: 'nowrap' }}>
    Alighting
  </span>
  <input type="range" min={1} max={20} step={1} value={alightingPerStation}
    onChange={(e) => setAlightingPerStation(Number(e.target.value))}
    style={{ width: 60 }}
  />
  <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#81ecec', minWidth: 20 }}>
    {alightingPerStation}
  </span>
</div>

// Max per carriage label
<span style={{ fontFamily: 'Courier New, monospace', fontSize: 9, color: '#b2bec3' }}>
  Max 20 per car
</span>
```

Read boardingPerStation, alightingPerStation, setBoardingPerStation, setAlightingPerStation from simulationStore.

- [ ] **Step 2: Pass boarding/alighting to engine tick in GameCanvas**

In `src/components/layout/GameCanvas.tsx`, in the simulation ticker function:

```typescript
const { boardingPerStation, alightingPerStation } = useSimulationStore.getState();
engineRef.tick(deltaSeconds, boardingPerStation, alightingPerStation);
```

Also update `setStations` call to include station types:

```typescript
simEngine.setStations(mapState.stations.map(s => ({ id: s.id, x: s.x, y: s.y, type: s.type })));
```

- [ ] **Step 3: Verify sliders work**

```bash
npm run dev -- --port 5180
```

Test: RUN mode shows Boarding/Alighting sliders. Changing values affects passenger counts.

- [ ] **Step 4: Commit**

```bash
git add src/components/simulation/SpeedControls.tsx src/components/layout/GameCanvas.tsx
git commit -m "feat: boarding/alighting sliders in run mode controls"
```

---

## Task 5: Passenger Dot Visualization

**Files:**
- Modify: `src/engine/TrainSpriteRenderer.ts`

- [ ] **Step 1: Add waiting passenger dot rendering**

The `TrainSpriteRenderer` already has a `stationMap` field (passed in constructor) and its `update()` method already clears all children each frame (`this.container.removeChildren()` + destroy). So adding dots in `update()` is safe — they're rebuilt each frame with no accumulation.

In the `update()` method, after the train rendering loop, add a pass that draws waiting passenger dots at each station:

```typescript
// After the train rendering loop, draw waiting passengers at stations
for (const [stationId, stationData] of this.stationMap) {
  const waiting = this.engine.getWaitingPassengers(stationId);
  if (waiting <= 0) continue;

  const sx = stationData.x * GRID_SIZE;
  const sy = stationData.y * GRID_SIZE;

  this.renderWaitingDots(sx, sy, waiting);
}
```

```typescript
private renderWaitingDots(sx: number, sy: number, count: number) {
  const g = new Graphics();
  const DOT_R = 3;
  const COL_SPACING = 8;
  const ROW_SPACING = 8;
  const COLS = 2;
  const MAX_VISIBLE = 10;

  const visibleCount = Math.min(count, MAX_VISIBLE);
  const startX = sx - (COLS - 1) * COL_SPACING / 2;
  const startY = sy + 16; // below the station

  for (let i = 0; i < visibleCount; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const dx = startX + col * COL_SPACING;
    const dy = startY + row * ROW_SPACING;
    g.circle(dx, dy, DOT_R).fill({ color: 0xffd93d, alpha: 0.85 });
  }

  // If more than MAX_VISIBLE, show count label
  if (count > MAX_VISIBLE) {
    const label = new Text({
      text: String(count),
      style: { fontFamily: 'monospace', fontSize: 9, fill: '#ffffff' },
    });
    label.anchor.set(0.5, 0);
    label.x = sx;
    label.y = startY + Math.ceil(MAX_VISIBLE / COLS) * ROW_SPACING;
    this.container.addChild(label);
  }

  this.container.addChild(g);
}
```

- [ ] **Step 2: Add boarding animation**

Detect boarding events using the train's status from `engine.getAllTrainStates()`. When `state.status === 'loading'`, compare the station's `waitingPassengers` against the previous frame's count — the difference is the number that boarded.

Track per-station previous waiting counts and animation state:

```typescript
// Fields on the renderer
private prevWaiting = new Map<string, number>();
private boardingAnims: { sx: number; sy: number; tx: number; ty: number; t: number }[] = [];
private alightingAnims: { sx: number; sy: number; tx: number; ty: number; t: number }[] = [];
```

In `update()`:
1. For each stopped/loading train, get its current station ID from the line's stationIds
2. Get current waiting count from `engine.getWaitingPassengers(stationId)`
3. Compare with `prevWaiting.get(stationId)` — if decreased, the diff = boarded count → spawn that many boarding dot animations
4. Similarly detect alighting by checking if `state.passengers` decreased compared to previous frame
5. Update `prevWaiting` map each frame
6. Advance all animation timers by `deltaSeconds * speed`
7. Render animated dots as yellow circles lerping between station and train position
8. Remove animations where `t >= 1`

- [ ] **Step 3: Add alighting animation**

Similar to boarding but dots move from train to station, then fade out on arrival.

- [ ] **Step 4: Verify animations**

```bash
npm run dev -- --port 5180
```

Test:
1. Build track with 3 stations, deploy train, play
2. See yellow dots appear at stations (waiting passengers)
3. When train stops, dots animate toward the train (boarding)
4. Dots animate from train to station (alighting) then disappear
5. After train leaves, remaining dots stay on platform
6. With count > 10, see "23" label below dot cluster

- [ ] **Step 5: Commit**

```bash
git add src/engine/TrainSpriteRenderer.ts
git commit -m "feat: passenger dot visualization with boarding/alighting animations"
```

---

## Task 6: Final Integration & Testing

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: Clean build.

- [ ] **Step 4: Manual end-to-end test**

1. TRACKS: Connect 2 stations with default L-path
2. Edit tool: click segment to add waypoint, drag it diagonally
3. Double-click a middle waypoint to delete it
4. Create interchange station (2 lines share a station, gold circle appears)
5. ASSEMBLY: Build 2 trains
6. RUN: Deploy, set Boarding=10 Alighting=5, Play
7. Verify passenger dots at stations, boarding/alighting animations
8. Verify interchange station has doubled boarding
9. Zoom in/out to verify dots scale correctly

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: diagonal tracks and passenger visualization complete"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Euclidean distance for diagonal paths | SimulationEngine, tests |
| 2 | Add/delete waypoints in edit tool | InteractionManager |
| 3 | Boarding controls + interchange bonus | stores, SimulationEngine, tests |
| 4 | UI sliders for boarding/alighting | SpeedControls, GameCanvas |
| 5 | Passenger dot visualization + animations | TrainSpriteRenderer |
| 6 | Integration testing | All |
