import { create } from 'zustand';
import type { GameMode, TrackTool } from '../types';

interface UIState {
  mode: GameMode;
  tool: TrackTool;
  selectedStationId: string | null;
  selectedTrainId: string | null;
  zoomLevel: number;
  mouseGridX: number;
  mouseGridY: number;
  setMode: (mode: GameMode) => void;
  setTool: (tool: TrackTool) => void;
  selectStation: (id: string | null) => void;
  selectTrain: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setMouseGrid: (x: number, y: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'track-design',
  tool: 'station',
  selectedStationId: null,
  selectedTrainId: null,
  zoomLevel: 1,
  mouseGridX: 0,
  mouseGridY: 0,
  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  selectStation: (id) => set({ selectedStationId: id }),
  selectTrain: (id) => set({ selectedTrainId: id }),
  setZoom: (zoom) => set({ zoomLevel: Math.max(0.25, Math.min(4, zoom)) }),
  setMouseGrid: (x, y) => set({ mouseGridX: x, mouseGridY: y }),
}));
