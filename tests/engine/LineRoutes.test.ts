import { describe, it, expect } from 'vitest';
import { buildLineRoutes } from '../../src/engine/LineRoutes';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { manhattanPath } from '../../src/utils/geometry';

type S = { id: string; x: number; y: number };
const track = (a: S, b: S) => ({
  stationAId: a.id, stationBId: b.id,
  path: manhattanPath({ x: a.x, y: a.y }, { x: b.x, y: b.y }),
});

/** Run the engine and return the sequence of stations the train stopped at. */
function stopsOf(stations: S[], tracks: ReturnType<typeof track>[], seconds: number, length = 0) {
  const plan = buildLineRoutes(tracks, stations, stations.map(s => s.id));
  const engine = new SimulationEngine();
  engine.setStations(stations);
  engine.setLine({ id: 'l', name: 'L', color: '#f00', stationIds: plan.routes[0], routes: plan.routes });
  for (const [k, p] of plan.extraPaths) {
    const [a, b] = k.split('→');
    engine.setTrackPath(a, b, p);
  }
  for (const t of tracks) engine.setTrackPath(t.stationAId, t.stationBId, t.path);
  engine.setDwellTime(1);
  engine.addTrain({ id: 't', lineId: 'l', capacity: 100, length });
  const stops: string[] = [];
  let wasStopped = false;
  for (let i = 0; i < seconds * 10; i++) {
    engine.tick(0.1);
    const st = engine.getTrainState('t');
    const stopped = st.status !== 'running';
    if (stopped && !wasStopped) stops.push(st.currentStationId);
    wasStopped = stopped;
  }
  return { plan, stops, engine };
}

describe('buildLineRoutes', () => {
  it('gives a plain line a single route', () => {
    const a = { id: 'a', x: 0, y: 0 }, b = { id: 'b', x: 5, y: 0 }, c = { id: 'c', x: 10, y: 0 };
    const { routes } = buildLineRoutes([track(b, c), track(a, b)], [a, b, c], ['a', 'b', 'c']);
    expect(routes).toHaveLength(1);
    expect([routes[0], [...routes[0]].reverse()]).toContainEqual(['a', 'b', 'c']);
  });

  it('gives a branched line one route per branch from the trunk terminal', () => {
    // a - b - j, then j branches to x and to y
    const a = { id: 'a', x: 0, y: 0 }, b = { id: 'b', x: 5, y: 0 }, j = { id: 'j', x: 10, y: 0 };
    const x = { id: 'x', x: 15, y: -5 }, y = { id: 'y', x: 15, y: 5 };
    const { routes } = buildLineRoutes(
      [track(a, b), track(b, j), track(j, x), track(j, y)],
      [a, b, j, x, y],
      ['a', 'b', 'j', 'x', 'y'],
    );
    expect(routes).toEqual([['a', 'b', 'j', 'x'], ['a', 'b', 'j', 'y']]);
  });

  it('turns a station the track runs over into a stop', () => {
    // track a→c is drawn straight through b
    const a = { id: 'a', x: 0, y: 0 }, b = { id: 'b', x: 5, y: 0 }, c = { id: 'c', x: 10, y: 0 };
    const { routes, extraPaths } = buildLineRoutes([track(a, c)], [a, b, c], ['a', 'c']);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toContain('b');
    expect(extraPaths.get('a→b')).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }]);
  });
});

describe('SimulationEngine with routes', () => {
  it('alternates between branches', () => {
    const a = { id: 'a', x: 0, y: 0 }, j = { id: 'j', x: 4, y: 0 };
    const x = { id: 'x', x: 8, y: -4 }, y = { id: 'y', x: 8, y: 4 };
    const { stops } = stopsOf([a, j, x, y], [track(a, j), track(j, x), track(j, y)], 120);
    expect(stops.slice(0, 8)).toEqual(['j', 'x', 'j', 'a', 'j', 'y', 'j', 'a']);
  });

  it('stops at every station it physically passes', () => {
    const a = { id: 'a', x: 0, y: 0 }, b = { id: 'b', x: 5, y: 0 }, c = { id: 'c', x: 10, y: 0 };
    const { stops } = stopsOf([a, b, c], [track(a, c)], 30);
    expect(stops.slice(0, 3)).toEqual(['b', 'c', 'b']);
  });

  it('starts a reversing train clear of the terminal, with its whole length on track', () => {
    const a = { id: 'a', x: 0, y: 0 }, b = { id: 'b', x: 10, y: 0 };
    const { engine } = stopsOf([a, b], [track(a, b)], 0, 3);
    const geo = engine.getTrainRouteGeometry('t')!;
    expect(geo.direction).toBe(1);
    expect(geo.headDist).toBeCloseTo(3); // head starts 3 units out: tail at the terminal
  });
});
