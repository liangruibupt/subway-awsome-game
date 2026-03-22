import { create } from 'zustand';
import type { Train, TrainHead, Carriage, TrainStyle } from '../types';
import { generateId } from '../utils/id';

const HEAD_CAPACITY = 40;
const STANDARD_CAPACITY = 60;
const WIDEBODY_CAPACITY = 80;
const MAX_CARRIAGES = 7;

interface TrainState {
  trains: Train[];
  createTrain: (head: TrainHead) => void;
  deleteTrain: (id: string) => void;
  addCarriage: (trainId: string, carriage: Carriage) => void;
  removeCarriage: (trainId: string, index: number) => void;
  reorderCarriages: (trainId: string, fromIndex: number, toIndex: number) => void;
  updateStyle: (trainId: string, style: TrainStyle) => void;
  assignToLine: (trainId: string, lineId: string) => void;
  getTrainCapacity: (trainId: string) => number;
  reset: () => void;
}

export const useTrainStore = create<TrainState>((set, get) => ({
  trains: [],
  createTrain: (head) => set(state => ({
    trains: [...state.trains, { id: generateId(), lineId: '', head, carriages: [], style: { bodyColor: '#0984e3', pattern: 'solid', accentColor: '#ffd93d' } }],
  })),
  deleteTrain: (id) => set(state => ({ trains: state.trains.filter(t => t.id !== id) })),
  addCarriage: (trainId, carriage) => set(state => ({
    trains: state.trains.map(t => {
      if (t.id !== trainId || t.carriages.length >= MAX_CARRIAGES) return t;
      return { ...t, carriages: [...t.carriages, carriage] };
    }),
  })),
  removeCarriage: (trainId, index) => set(state => ({
    trains: state.trains.map(t => {
      if (t.id !== trainId) return t;
      return { ...t, carriages: t.carriages.filter((_, i) => i !== index) };
    }),
  })),
  reorderCarriages: (trainId, fromIndex, toIndex) => set(state => ({
    trains: state.trains.map(t => {
      if (t.id !== trainId) return t;
      const carriages = [...t.carriages];
      const [moved] = carriages.splice(fromIndex, 1);
      carriages.splice(toIndex, 0, moved);
      return { ...t, carriages };
    }),
  })),
  updateStyle: (trainId, style) => set(state => ({ trains: state.trains.map(t => t.id === trainId ? { ...t, style } : t) })),
  assignToLine: (trainId, lineId) => set(state => ({ trains: state.trains.map(t => t.id === trainId ? { ...t, lineId } : t) })),
  getTrainCapacity: (trainId) => {
    const train = get().trains.find(t => t.id === trainId);
    if (!train) return 0;
    return HEAD_CAPACITY + train.carriages.reduce((sum, c) => sum + (c.type === 'widebody' ? WIDEBODY_CAPACITY : STANDARD_CAPACITY), 0);
  },
  reset: () => set({ trains: [] }),
}));
