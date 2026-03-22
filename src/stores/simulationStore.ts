import { create } from 'zustand';
import type { SimulationState } from '../types';

interface SimStore extends SimulationState {
  setSpeed: (speed: 1 | 2 | 4) => void;
  togglePause: () => void;
  tick: (deltaMinutes: number) => void;
  addPassengers: (lineId: string, count: number) => void;
  recordArrival: (lineId: string, onTime: boolean) => void;
  reset: () => void;
}

const initialState: SimulationState = {
  time: 0, speed: 1, paused: true,
  stats: { totalPassengers: 0, onTimeRate: 100, byLine: {} },
};

export const useSimulationStore = create<SimStore>((set) => ({
  ...initialState,
  setSpeed: (speed) => set({ speed }),
  togglePause: () => set(state => ({ paused: !state.paused })),
  tick: (deltaMinutes) => set(state => {
    if (state.paused) return state;
    return { time: state.time + deltaMinutes * state.speed };
  }),
  addPassengers: (lineId, count) => set(state => {
    const byLine = { ...state.stats.byLine };
    if (!byLine[lineId]) byLine[lineId] = { passengers: 0, onTime: 0 };
    byLine[lineId] = { ...byLine[lineId], passengers: byLine[lineId].passengers + count };
    const totalPassengers = state.stats.totalPassengers + count;
    return { stats: { ...state.stats, totalPassengers, byLine } };
  }),
  recordArrival: (lineId, onTime) => set(state => {
    const byLine = { ...state.stats.byLine };
    if (!byLine[lineId]) byLine[lineId] = { passengers: 0, onTime: 0 };
    if (onTime) byLine[lineId] = { ...byLine[lineId], onTime: byLine[lineId].onTime + 1 };
    const totalOnTime = Object.values(byLine).reduce((s, l) => s + l.onTime, 0);
    const totalArrivals = Object.values(byLine).reduce((s, l) => s + l.passengers, 0);
    const onTimeRate = totalArrivals > 0 ? (totalOnTime / totalArrivals) * 100 : 100;
    return { stats: { ...state.stats, onTimeRate, byLine } };
  }),
  reset: () => set(initialState),
}));
