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
    // Each carriage must have a style copied from the train's base style
    expect(useTrainStore.getState().trains[0].carriages[0].style).toBeDefined();
    expect(useTrainStore.getState().trains[0].carriages[0].style.bodyColor).toBe('#0984e3');
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

  it('updates a single carriage style independently', () => {
    useTrainStore.getState().createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'tokyo' });
    useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'tokyo' });
    useTrainStore.getState().updateCarriageStyle(trainId, 0, { bodyColor: '#ff0000', pattern: 'stripe', accentColor: '#00b894' });
    const carriages = useTrainStore.getState().trains[0].carriages;
    expect(carriages[0].style.bodyColor).toBe('#ff0000');
    expect(carriages[1].style.bodyColor).toBe('#0984e3'); // second carriage unchanged
  });
});
