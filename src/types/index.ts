// src/types/index.ts
export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'normal' | 'interchange' | 'terminal';
  lineIds: string[];
}

export interface Track {
  id: string;
  lineId: string;
  path: { x: number; y: number }[];
  stationAId: string;
  stationBId: string;
}

export interface Line {
  id: string;
  name: string;
  color: string;
  stationIds: string[];
}

export interface TrainHead {
  type: string;
  era: 'classic' | 'modern' | 'future';
  city: string;
}

export interface Carriage {
  type: 'standard' | 'widebody';
  city: string;
}

export interface TrainStyle {
  bodyColor: string;
  pattern: 'solid' | 'stripe' | 'gradient' | 'tech';
  accentColor: string;
}

export interface Train {
  id: string;
  lineId: string;
  head: TrainHead;
  carriages: Carriage[];
  style: TrainStyle;
}

export interface SimulationStats {
  totalPassengers: number;
  onTimeRate: number;
  byLine: Record<string, { passengers: number; onTime: number }>;
}

export interface SimulationState {
  time: number;
  speed: 1 | 2 | 4;
  paused: boolean;
  stats: SimulationStats;
}

export interface GameSave {
  map: {
    gridSize: number;
    stations: Station[];
    tracks: Track[];
    lines: Line[];
  };
  trains: Train[];
  simulation: SimulationState;
  meta: {
    saveName: string;
    createdAt: string;
    lastModified: string;
    version: string;
  };
}

export type GameMode = 'track-design' | 'assembly' | 'simulation';
export type TrackTool = 'station' | 'connect' | 'edit' | 'delete' | 'pan';
