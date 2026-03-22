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
  moveStation: (id: string, x: number, y: number) => void;
  deleteStation: (id: string) => void;
  addLine: (name: string, color: string) => void;
  deleteLine: (id: string) => void;
  addTrack: (lineId: string, stationAId: string, stationBId: string) => void;
  deleteTrack: (id: string) => void;
  updateTrackPath: (trackId: string, newPath: { x: number; y: number }[]) => void;
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
      id: generateId(), name, x, y, type: 'normal', lineIds: [],
    }],
  })),

  renameStation: (id, name) => set(state => ({
    stations: state.stations.map(s => s.id === id ? { ...s, name } : s),
  })),

  moveStation: (id, x, y) => {
    const state = get();
    // Update station position
    const updatedStations = state.stations.map(s => s.id === id ? { ...s, x, y } : s);
    // Rebuild track paths that connect to this station
    const updatedTracks = state.tracks.map(t => {
      if (t.stationAId !== id && t.stationBId !== id) return t;
      const stA = (t.stationAId === id ? { x, y } : updatedStations.find(s => s.id === t.stationAId)) ?? { x: 0, y: 0 };
      const stB = (t.stationBId === id ? { x, y } : updatedStations.find(s => s.id === t.stationBId)) ?? { x: 0, y: 0 };
      return { ...t, path: manhattanPath(stA, stB) };
    });
    set({ stations: updatedStations, tracks: updatedTracks });
  },

  deleteStation: (id) => set(state => ({
    stations: state.stations.filter(s => s.id !== id),
    tracks: state.tracks.filter(t => t.stationAId !== id && t.stationBId !== id),
    lines: state.lines.map(l => ({
      ...l,
      stationIds: l.stationIds.filter(sid => sid !== id),
    })),
  })),

  addLine: (name, color) => set(state => ({
    lines: [...state.lines, { id: generateId(), name, color, stationIds: [] }],
  })),

  deleteLine: (id) => set(state => ({
    lines: state.lines.filter(l => l.id !== id),
    tracks: state.tracks.filter(t => t.lineId !== id),
    stations: state.stations.map(s => ({
      ...s, lineIds: s.lineIds.filter(lid => lid !== id),
      type: s.lineIds.filter(lid => lid !== id).length >= 2 ? 'interchange' : 'normal',
    })),
  })),

  addTrack: (lineId, stationAId, stationBId) => {
    const state = get();
    const stationA = state.stations.find(s => s.id === stationAId);
    const stationB = state.stations.find(s => s.id === stationBId);
    if (!stationA || !stationB) return;

    const path = manhattanPath({ x: stationA.x, y: stationA.y }, { x: stationB.x, y: stationB.y });
    const track: Track = { id: generateId(), lineId, path, stationAId, stationBId };

    const updateStation = (station: Station): Station => {
      const newLineIds = station.lineIds.includes(lineId) ? station.lineIds : [...station.lineIds, lineId];
      return { ...station, lineIds: newLineIds, type: newLineIds.length >= 2 ? 'interchange' : 'normal' };
    };

    const updatedLines = state.lines.map(l => {
      if (l.id !== lineId) return l;
      const ids = new Set(l.stationIds);
      ids.add(stationAId);
      ids.add(stationBId);
      return { ...l, stationIds: Array.from(ids) };
    });

    set({
      tracks: [...state.tracks, track],
      stations: state.stations.map(s => (s.id === stationAId || s.id === stationBId) ? updateStation(s) : s),
      lines: updatedLines,
    });
  },

  deleteTrack: (id) => set(state => {
    const remainingTracks = state.tracks.filter(t => t.id !== id);

    const updatedStations = state.stations.map(station => {
      const newLineIds = [...new Set(
        remainingTracks
          .filter(t => t.stationAId === station.id || t.stationBId === station.id)
          .map(t => t.lineId),
      )];
      return {
        ...station,
        lineIds: newLineIds,
        type: (newLineIds.length >= 2 ? 'interchange' : 'normal') as Station['type'],
      };
    });

    const updatedLines = state.lines.map(line => {
      const stationIdsForLine = new Set<string>();
      remainingTracks
        .filter(t => t.lineId === line.id)
        .forEach(t => { stationIdsForLine.add(t.stationAId); stationIdsForLine.add(t.stationBId); });
      return { ...line, stationIds: Array.from(stationIdsForLine) };
    });

    return { tracks: remainingTracks, stations: updatedStations, lines: updatedLines };
  }),
  updateTrackPath: (trackId, newPath) => set(state => ({
    tracks: state.tracks.map(t => t.id === trackId ? { ...t, path: newPath } : t),
  })),

  reset: () => set(initialState),
}));
