import { describe, it, expect, beforeEach } from 'vitest';
import { useTrainStore } from '../../src/stores/trainStore';

describe('trainStore', () => {
  beforeEach(() => { useTrainStore.getState().reset(); });

  it('creates a train with head', () => {
    useTrainStore.getState().createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const { trains } = useTrainStore.getState();
    expect(trains).toHaveLength(1);
    expect(trains[0].head.city).toBe('tokyo');
    expect(trains[0].carriages).toHaveLength(0);
  });

  it('adds carriages up to max 7', () => {
    useTrainStore.getState().createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    for (let i = 0; i < 8; i++) {
      useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'tokyo' });
    }
    expect(useTrainStore.getState().trains[0].carriages).toHaveLength(7);
  });

  it('calculates train capacity', () => {
    useTrainStore.getState().createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'tokyo' });
    useTrainStore.getState().addCarriage(trainId, { type: 'widebody', city: 'tokyo' });
    expect(useTrainStore.getState().getTrainCapacity(trainId)).toBe(180);
  });

  it('updates train style', () => {
    useTrainStore.getState().createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    useTrainStore.getState().updateStyle(trainId, { bodyColor: '#ff0000', pattern: 'stripe', accentColor: '#ffd93d' });
    expect(useTrainStore.getState().trains[0].style.pattern).toBe('stripe');
  });
});
