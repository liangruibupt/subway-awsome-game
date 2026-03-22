import type { Station, Track, Line } from '../types';

export type ObjectiveType = 'connect-stations' | 'transport-passengers' | 'on-time-rate';

export interface ChallengeObjective {
  type: ObjectiveType;
  target: number;
  label: string;
}

export interface ChallengeLevel {
  id: string;
  name: string;
  description: string;
  objectives: ChallengeObjective[];
  prebuiltMap: {
    gridSize: number;
    stations: Station[];
    tracks: Track[];
    lines: Line[];
  };
}

// ── Level 1: First Line ────────────────────────────────────────────────────
// Three stations placed in a row. Connect them all with one line.
const firstLineStations: Station[] = [
  { id: 'fl-s1', name: 'Westgate',  x: 4,  y: 10, type: 'normal', lineIds: [] },
  { id: 'fl-s2', name: 'Central',   x: 11, y: 10, type: 'normal', lineIds: [] },
  { id: 'fl-s3', name: 'Eastview',  x: 18, y: 10, type: 'normal', lineIds: [] },
];

// ── Level 2: Crosstown ────────────────────────────────────────────────────
// Five stations in different zones. Connect them all using at most 2 lines.
const crosstownStations: Station[] = [
  { id: 'ct-s1', name: 'Northport',    x: 5,  y: 4,  type: 'normal', lineIds: [] },
  { id: 'ct-s2', name: 'Harbor East',  x: 18, y: 5,  type: 'normal', lineIds: [] },
  { id: 'ct-s3', name: 'Midtown',      x: 11, y: 10, type: 'normal', lineIds: [] },
  { id: 'ct-s4', name: 'Riverside',    x: 4,  y: 16, type: 'normal', lineIds: [] },
  { id: 'ct-s5', name: 'South Yards',  x: 18, y: 16, type: 'normal', lineIds: [] },
];

// ── Level 3: Rush Hour ─────────────────────────────────────────────────────
// A network is already built. Switch to simulation, run the trains, and
// move 5,000 passengers with at least 85% on time within 10 minutes.
const rushHourStations: Station[] = [
  { id: 'rh-s1', name: 'North End',  x: 10, y: 4,  type: 'normal',      lineIds: ['rh-l1'] },
  { id: 'rh-s2', name: 'Central Hub', x: 10, y: 10, type: 'interchange', lineIds: ['rh-l1', 'rh-l2'] },
  { id: 'rh-s3', name: 'South End',  x: 10, y: 16, type: 'normal',      lineIds: ['rh-l1'] },
  { id: 'rh-s4', name: 'East Depot', x: 18, y: 10, type: 'normal',      lineIds: ['rh-l2'] },
];

const rushHourLines: Line[] = [
  { id: 'rh-l1', name: 'Red Line',  color: '#e74c3c', stationIds: ['rh-s1', 'rh-s2', 'rh-s3'] },
  { id: 'rh-l2', name: 'Blue Line', color: '#3498db', stationIds: ['rh-s4', 'rh-s2'] },
];

// Manhattan paths: horizontal first, then vertical.
function buildPath(
  ax: number, ay: number,
  bx: number, by: number,
): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [{ x: ax, y: ay }];
  let x = ax;
  let y = ay;
  const dx = bx > x ? 1 : -1;
  while (x !== bx) { x += dx; path.push({ x, y }); }
  const dy = by > y ? 1 : -1;
  while (y !== by) { y += dy; path.push({ x, y }); }
  return path;
}

const rushHourTracks: Track[] = [
  // Red Line: North End (10,4) → Central Hub (10,10)
  { id: 'rh-t1', lineId: 'rh-l1', stationAId: 'rh-s1', stationBId: 'rh-s2',
    path: buildPath(10, 4, 10, 10) },
  // Red Line: Central Hub (10,10) → South End (10,16)
  { id: 'rh-t2', lineId: 'rh-l1', stationAId: 'rh-s2', stationBId: 'rh-s3',
    path: buildPath(10, 10, 10, 16) },
  // Blue Line: East Depot (18,10) → Central Hub (10,10)
  { id: 'rh-t3', lineId: 'rh-l2', stationAId: 'rh-s4', stationBId: 'rh-s2',
    path: buildPath(18, 10, 10, 10) },
];

// ── Challenge level definitions ────────────────────────────────────────────

export const CHALLENGE_LEVELS: ChallengeLevel[] = [
  {
    id: 'level-1',
    name: 'First Line',
    description: 'Your first subway! Connect all 3 stations with a single line.',
    objectives: [
      { type: 'connect-stations', target: 3, label: 'Connect all 3 stations' },
    ],
    prebuiltMap: { gridSize: 30, stations: firstLineStations, tracks: [], lines: [] },
  },
  {
    id: 'level-2',
    name: 'Crosstown',
    description: 'The city has 5 zones. Connect them all using at most 2 lines.',
    objectives: [
      { type: 'connect-stations', target: 5, label: 'Connect all 5 zones' },
    ],
    prebuiltMap: { gridSize: 30, stations: crosstownStations, tracks: [], lines: [] },
  },
  {
    id: 'level-3',
    name: 'Rush Hour',
    description: 'The morning rush is on! Move 5,000 passengers in 10 minutes with 85% on time.',
    objectives: [
      { type: 'transport-passengers', target: 5000, label: 'Transport 5,000 passengers' },
      { type: 'on-time-rate',         target: 85,   label: 'Keep 85% of trains on time' },
    ],
    prebuiltMap: {
      gridSize: 30,
      stations: rushHourStations,
      tracks: rushHourTracks,
      lines: rushHourLines,
    },
  },
];

/**
 * Calculate the star rating (1–3) for a completed level.
 * @param level   The challenge definition.
 * @param values  Current value for each objective, in the same order.
 */
export function computeStars(level: ChallengeLevel, values: number[]): number {
  // Rush Hour: stars driven by the on-time rate.
  const onTimeIdx = level.objectives.findIndex(o => o.type === 'on-time-rate');
  if (onTimeIdx !== -1) {
    const rate = values[onTimeIdx];
    if (rate >= 95) return 3;
    if (rate >= 90) return 2;
    return 1;
  }
  // Connect challenges: always earn 3 stars when complete.
  return 3;
}
