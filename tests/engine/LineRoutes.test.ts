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

describe('lines with a loop', () => {
  // The user's layout: spur 3-5-2-1, loop 1-6-4-7-11-10-8-9-1, spur 11-12
  const P: Record<string, [number, number]> = {
    s3: [0, 0], s5: [7, 0], s2: [13, 0], s1: [23, 4], s6: [27, 4], s4: [33, 4],
    s7: [33, 7], s9: [17, 9], s8: [25, 9], s10: [25, 13], s11: [33, 14], s12: [41, 11],
  };
  const st = Object.entries(P).map(([id, [x, y]]) => ({ id, x, y }));
  const g = (id: string) => st.find(s => s.id === id)!;
  const pairs = ['s3-s5', 's5-s2', 's2-s1', 's1-s6', 's6-s4', 's4-s7', 's7-s11',
    's1-s9', 's9-s8', 's8-s10', 's10-s11', 's11-s12'];
  const tracks = pairs.map(p => p.split('-')).map(([a, b]) => track(g(a), g(b)));

  it('runs terminal to terminal round both sides of the loop, reaching every station', () => {
    const { plan, stops } = stopsOf(st, tracks, 400, 2);
    expect(plan.routes).toEqual([
      ['s3', 's5', 's2', 's1', 's6', 's4', 's7', 's11', 's12'],
      ['s3', 's5', 's2', 's1', 's9', 's8', 's10', 's11', 's12'],
    ]);
    expect(new Set(stops)).toEqual(new Set(st.map(s => s.id)));
    // after reaching 12 it heads back; next trip takes the other side of the loop
    const firstReturn = stops.indexOf('s3');
    expect(stops.slice(firstReturn + 1, firstReturn + 8))
      .toEqual(['s5', 's2', 's1', 's9', 's8', 's10', 's11']);
  });

  it('takes a lollipop line round its loop and back home', () => {
    const a = { id: 'a', x: 0, y: 0 }, b = { id: 'b', x: 5, y: 0 };
    const c = { id: 'c', x: 10, y: 0 }, d = { id: 'd', x: 10, y: 5 }, e = { id: 'e', x: 5, y: 5 };
    const { plan, stops } = stopsOf([a, b, c, d, e],
      [track(a, b), track(b, c), track(c, d), track(d, e), track(e, b)], 120);
    expect(plan.routes).toHaveLength(1);
    expect(plan.routes[0][0]).toBe('a');
    expect(plan.routes[0][plan.routes[0].length - 1]).toBe('a');
    expect(new Set(stops)).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
  });

  it('runs a ring line round and round without reversing', () => {
    const a = { id: 'a', x: 0, y: 0 }, b = { id: 'b', x: 6, y: 0 };
    const c = { id: 'c', x: 6, y: 6 }, d = { id: 'd', x: 0, y: 6 };
    const { plan, stops } = stopsOf([a, b, c, d],
      [track(a, b), track(b, c), track(c, d), track(d, a)], 120);
    const r = plan.routes[0];
    expect(r[0]).toBe(r[r.length - 1]);
    expect(r).toHaveLength(5);
    // same rotation every lap: the sequence repeats with period 4
    for (let i = 4; i < 12; i++) expect(stops[i]).toBe(stops[i - 4]);
  });
});
