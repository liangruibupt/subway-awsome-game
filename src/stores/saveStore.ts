import { create } from 'zustand';
import { useMapStore } from './mapStore';
import { useTrainStore } from './trainStore';
import type { Station, Track, Line, Train } from '../types';

const SAVE_KEY = 'subway-game-save';

interface SavePayload {
  map: {
    gridSize: number;
    stations: Station[];
    tracks: Track[];
    lines: Line[];
  };
  trains: Train[];
  version: string;
}

export interface SaveState {
  save: () => void;
  load: () => boolean;
  exportJSON: () => string;
  importJSON: (json: string) => boolean;
  hasSave: () => boolean;
  clearSave: () => void;
}

function buildPayload(): SavePayload {
  const { gridSize, stations, tracks, lines } = useMapStore.getState();
  const { trains } = useTrainStore.getState();
  return { map: { gridSize, stations, tracks, lines }, trains, version: '1' };
}

function hydrateStores(payload: SavePayload): void {
  useMapStore.getState().loadState(payload.map);
  useTrainStore.getState().loadState(payload.trains);
}

function isValidPayload(obj: unknown): obj is SavePayload {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  if (!p.map || typeof p.map !== 'object') return false;
  const m = p.map as Record<string, unknown>;
  if (!Array.isArray(m.stations)) return false;
  if (!Array.isArray(m.tracks)) return false;
  if (!Array.isArray(m.lines)) return false;
  if (!Array.isArray(p.trains)) return false;
  return true;
}

export const useSaveStore = create<SaveState>(() => ({
  save: () => {
    const json = JSON.stringify(buildPayload());
    localStorage.setItem(SAVE_KEY, json);
  },

  load: () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isValidPayload(parsed)) return false;
      hydrateStores(parsed);
      return true;
    } catch {
      return false;
    }
  },

  exportJSON: () => JSON.stringify(buildPayload(), null, 2),

  importJSON: (json: string) => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (!isValidPayload(parsed)) return false;
      hydrateStores(parsed);
      localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch {
      return false;
    }
  },

  hasSave: () => localStorage.getItem(SAVE_KEY) !== null,

  clearSave: () => localStorage.removeItem(SAVE_KEY),
}));

// Auto-save: debounced, fires 500ms after any store change
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    useSaveStore.getState().save();
  }, 500);
}

export function initAutoSave(): () => void {
  const unsub1 = useMapStore.subscribe(scheduleSave);
  const unsub2 = useTrainStore.subscribe(scheduleSave);
  return () => {
    unsub1();
    unsub2();
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
