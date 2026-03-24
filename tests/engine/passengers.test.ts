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
    for (let i = 0; i < 200; i++) engine.tick(1, 3, 2);
    const state = engine.getTrainState('t1');
    expect(state.passengers).toBeLessThanOrEqual(20);
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
    for (let i = 0; i < 100; i++) engine.tick(1, 5, 3);
    const state = engine.getTrainState('t1');
    // At interchange, boarding is 5*2=10 per stop
    expect(state.passengers).toBeGreaterThanOrEqual(8);
  });

  it('max capacity per carriage is 20', async () => {
    const { useTrainStore } = await import('../../src/stores/trainStore');
    useTrainStore.getState().reset();
    useTrainStore.getState().createTrain({ type: 'tokyo', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'generic' });
    expect(useTrainStore.getState().getTrainCapacity(trainId)).toBe(40);
  });
});
