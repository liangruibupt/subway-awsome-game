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
    for (let i = 0; i < 100; i++) engine.tick(1, 5, 3);
    const train = engine.getTrainState('t1');
    expect(train.passengers).toBeGreaterThan(0);
  });

  it('interpolates position on diagonal path at 50%', () => {
    const engine = new SimulationEngine();
    engine.setStations([
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 6, y: 8 },
    ]);
    engine.setLine({ id: 'l1', name: 'Diag', color: '#ff0000', stationIds: ['s1', 's2'] });
    engine.setTrackPath('s1', 's2', [{ x: 0, y: 0 }, { x: 6, y: 8 }]);
    engine.addTrain({ id: 't1', lineId: 'l1', capacity: 40 });
    // distance is 10, speed is 2 units/s, so 2.5 seconds to reach 50%
    engine.tick(2.5);
    const state = engine.getTrainState('t1');
    expect(state.worldX).toBeCloseTo(3, 0);
    expect(state.worldY).toBeCloseTo(4, 0);
  });
});
