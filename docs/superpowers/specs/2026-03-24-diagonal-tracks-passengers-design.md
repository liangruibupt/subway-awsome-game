# Diagonal Tracks & Passenger Visualization - Design Spec

## Overview

Two enhancements to the subway game:
1. Track editing supports diagonal lines and adjustable bend points
2. Visible passenger figures on platforms with configurable boarding/alighting controls

## Feature 1: Smart Connect + Manual Path Editing

### Connect Tool (unchanged)

Default behavior stays the same: connect two stations, auto-generate L-shaped manhattan path (horizontal first, then vertical). No new modes or UI.

### Edit Tool (enhanced)

**Existing behavior (kept):**
- Click near a track to select it (cyan preview line + waypoint handles)
- Drag waypoint handles to move them (snaps to grid)
- Release to commit

**New: Diagonal support**
- Waypoints are no longer constrained to manhattan directions
- Dragging a waypoint to any grid intersection is allowed, even if it creates diagonal segments
- Track rendering draws line segments at any angle (not just horizontal/vertical)

**New: Add waypoint**
- When a track is selected, clicking on a track segment (not on an existing handle) inserts a new waypoint at that position
- The new waypoint is immediately draggable
- This lets the player reshape an L-shaped path into a multi-segment path with custom bends

**New: Delete waypoint**
- Double-clicking an existing waypoint handle removes it
- The path reconnects directly between the neighboring waypoints
- Cannot delete the first or last waypoint (they are the station endpoints)

### Rendering Changes

- `TrackRenderer`: draw line segments between all path points using `moveTo/lineTo`, no assumption of orthogonal angles
- Glow effect works the same (wide blur pass + sharp pass)
- LOD unchanged

### Data Model

- `Track.path: {x, y}[]` — unchanged format, but now can contain non-orthogonal sequences
- No schema change needed

### SimulationEngine Changes

- `getPathLength()`: already uses manhattan distance (`Math.abs(dx) + Math.abs(dy)` per segment). Change to euclidean distance (`Math.sqrt(dx² + dy²)`) per segment to handle diagonal paths correctly
- `interpolatePosition()`: already walks path segments — works with any angle, no change needed
- Train speed calculation: already based on path length, will auto-adjust for shorter diagonal paths

### InteractionManager Changes

**Edit tool — add waypoint:**
- When track is selected and user clicks near a segment (but NOT near an existing handle):
  - Find which segment was clicked (reuse `pointToSegmentDist`)
  - Project click point onto the segment to find exact insertion position
  - Snap to grid
  - Insert new waypoint into the path array at the correct index
  - Commit immediately via `updateTrackPath`
  - Re-render handles

**Edit tool — delete waypoint (double-click):**
- Track `dblclick` event on canvas
- Find nearest waypoint within hit radius
- If it's not the first or last point (station endpoints), remove it from path
- Commit via `updateTrackPath`

## Feature 2: Passenger Visualization & Boarding Controls

### Global Controls (Run Mode Top Bar)

Add to `SpeedControls.tsx` or a nearby component:
- **"Boarding per Station"** slider: range 1-20, default 5, step 1
- **"Alighting per Station"** slider: range 1-20, default 3, step 1
- **"Max per Carriage"** display: fixed at 20 (read-only label)

Store in `simulationStore`:
```typescript
boardingPerStation: number;   // default 5
alightingPerStation: number;  // default 3
setBoardingPerStation: (n: number) => void;
setAlightingPerStation: (n: number) => void;
```

### Capacity Changes

- Every carriage (standard and widebody): max 20 passengers
- Head car: max 20 passengers
- Total train capacity = 20 × (1 head + N carriages)
- Update `trainStore` constants: `HEAD_CAPACITY = 20`, `STANDARD_CAPACITY = 20`, `WIDEBODY_CAPACITY = 20`

### SimulationEngine Boarding Logic

Replace current boarding/alighting:

**Current:**
- Board: `min(waiting, capacity - passengers)`
- Alight: random 10-30% of passengers

**New:**
- Board: `min(waiting, boardingPerStation, capacity - passengers)`
- Alight: `min(passengers, alightingPerStation)`
- Engine reads boarding/alighting counts from parameters (passed in from store each tick)

**Interchange station bonus:**
- If station type is `'interchange'`: boarding and alighting counts are doubled
- Board: `min(waiting, boardingPerStation * 2, capacity - passengers)`
- Alight: `min(passengers, alightingPerStation * 2)`

Engine needs to know station types. Add to `setStations`:
```typescript
setStations(stations: { id: string; x: number; y: number; type?: string }[]): void;
```

### Platform Passenger Visualization

**In `TrainSpriteRenderer`:**

Draw waiting passengers as yellow dots (#ffd93d) around each station:
- Each dot: radius 3px, slight random offset from station center (spread in a cluster)
- Dot positions: arranged in a semicircle or grid pattern below/beside the station
- If waiting count <= 10: show exact number of dots
- If waiting count > 10: show 10 dots + a white text label with the count (e.g., "23")

**Boarding animation (when train is stopped/loading):**
- Dots move from station position toward the train position (lerp over ~0.5 seconds)
- Each boarding dot fades out as it reaches the train
- Number of animating dots = actual boarding count for this stop

**Alighting animation:**
- Dots appear at the train and move outward to the station position
- Fade in as they arrive at the station
- These dots then join the waiting cluster (or disappear if they "leave")

**Dwell time expiry:**
- When train departs, any remaining waiting dots stay at the station
- No animation — dots just remain in place
- The count updates: waiting = previous waiting - boarded

### Data Flow

```
simulationStore.boardingPerStation  ──┐
simulationStore.alightingPerStation ──┤
                                      ├──> GameCanvas ticker ──> engine.tick(delta, boarding, alighting)
mapStore.stations (with types) ───────┘
                                              │
                                              v
                                      engine.getWaitingPassengers(stationId) ──> TrainSpriteRenderer
                                      engine.getAllTrainStates() ──────────────> TrainSpriteRenderer
```

## Files to Change

### Feature 1 (Diagonal Tracks)
- `src/engine/InteractionManager.ts` — add waypoint insert (click segment) + delete (double-click)
- `src/engine/SimulationEngine.ts` — change `getPathLength` to use euclidean distance
- `src/engine/TrackRenderer.ts` — verify rendering works with non-orthogonal paths (likely already works)

### Feature 2 (Passengers)
- `src/stores/simulationStore.ts` — add boardingPerStation, alightingPerStation
- `src/stores/trainStore.ts` — change capacity constants to 20
- `src/engine/SimulationEngine.ts` — new boarding/alighting logic with interchange bonus
- `src/engine/TrainSpriteRenderer.ts` — draw waiting dots, boarding/alighting animations
- `src/components/simulation/SpeedControls.tsx` — add boarding/alighting sliders

### Tests
- `tests/engine/common-sense.test.ts` — update capacity test (240 → smaller values)
- `tests/engine/SimulationEngine.test.ts` — update passenger generation/boarding tests
- New test: diagonal path length calculation
- New test: interchange station doubles boarding
- New test: boarding limited by boardingPerStation setting
