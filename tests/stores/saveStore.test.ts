import { describe, it, expect, beforeEach } from 'vitest';
import { useSaveStore } from '../../src/stores/saveStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useTrainStore } from '../../src/stores/trainStore';

describe('saveStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useMapStore.getState().reset();
    useTrainStore.getState().reset();
  });

  it('saves and loads map state', () => {
    const { addStation, addLine, addTrack } = useMapStore.getState();
    addStation('Central', 3, 5);
    addStation('North', 3, 0);
    addLine('Red Line', '#ff6b6b');
    const s = useMapStore.getState();
    addTrack(s.lines[0].id, s.stations[0].id, s.stations[1].id);

    useSaveStore.getState().save();

    useMapStore.getState().reset();
    expect(useMapStore.getState().stations).toHaveLength(0);

    const loaded = useSaveStore.getState().load();
    expect(loaded).toBe(true);
    expect(useMapStore.getState().stations).toHaveLength(2);
    expect(useMapStore.getState().lines).toHaveLength(1);
    expect(useMapStore.getState().tracks).toHaveLength(1);
    expect(useMapStore.getState().stations[0].name).toBe('Central');
  });

  it('saves and loads train state', () => {
    useTrainStore.getState().createTrain({ type: 'tokyo-modern', era: 'modern', city: 'tokyo' });
    const trainId = useTrainStore.getState().trains[0].id;
    useTrainStore.getState().addCarriage(trainId, { type: 'standard', city: 'tokyo' });
    useTrainStore.getState().addCarriage(trainId, { type: 'widebody', city: 'tokyo' });

    useSaveStore.getState().save();

    useTrainStore.getState().reset();
    expect(useTrainStore.getState().trains).toHaveLength(0);

    const loaded = useSaveStore.getState().load();
    expect(loaded).toBe(true);
    expect(useTrainStore.getState().trains).toHaveLength(1);
    expect(useTrainStore.getState().trains[0].carriages).toHaveLength(2);
    expect(useTrainStore.getState().trains[0].carriages[1].type).toBe('widebody');
  });

  it('exports and imports JSON', () => {
    useMapStore.getState().addStation('Export Test', 1, 2);
    useTrainStore.getState().createTrain({ type: 'classic-local', era: 'classic', city: 'london' });

    const json = useSaveStore.getState().exportJSON();
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1');

    useMapStore.getState().reset();
    useTrainStore.getState().reset();

    const ok = useSaveStore.getState().importJSON(json);
    expect(ok).toBe(true);
    expect(useMapStore.getState().stations).toHaveLength(1);
    expect(useMapStore.getState().stations[0].name).toBe('Export Test');
    expect(useTrainStore.getState().trains).toHaveLength(1);
  });

  it('returns false when no save exists', () => {
    localStorage.clear();
    expect(useSaveStore.getState().load()).toBe(false);
  });

  it('returns false for invalid JSON', () => {
    expect(useSaveStore.getState().importJSON('not-valid-json')).toBe(false);
    expect(useSaveStore.getState().importJSON('{"trains":[]}')).toBe(false);
  });

  it('hasSave returns false when cleared, true after save', () => {
    expect(useSaveStore.getState().hasSave()).toBe(false);
    useSaveStore.getState().save();
    expect(useSaveStore.getState().hasSave()).toBe(true);
    useSaveStore.getState().clearSave();
    expect(useSaveStore.getState().hasSave()).toBe(false);
  });
});
