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
  deleteStation: (id: string) => void;
  addLine: (name: string, color: string) => void;
  deleteLine: (id: string) => void;
  addTrack: (lineId: string, stationAId: string, stationBId: string) => void;
  deleteTrack: (id: string) => void;
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

  deleteStation: (id) => set(state => ({
    stations: state.stations.filter(s => s.id !== id),
    tracks: state.tracks.filter(t => t.stationAId !== id && t.stationBId !== id),
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

  deleteTrack: (id) => set(state => ({ tracks: state.tracks.filter(t => t.id !== id) })),
  reset: () => set(initialState),
}));
