// src/engine/SimulationEngine.ts
// Pure logic module — no PixiJS, no Zustand dependencies.

export interface TrainRunState {
  id: string;
  lineId: string;
  currentStationIndex: number;  // index into line.stationIds
  nextStationIndex: number;
  progress: number;             // 0-1 between current and next station
  direction: 1 | -1;           // 1=forward, -1=backward (shuttle)
  passengers: number;
  capacity: number;
  speed: number;               // current speed in grid-units per second
  status: 'running' | 'stopped' | 'loading';
  dwellTimer: number;          // seconds remaining at station
  worldX: number;              // interpolated world position (grid coords)
  worldY: number;
}

interface LineData {
  id: string;
  name: string;
  color: string;
  stationIds: string[];
}

interface StationData {
  id: string;
  x: number;
  y: number;
}

interface TrainInternal {
  id: string;
  lineId: string;
  capacity: number;
  currentStationIndex: number;
  nextStationIndex: number;
  progress: number;
  direction: 1 | -1;
  passengers: number;
  speed: number;
  status: 'running' | 'stopped' | 'loading';
  dwellTimer: number;
}

interface StationPassengerData {
  waiting: number;      // integer count of waiting passengers
  accumulator: number;  // fractional passenger accumulation
  baseRate: number;     // base passengers per simulated minute (integer 2-5)
}

const TRAIN_SPEED = 2;  // grid-units per simulated second (~80 km/h scaled)
const DWELL_TIME = 10;  // seconds the train dwells at each station

export class SimulationEngine {
  private lines = new Map<string, LineData>();
  private stations = new Map<string, StationData>();
  private trains = new Map<string, TrainInternal>();
  private passengerData = new Map<string, StationPassengerData>();
  private trackPaths = new Map<string, { x: number; y: number }[]>();
  private timeMinutes = 0; // minutes elapsed from 6 AM

  // ── Public API ────────────────────────────────────────────────────────────

  setLine(line: { id: string; name: string; color: string; stationIds: string[] }): void {
    this.lines.set(line.id, { ...line, stationIds: [...line.stationIds] });
  }

  setStations(stations: { id: string; x: number; y: number }[]): void {
    for (const s of stations) {
      this.stations.set(s.id, { ...s });
      // Only initialise passenger data if not already present (e.g. from preloadPassengers)
      if (!this.passengerData.has(s.id)) {
        this.passengerData.set(s.id, {
          waiting: 0,
          accumulator: 0,
          baseRate: Math.floor(Math.random() * 4) + 2, // integer in {2, 3, 4, 5}
        });
      }
    }
  }

  setTime(minutesFrom6AM: number): void {
    this.timeMinutes = minutesFrom6AM;
  }

  setTrackPath(stationAId: string, stationBId: string, path: { x: number; y: number }[]): void {
    this.trackPaths.set(`${stationAId}→${stationBId}`, path);
    this.trackPaths.set(`${stationBId}→${stationAId}`, [...path].reverse());
  }

  addTrain(config: { id: string; lineId: string; capacity: number }): void {
    const line = this.lines.get(config.lineId);
    if (!line || line.stationIds.length < 2) return;

    const train: TrainInternal = {
      id: config.id,
      lineId: config.lineId,
      capacity: config.capacity,
      currentStationIndex: 0,
      nextStationIndex: 1,
      progress: 0,
      direction: 1,
      passengers: 0,
      speed: TRAIN_SPEED,
      status: 'running',
      dwellTimer: 0,
    };

    // Board any passengers waiting at the spawn station immediately (no dwell)
    this.doBoard(train, line.stationIds[0]);

    this.trains.set(config.id, train);
  }

  removeTrain(id: string): void {
    this.trains.delete(id);
  }

  preloadPassengers(stationId: string, count: number): void {
    const data = this.passengerData.get(stationId);
    if (data) {
      data.waiting += count;
    } else {
      this.passengerData.set(stationId, {
        waiting: count,
        accumulator: 0,
        baseRate: Math.floor(Math.random() * 4) + 2,
      });
    }
  }

  tick(deltaSeconds: number): void {
    const multiplier = this.getRushMultiplier();

    // ── Passenger generation ──
    for (const data of this.passengerData.values()) {
      data.accumulator += (data.baseRate * multiplier * deltaSeconds) / 60;
      const newPassengers = Math.floor(data.accumulator);
      if (newPassengers > 0) {
        data.waiting += newPassengers;
        data.accumulator -= newPassengers;
      }
    }

    // ── Train movement ──
    for (const train of this.trains.values()) {
      this.updateTrain(train, deltaSeconds);
    }

    // Advance clock after processing (so getRushMultiplier checks the time
    // at the start of each tick, matching setTime semantics)
    this.timeMinutes += deltaSeconds / 60;
  }

  getTrainState(id: string): TrainRunState {
    const train = this.trains.get(id);
    if (!train) throw new Error(`Train "${id}" not found`);
    const pos = this.interpolatePosition(train);
    return {
      id: train.id,
      lineId: train.lineId,
      currentStationIndex: train.currentStationIndex,
      nextStationIndex: train.nextStationIndex,
      progress: train.progress,
      direction: train.direction,
      passengers: train.passengers,
      capacity: train.capacity,
      speed: train.speed,
      status: train.status,
      dwellTimer: Math.max(0, train.dwellTimer),
      worldX: pos.x,
      worldY: pos.y,
    };
  }

  getWaitingPassengers(stationId: string): number {
    return this.passengerData.get(stationId)?.waiting ?? 0;
  }

  getAllTrainStates(): TrainRunState[] {
    return Array.from(this.trains.keys()).map(id => this.getTrainState(id));
  }

  getTime(): number {
    return this.timeMinutes;
  }

  reset(): void {
    this.lines.clear();
    this.stations.clear();
    this.trains.clear();
    this.passengerData.clear();
    this.trackPaths.clear();
    this.timeMinutes = 0;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getRushMultiplier(): number {
    const t = this.timeMinutes;
    // Morning rush: 8 AM = minute 120 from 6 AM, ±30 min window → [90, 150]
    // Evening rush: 6 PM = minute 720 from 6 AM, ±30 min window → [690, 750]
    if ((t >= 90 && t <= 150) || (t >= 690 && t <= 750)) {
      return 3;
    }
    return 1;
  }

  private doBoard(train: TrainInternal, stationId: string): void {
    const data = this.passengerData.get(stationId);
    if (!data || data.waiting <= 0) return;
    const seats = train.capacity - train.passengers;
    if (seats <= 0) return;
    const boarding = Math.min(data.waiting, seats);
    train.passengers += boarding;
    data.waiting = Math.max(0, data.waiting - boarding);
  }

  private doAlight(train: TrainInternal): void {
    if (train.passengers <= 0) return;
    // Random 10–30 % of on-board passengers alight
    const rate = 0.1 + Math.random() * 0.2;
    const alighting = Math.floor(train.passengers * rate);
    train.passengers = Math.max(0, train.passengers - alighting);
  }

  private updateTrain(train: TrainInternal, deltaSeconds: number): void {
    const line = this.lines.get(train.lineId);
    if (!line) return;

    if (train.status === 'stopped' || train.status === 'loading') {
      train.dwellTimer -= deltaSeconds;
      if (train.dwellTimer <= 0) {
        train.dwellTimer = 0;
        const stationId = line.stationIds[train.currentStationIndex];
        this.doAlight(train);
        this.doBoard(train, stationId);
        train.status = 'running';
      }
      return;
    }

    // status === 'running': advance along track
    const stationA = this.stations.get(line.stationIds[train.currentStationIndex]);
    const stationB = this.stations.get(line.stationIds[train.nextStationIndex]);
    if (!stationA || !stationB) return;

    const dx = stationB.x - stationA.x;
    const dy = stationB.y - stationA.y;
    const path = this.getTrackPath(train);
    const distance = path ? this.getPathLength(path) : Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    train.progress += (train.speed * deltaSeconds) / distance;

    if (train.progress >= 1.0) {
      // Arrived at next station
      const arrivedAt = train.nextStationIndex;
      train.currentStationIndex = arrivedAt;
      train.progress = 0;

      // Reverse at terminals
      const lastIdx = line.stationIds.length - 1;
      if (arrivedAt === lastIdx) {
        train.direction = -1;
      } else if (arrivedAt === 0) {
        train.direction = 1;
      }

      // Compute next destination
      if (train.direction === 1) {
        train.nextStationIndex = Math.min(arrivedAt + 1, lastIdx);
      } else {
        train.nextStationIndex = Math.max(arrivedAt - 1, 0);
      }

      train.status = 'stopped';
      train.dwellTimer = DWELL_TIME;
    }
  }

  private getTrackPath(train: TrainInternal): { x: number; y: number }[] | null {
    const line = this.lines.get(train.lineId);
    if (!line) return null;
    const fromId = line.stationIds[train.currentStationIndex];
    const toId = line.stationIds[train.nextStationIndex];
    return this.trackPaths.get(`${fromId}→${toId}`) ?? null;
  }

  private getPathLength(path: { x: number; y: number }[]): number {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      len += Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
    }
    return len;
  }

  private interpolatePosition(train: TrainInternal): { x: number; y: number } {
    const path = this.getTrackPath(train);
    if (!path || path.length < 2) {
      // Fallback: straight line
      const line = this.lines.get(train.lineId);
      if (!line) return { x: 0, y: 0 };
      const stA = this.stations.get(line.stationIds[train.currentStationIndex]);
      const stB = this.stations.get(line.stationIds[train.nextStationIndex]);
      if (!stA || !stB) return { x: 0, y: 0 };
      return {
        x: stA.x + (stB.x - stA.x) * train.progress,
        y: stA.y + (stB.y - stA.y) * train.progress,
      };
    }

    const totalLen = this.getPathLength(path);
    const targetDist = totalLen * train.progress;

    let traveled = 0;
    for (let i = 1; i < path.length; i++) {
      const segLen = Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
      if (traveled + segLen >= targetDist) {
        const t = segLen > 0 ? (targetDist - traveled) / segLen : 0;
        return {
          x: path[i - 1].x + (path[i].x - path[i - 1].x) * t,
          y: path[i - 1].y + (path[i].y - path[i - 1].y) * t,
        };
      }
      traveled += segLen;
    }

    return path[path.length - 1];
  }
}
