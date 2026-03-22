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
    addTrack(s.lines[0].id, s.stations[1].id, s.stations[0].id);
    addTrack(s.lines[1].id, s.stations[2].id, s.stations[0].id);
    const hub = useMapStore.getState().stations.find(st => st.name === 'Hub');
    expect(hub?.type).toBe('interchange');
    expect(hub?.lineIds).toHaveLength(2);
  });
});
