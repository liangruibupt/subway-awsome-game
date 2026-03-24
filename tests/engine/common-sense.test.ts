import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useTrainStore } from '../../src/stores/trainStore';
import { manhattanPath } from '../../src/utils/geometry';

describe('Common-sense simulation invariants', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Train must stay on the track path
  // ─────────────────────────────────────────────────────────────────────────
  it('train position always lies on a path segment', () => {
    const engine = new SimulationEngine();
    engine.setLine({ id: 'l1', name: 'Blue', color: '#0000ff', stationIds: ['s1', 's2'] });
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 5, y: 3 },
    ]);
    // manhattanPath goes right to (5,0) then down to (5,3)
    const path = manhattanPath({ x: 0, y: 0 }, { x: 5, y: 3 });
    engine.setTrackPath('s1', 's2', path);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 100 });

    // Returns true if (px, py) lies on any axis-aligned segment in segs
    const isOnSegments = (px: number, py: number, segs: { x: number; y: number }[]): boolean => {
      const EPS = 1e-9;
      for (let i = 1; i < segs.length; i++) {
        const ax = segs[i - 1].x, ay = segs[i - 1].y;
        const bx = segs[i].x, by = segs[i].y;
        if (Math.abs(ay - by) < EPS) {
          // Horizontal segment: y must match, x must be within range
          if (Math.abs(py - ay) < EPS && px >= Math.min(ax, bx) - EPS && px <= Math.max(ax, bx) + EPS) return true;
        } else {
          // Vertical segment: x must match, y must be within range
          if (Math.abs(px - ax) < EPS && py >= Math.min(ay, by) - EPS && py <= Math.max(ay, by) + EPS) return true;
        }
      }
      return false;
    };

    // Tick 20 times at 0.1 s each (2 s total).
    // Path length = 8, speed = 2, so progress reaches 0.5 — well within the path.
    for (let i = 0; i < 20; i++) {
      engine.tick(0.1);
      const state = engine.getTrainState('t1');
      // Only check while the train is actively moving (not snapped to the start point at progress=0)
      if (state.status === 'running' && state.progress > 0) {
        expect(isOnSegments(state.worldX, state.worldY, path)).toBe(true);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Train reverses direction at both terminal stations
  // ─────────────────────────────────────────────────────────────────────────
  it('train reverses direction at both terminal stations', () => {
    const engine = new SimulationEngine();
    engine.setLine({ id: 'l1', name: 'Red', color: '#ff0000', stationIds: ['s1', 's2', 's3'] });
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 5, y: 0 },
      { id: 's3', x: 10, y: 0 },
    ]);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 100 });

    // speed=2, distance s1→s2=5 (2.5 s travel), dwell=10 s, distance s2→s3=5 (2.5 s travel)
    // Train reaches s3 at approximately t=15 s → comfortably within 30 ticks of 1 s each
    let reachedS3 = false;
    for (let i = 0; i < 30; i++) {
      engine.tick(1);
      const state = engine.getTrainState('t1');
      if (state.currentStationIndex === 2 && !reachedS3) {
        reachedS3 = true;
        expect(state.direction).toBe(-1);              // must flip to backward
        expect(state.nextStationIndex).toBe(1);        // must point back to s2, not beyond s3
      }
    }
    expect(reachedS3).toBe(true);

    // From s3, the train must travel back through s2 and reach s1.
    // Total return journey ≈ 25 s → within 30 more ticks.
    let reachedS1 = false;
    for (let i = 0; i < 30; i++) {
      engine.tick(1);
      const state = engine.getTrainState('t1');
      if (state.currentStationIndex === 0 && !reachedS1) {
        reachedS1 = true;
        expect(state.direction).toBe(1);               // must flip back to forward
        expect(state.nextStationIndex).toBe(1);        // must point forward to s2
      }
    }
    expect(reachedS1).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Train never exceeds capacity
  // ─────────────────────────────────────────────────────────────────────────
  it('train never boards more passengers than its capacity', () => {
    const engine = new SimulationEngine();
    engine.setLine({ id: 'l1', name: 'Green', color: '#00ff00', stationIds: ['s1', 's2'] });
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 10, y: 0 },
    ]);
    engine.preloadPassengers('s1', 200);
    // addTrain immediately boards at the spawn station
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 100 });

    const state = engine.getTrainState('t1');
    expect(state.passengers).toBeLessThanOrEqual(state.capacity);
    expect(state.passengers).toBeLessThanOrEqual(100);

    // Remaining waiting = exactly what wasn't boarded
    const remaining = engine.getWaitingPassengers('s1');
    expect(remaining).toBe(200 - state.passengers);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Passengers can only board at stations (not while running)
  // ─────────────────────────────────────────────────────────────────────────
  it('train passenger count does not change while running between stations', () => {
    const engine = new SimulationEngine();
    engine.setLine({ id: 'l1', name: 'Yellow', color: '#ffff00', stationIds: ['s1', 's2'] });
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 20, y: 0 },  // distance=20; with speed=2, takes 10 s to reach s2
    ]);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 100 });

    const initialState = engine.getTrainState('t1');
    expect(initialState.status).toBe('running');
    const passengersBefore = initialState.passengers;

    // 3 ticks × 1 s: progress = 3 × (2/20) = 0.3 — train is still in transit
    for (let i = 0; i < 3; i++) {
      engine.tick(1);
      const state = engine.getTrainState('t1');
      if (state.status === 'running') {
        expect(state.passengers).toBe(passengersBefore);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Train on L-shaped track stays on the L, not a diagonal shortcut
  // ─────────────────────────────────────────────────────────────────────────
  it('train at 50% progress on L-shaped track is at the corner, not the diagonal midpoint', () => {
    const engine = new SimulationEngine();
    engine.setLine({ id: 'l1', name: 'Purple', color: '#800080', stationIds: ['s1', 's2'] });
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 5, y: 5 },
    ]);
    // Path: right from (0,0) to (5,0) then down to (5,5) — an L-shape, total length=10
    const path = manhattanPath({ x: 0, y: 0 }, { x: 5, y: 5 });
    engine.setTrackPath('s1', 's2', path);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 100 });

    // speed=2, path length=10 → 50% reached after 5/2=2.5 s
    engine.tick(2.5);
    const state = engine.getTrainState('t1');

    // At 50% of the L-path the train should be at the corner (5, 0)
    expect(state.worldX).toBeCloseTo(5, 5);
    expect(state.worldY).toBeCloseTo(0, 5);

    // Sanity check: definitely NOT at the diagonal midpoint (2.5, 2.5)
    const distFromDiagonalMidpoint = Math.abs(state.worldX - 2.5) + Math.abs(state.worldY - 2.5);
    expect(distFromDiagonalMidpoint).toBeGreaterThan(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Time always moves forward
  // ─────────────────────────────────────────────────────────────────────────
  it('simulation time increases monotonically with each tick', () => {
    const engine = new SimulationEngine();
    const times: number[] = [engine.getTime()];

    for (let i = 0; i < 10; i++) {
      engine.tick(1);
      times.push(engine.getTime());
    }

    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Station passenger count never goes negative
  // ─────────────────────────────────────────────────────────────────────────
  it('waiting passenger count at a station never goes below zero', () => {
    const engine = new SimulationEngine();
    engine.setLine({ id: 'l1', name: 'Orange', color: '#ff8c00', stationIds: ['s1', 's2'] });
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 5, y: 0 },
    ]);
    engine.preloadPassengers('s1', 5);
    // Capacity 1000 will board all 5 passengers immediately on addTrain
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 1000 });

    expect(engine.getWaitingPassengers('s1')).toBeGreaterThanOrEqual(0);

    // Continue ticking to verify no underflow occurs over subsequent stops
    for (let i = 0; i < 5; i++) {
      engine.tick(1);
      expect(engine.getWaitingPassengers('s1')).toBeGreaterThanOrEqual(0);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Train capacity = head(40) + 2×standard(60) + 1×widebody(80) = 240
  // ─────────────────────────────────────────────────────────────────────────
  it('getTrainCapacity returns correct total from head and carriages', () => {
    useTrainStore.getState().reset();

    useTrainStore.getState().createTrain({ type: 'modern', era: 'modern', city: 'generic' });
    const trainId = useTrainStore.getState().trains[0].id;

    useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'generic' });
    useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'generic' });
    useTrainStore.getState().addCarriage(trainId, { type: 'widebody', city: 'generic' });

    // 1 head=40 + 2 standard=120 + 1 widebody=80 = 240
    expect(useTrainStore.getState().getTrainCapacity(trainId)).toBe(240);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Train on diagonal track reaches midpoint at 50%
  // ─────────────────────────────────────────────────────────────────────────
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
    expect(Math.abs(state.worldX - 5)).toBeLessThan(1.5);
    expect(Math.abs(state.worldY - 5)).toBeLessThan(1.5);
  });
});
