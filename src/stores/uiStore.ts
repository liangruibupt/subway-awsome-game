import { create } from 'zustand';
import type { GameMode, TrackTool } from '../types';

interface UIState {
  mode: GameMode;
  tool: TrackTool;
  selectedStationId: string | null;
  selectedTrainId: string | null;
  selectedLineId: string | null;
  zoomLevel: number;
  mouseGridX: number;
  mouseGridY: number;
  assemblyPhase: 'head-selection' | 'carriage-building';
  selectedCarriageIndex: number | null;
  activeTrainIndex: number;
  // Challenge mode
  challengeId: string | null;
  challengeStars: Record<string, number>;
  showLevelSelect: boolean;
  showVictory: boolean;
  setMode: (mode: GameMode) => void;
  setTool: (tool: TrackTool) => void;
  selectStation: (id: string | null) => void;
  selectTrain: (id: string | null) => void;
  selectLine: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setMouseGrid: (x: number, y: number) => void;
  setAssemblyPhase: (phase: 'head-selection' | 'carriage-building') => void;
  selectCarriage: (index: number | null) => void;
  setActiveTrainIndex: (index: number) => void;
  setChallengeId: (id: string | null) => void;
  setChallengeStars: (stars: Record<string, number>) => void;
  setShowLevelSelect: (show: boolean) => void;
  setShowVictory: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'track-design',
  tool: 'station',
  selectedStationId: null,
  selectedTrainId: null,
  selectedLineId: null,
  zoomLevel: 1,
  mouseGridX: 0,
  mouseGridY: 0,
  assemblyPhase: 'head-selection',
  selectedCarriageIndex: null,
  activeTrainIndex: 0,
  // Challenge mode defaults
  challengeId: null,
  challengeStars: {},
  showLevelSelect: false,
  showVictory: false,
  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  selectStation: (id) => set({ selectedStationId: id }),
  selectTrain: (id) => set({ selectedTrainId: id }),
  selectLine: (id) => set({ selectedLineId: id }),
  setZoom: (zoom) => set({ zoomLevel: Math.max(0.25, Math.min(4, zoom)) }),
  setMouseGrid: (x, y) => set({ mouseGridX: x, mouseGridY: y }),
  setAssemblyPhase: (phase) => set({ assemblyPhase: phase, selectedCarriageIndex: null }),
  selectCarriage: (index) => set({ selectedCarriageIndex: index }),
  setActiveTrainIndex: (index) => set({ activeTrainIndex: index }),
  setChallengeId: (id) => set({ challengeId: id }),
  setChallengeStars: (stars) => set({ challengeStars: stars }),
  setShowLevelSelect: (show) => set({ showLevelSelect: show }),
  setShowVictory: (show) => set({ showVictory: show }),
}));
