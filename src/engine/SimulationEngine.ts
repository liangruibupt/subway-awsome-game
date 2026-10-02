// src/engine/SimulationEngine.ts
// Pure logic module — no PixiJS, no Zustand dependencies.

export interface TrainRunState {
  id: string;
  lineId: string;
  currentStationIndex: number;  // index into the train's current route
  currentStationId: string;     // station the train is at / just left
  routeIndex: number;           // which of the line's routes (branches) it is on
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
  /** Terminal-to-terminal service patterns. A plain line has one; a line with
   *  branches has one per branch, all starting at the same terminal, and
   *  trains alternate between them. */
  routes: string[][];
}

/** Route geometry for drawing a whole train along the track. */
export interface TrainRouteGeometry {
  points: { x: number; y: number }[];
  cum: number[];       // cumulative distance at each point (grid units)
  total: number;
  headDist: number;    // engine head position along the route
  direction: 1 | -1;
  /** Circular route: positions wrap round instead of stopping at the ends. */
  loop: boolean;
}

interface StationData {
  id: string;
  x: number;
  y: number;
  type: string;
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
  routeIndex: number;
  /** Train length behind the head position (grid units); used to start
   *  the train clear of a terminal after it reverses. */
  length: number;
}

interface StationPassengerData {
  waiting: number;      // integer count of waiting passengers
  accumulator: number;  // fractional passenger accumulation
  baseRate: number;     // base passengers per simulated minute (integer 2-5)
}

const TRAIN_SPEED = 2;  // grid-units per simulated second (~80 km/h scaled)

/** A route that ends where it starts without turning back on itself — a
 *  ring line that trains run round continuously. */
export function isCircular(route: string[]): boolean {
  const n = route.length;
  return n >= 4 && route[0] === route[n - 1] && route[1] !== route[n - 2];
}

export class SimulationEngine {
  private lines = new Map<string, LineData>();
  private stations = new Map<string, StationData>();
  private trains = new Map<string, TrainInternal>();
  private passengerData = new Map<string, StationPassengerData>();
  private trackPaths = new Map<string, { x: number; y: number }[]>();
  private timeMinutes = 0; // minutes elapsed from 6 AM
  private dwellTime = 10;  // seconds the train dwells at each station
  private geometryCache = new Map<string, { points: { x: number; y: number }[]; cum: number[]; stationDist: number[] }>();

  // ── Public API ────────────────────────────────────────────────────────────

  setLine(line: { id: string; name: string; color: string; stationIds: string[]; routes?: string[][] }): void {
    const routes = (line.routes ?? [line.stationIds])
      .filter(r => r.length >= 2)
      .map(r => [...r]);
    this.lines.set(line.id, {
      id: line.id, name: line.name, color: line.color,
      stationIds: [...line.stationIds],
      routes: routes.length > 0 ? routes : [[...line.stationIds]],
    });
    this.geometryCache.clear();
  }

  setStations(stations: { id: string; x: number; y: number; type?: string }[]): void {
    for (const s of stations) {
      this.stations.set(s.id, { ...s, type: s.type ?? 'normal' });
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
    this.geometryCache.clear();
  }

  addTrain(config: { id: string; lineId: string; capacity: number; length?: number }): void {
    const line = this.lines.get(config.lineId);
    if (!line || line.routes[0].length < 2) return;

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
      routeIndex: 0,
      length: Math.max(0, config.length ?? 0),
    };
    // Start with the whole train on the track, head clear of the terminal
    train.progress = this.departureOffset(train);

    // Board any passengers waiting at the spawn station immediately (no dwell)
    this.doBoard(train, line.routes[0][0], 5);

    this.trains.set(config.id, train);
  }

  hasTrain(id: string): boolean {
    return this.trains.has(id);
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

  tick(deltaSeconds: number, boardingPerStation = 5, alightingPerStation = 3): void {
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
      this.updateTrain(train, deltaSeconds, boardingPerStation, alightingPerStation);
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
      currentStationId: this.routeOf(train)[train.currentStationIndex] ?? '',
      routeIndex: train.routeIndex,
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

  setDwellTime(seconds: number): void {
    this.dwellTime = seconds;
  }

  getTrainTrackPath(trainId: string): { x: number; y: number }[] | null {
    const train = this.trains.get(trainId);
    if (!train) return null;
    return this.getTrackPath(train);
  }

  getTrainPathLength(trainId: string): number {
    const train = this.trains.get(trainId);
    if (!train) return 0;
    const path = this.getTrackPath(train);
    if (!path) return 0;
    return this.getPathLength(path);
  }

  /** Station list of the route this train is currently running. */
  getTrainRoute(trainId: string): string[] {
    const train = this.trains.get(trainId);
    return train ? [...this.routeOf(train)] : [];
  }

  /** Whole-route polyline plus the head position on it, so a renderer can lay
   *  every carriage on the actual track (around corners, through stations). */
  getTrainRouteGeometry(trainId: string): TrainRouteGeometry | null {
    const train = this.trains.get(trainId);
    if (!train) return null;
    const geo = this.routeGeometry(train);
    if (!geo || geo.points.length < 2) return null;
    const cur = train.currentStationIndex;
    const next = train.nextStationIndex;
    const path = this.getTrackPath(train);
    const hopLen = path ? this.getPathLength(path) : 0;
    const base = geo.stationDist[cur] ?? 0;
    const forward = next >= cur;
    const headDist = forward ? base + train.progress * hopLen : base - train.progress * hopLen;
    return {
      points: geo.points,
      cum: geo.cum,
      total: geo.cum[geo.cum.length - 1],
      headDist,
      direction: forward ? 1 : -1,
      loop: isCircular(this.routeOf(train)),
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private routeOf(train: TrainInternal): string[] {
    const line = this.lines.get(train.lineId);
    if (!line) return [];
    return line.routes[train.routeIndex % line.routes.length] ?? line.routes[0];
  }

  private hopPath(fromId: string, toId: string): { x: number; y: number }[] | null {
    const p = this.trackPaths.get(`${fromId}→${toId}`);
    if (p && p.length >= 2) return p;
    const a = this.stations.get(fromId);
    const b = this.stations.get(toId);
    return a && b ? [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] : null;
  }

  private routeGeometry(train: TrainInternal) {
    const key = `${train.lineId}#${train.routeIndex}`;
    const cached = this.geometryCache.get(key);
    if (cached) return cached;
    const route = this.routeOf(train);
    const points: { x: number; y: number }[] = [];
    const cum: number[] = [];
    const stationDist: number[] = [0];
    for (let i = 0; i + 1 < route.length; i++) {
      const path = this.hopPath(route[i], route[i + 1]);
      if (!path) return null;
      for (let j = 0; j < path.length; j++) {
        const pt = path[j];
        const last = points[points.length - 1];
        if (last && Math.abs(last.x - pt.x) < 1e-9 && Math.abs(last.y - pt.y) < 1e-9) continue;
        cum.push(last ? cum[cum.length - 1] + Math.hypot(pt.x - last.x, pt.y - last.y) : 0);
        points.push({ x: pt.x, y: pt.y });
      }
      stationDist.push(cum[cum.length - 1] ?? 0);
    }
    const geo = { points, cum, stationDist };
    this.geometryCache.set(key, geo);
    return geo;
  }

  /** Progress at which a train leaving a terminal starts, so its whole length
   *  is on the track (a real train reverses by the driver changing cabs: the
   *  old tail becomes the new head). Capped so the next stop is still ahead. */
  private departureOffset(train: TrainInternal): number {
    if (train.length <= 0) return 0;
    const path = this.getTrackPath(train);
    const hopLen = path ? this.getPathLength(path) : 0;
    if (hopLen <= 0) return 0;
    return Math.min(train.length / hopLen, 0.9);
  }

  private getRushMultiplier(): number {
    const t = this.timeMinutes;
    // Morning rush: 8 AM = minute 120 from 6 AM, ±30 min window → [90, 150]
    // Evening rush: 6 PM = minute 720 from 6 AM, ±30 min window → [690, 750]
    if ((t >= 90 && t <= 150) || (t >= 690 && t <= 750)) {
      return 3;
    }
    return 1;
  }

  private doBoard(train: TrainInternal, stationId: string, boardingPerStation: number): void {
    const data = this.passengerData.get(stationId);
    if (!data || data.waiting <= 0) return;
    const seats = train.capacity - train.passengers;
    if (seats <= 0) return;
    const station = this.stations.get(stationId);
    const multiplier = station?.type === 'interchange' ? 2 : 1;
    const boarding = Math.min(data.waiting, boardingPerStation * multiplier, seats);
    train.passengers += boarding;
    data.waiting = Math.max(0, data.waiting - boarding);
  }

  private doAlight(train: TrainInternal, stationId: string, alightingPerStation: number): void {
    if (train.passengers <= 0) return;
    const station = this.stations.get(stationId);
    const multiplier = station?.type === 'interchange' ? 2 : 1;
    const alighting = Math.min(train.passengers, alightingPerStation * multiplier);
    train.passengers = Math.max(0, train.passengers - alighting);
  }

  private updateTrain(train: TrainInternal, deltaSeconds: number, boardingPerStation: number, alightingPerStation: number): void {
    const line = this.lines.get(train.lineId);
    if (!line) return;
    let route = this.routeOf(train);

    if (train.status === 'stopped' || train.status === 'loading') {
      train.dwellTimer -= deltaSeconds;
      if (train.dwellTimer <= 0) {
        train.dwellTimer = 0;
        const stationId = route[train.currentStationIndex];
        this.doAlight(train, stationId, alightingPerStation);
        this.doBoard(train, stationId, boardingPerStation);
        train.status = 'running';
      }
      return;
    }

    // status === 'running': advance along track
    const stationA = this.stations.get(route[train.currentStationIndex]);
    const stationB = this.stations.get(route[train.nextStationIndex]);
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
      const lastIdx = route.length - 1;
      let reversed = false;
      if (arrivedAt === lastIdx && train.direction === 1 && isCircular(route)) {
        // Ring: carry straight on round the loop (next branch if any), no
        // reversal and no cab change.
        if (line.routes.length > 1) {
          train.routeIndex = (train.routeIndex + 1) % line.routes.length;
          route = this.routeOf(train);
        }
        train.currentStationIndex = 0;
        train.nextStationIndex = 1;
        train.status = 'stopped';
        train.dwellTimer = this.dwellTime;
        return;
      }
      if (arrivedAt === lastIdx) {
        train.direction = -1;
        reversed = true;
      } else if (arrivedAt === 0) {
        train.direction = 1;
        reversed = true;
        // Back at the home terminal: take the next branch, so a line with
        // branches serves all of them in turn (every route starts here).
        if (line.routes.length > 1) {
          train.routeIndex = (train.routeIndex + 1) % line.routes.length;
          route = this.routeOf(train);
        }
      }

      // Compute next destination
      const newLast = route.length - 1;
      if (train.direction === 1) {
        train.nextStationIndex = Math.min(arrivedAt + 1, newLast);
      } else {
        train.nextStationIndex = Math.max(arrivedAt - 1, 0);
      }

      // Driver changes cabs: the train leaves from its far end
      if (reversed) train.progress = this.departureOffset(train);

      train.status = 'stopped';
      train.dwellTimer = this.dwellTime;
    }
  }

  private getTrackPath(train: TrainInternal): { x: number; y: number }[] | null {
    const route = this.routeOf(train);
    const fromId = route[train.currentStationIndex];
    const toId = route[train.nextStationIndex];
    return this.trackPaths.get(`${fromId}→${toId}`) ?? null;
  }

  private getPathLength(path: { x: number; y: number }[]): number {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  private interpolatePosition(train: TrainInternal): { x: number; y: number } {
    const path = this.getTrackPath(train);
    if (!path || path.length < 2) {
      // Fallback: straight line
      const route = this.routeOf(train);
      const stA = this.stations.get(route[train.currentStationIndex]);
      const stB = this.stations.get(route[train.nextStationIndex]);
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
      const sdx = path[i].x - path[i - 1].x;
      const sdy = path[i].y - path[i - 1].y;
      const segLen = Math.sqrt(sdx * sdx + sdy * sdy);
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
