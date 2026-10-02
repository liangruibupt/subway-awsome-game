// src/engine/LineRoutes.ts
// Pure logic: turn a line's tracks into the station sequences trains run.

type Pt = { x: number; y: number };

export interface RouteTrack {
  stationAId: string;
  stationBId: string;
  path: Pt[];
}

export interface RouteStation {
  id: string;
  x: number;
  y: number;
}

export interface LineRoutePlan {
  /** Terminal-to-terminal service patterns, all starting at the same terminal.
   *  One for a plain line; one per branch for a branched line. */
  routes: string[][];
  /** Extra track pieces created by splitting a track at a station it passes
   *  over, keyed `${fromId}→${toId}` (both directions present). */
  extraPaths: Map<string, Pt[]>;
}

const key = (a: string, b: string) => `${a}→${b}`;

/** Distance (along the path) at which `p` lies on `path`, or null if it is not
 *  within `tol` grid units of it. */
function distanceAlongPath(path: Pt[], p: Pt, tol = 0.35): number | null {
  let traveled = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    if (len2 > 0) {
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      const cx = a.x + dx * t;
      const cy = a.y + dy * t;
      if (Math.hypot(p.x - cx, p.y - cy) <= tol) return traveled + len * t;
    }
    traveled += len;
  }
  return null;
}

/** Cut `path` into pieces at the given along-path distances (sorted). */
function splitPath(path: Pt[], cuts: { dist: number; at: Pt }[]): Pt[][] {
  const pieces: Pt[][] = [];
  let current: Pt[] = [{ ...path[0] }];
  let traveled = 0;
  let c = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    while (c < cuts.length && cuts[c].dist <= traveled + len + 1e-9) {
      // Snap the cut to the station centre so pieces join exactly there
      current.push({ ...cuts[c].at });
      pieces.push(current);
      current = [{ ...cuts[c].at }];
      c++;
    }
    current.push({ ...b });
    traveled += len;
  }
  pieces.push(current);
  return pieces;
}

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function walkEdges(walk: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < walk.length; i++) out.push(edgeKey(walk[i], walk[i + 1]));
  return out;
}

/** Every simple path from `from` to a node in `targets` (capped, for safety
 *  on big meshes). */
function simplePaths(adj: Map<string, string[]>, from: string, targets: Set<string>, cap = 2000): string[][] {
  const out: string[][] = [];
  const onPath = new Set<string>([from]);
  const path = [from];
  let steps = 0;
  const dfs = (node: string) => {
    if (out.length >= cap || ++steps > cap * 50) return;
    for (const n of adj.get(node) ?? []) {
      if (onPath.has(n)) continue;
      path.push(n);
      if (targets.has(n)) out.push([...path]);
      else {
        onPath.add(n);
        dfs(n);
        onPath.delete(n);
      }
      path.pop();
    }
  };
  dfs(from);
  return out;
}

/** Shortest path (BFS) between two stations. */
function shortestPath(adj: Map<string, string[]>, from: string, to: string): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const n of adj.get(cur) ?? []) {
      if (!prev.has(n)) { prev.set(n, cur); queue.push(n); }
    }
  }
  if (!prev.has(to)) return null;
  const out: string[] = [];
  for (let c: string | null = to; c !== null; c = prev.get(c) ?? null) out.unshift(c);
  return out;
}

/** Shortest walk from `start` (entered from `cameFrom`) to any target that
 *  never turns straight back the way it came — a train cannot U-turn
 *  between terminals. Stations may repeat (e.g. around a loop and back). */
function noUturnWalk(
  adj: Map<string, string[]>, start: string, cameFrom: string, targets: Set<string>,
): string[] | null {
  const sk = (node: string, from: string) => `${node}<${from}`;
  const prev = new Map<string, string | null>([[sk(start, cameFrom), null]]);
  const queue: [string, string][] = [[start, cameFrom]];
  while (queue.length) {
    const [node, from] = queue.shift()!;
    if (targets.has(node)) {
      const out: string[] = [];
      for (let k: string | null = sk(node, from); k !== null; k = prev.get(k) ?? null) out.unshift(k.split('<')[0]);
      return out;
    }
    for (const n of adj.get(node) ?? []) {
      if (n === from) continue;
      const k = sk(n, node);
      if (!prev.has(k)) { prev.set(k, sk(node, from)); queue.push([n, node]); }
    }
  }
  return null;
}

/**
 * Routes for a line whose track contains a loop. Every route starts at the
 * same home station; together they cover every track piece:
 *  1. terminal-to-terminal paths, picked greedily for new coverage (the two
 *     sides of a loop become two alternating routes);
 *  2. anything still unserved (a loop hanging off the line, a lollipop) gets
 *     a walk that goes out, round the loop and on to a terminal / back home.
 * A line with no terminals at all (a ring) gets a closed route that trains
 * run round continuously.
 */
function loopRoutes(adj: Map<string, string[]>, leaves: string[], home: string): string[][] {
  const uncovered = new Set<string>();
  for (const [a, ns] of adj) for (const b of ns) uncovered.add(edgeKey(a, b));
  const routes: string[][] = [];
  const take = (walk: string[]) => {
    routes.push(walk);
    for (const e of walkEdges(walk)) uncovered.delete(e);
  };

  const otherLeaves = new Set(leaves.filter(l => l !== home));
  if (otherLeaves.size > 0) {
    const cands = simplePaths(adj, home, otherLeaves);
    for (;;) {
      let best: string[] | null = null;
      let bestGain = 0;
      for (const c of cands) {
        const gain = new Set(walkEdges(c).filter(e => uncovered.has(e))).size;
        if (gain > bestGain || (gain === bestGain && best && gain > 0 && c.length > best.length)) {
          best = c;
          bestGain = gain;
        }
      }
      if (!best || bestGain === 0) break;
      take(best);
    }
  }

  const targets = otherLeaves.size > 0 ? otherLeaves : new Set([home]);
  const dist = new Map<string, number>();
  for (const id of adj.keys()) dist.set(id, shortestPath(adj, home, id)?.length ?? 1e9);
  let guard = adj.size * 4 + 8;
  while (uncovered.size > 0 && guard-- > 0) {
    // Serve the unserved piece nearest home first
    let u = '', w = '';
    let bestD = Infinity;
    for (const e of uncovered) {
      const [a, b] = e.split('|');
      const [near, far] = dist.get(a)! <= dist.get(b)! ? [a, b] : [b, a];
      if (dist.get(near)! < bestD) { bestD = dist.get(near)!; u = near; w = far; }
    }
    const out = shortestPath(adj, home, u);
    if (!out) { uncovered.clear(); break; }
    const on = noUturnWalk(adj, w, u, targets) ?? shortestPath(adj, w, [...targets][0]);
    if (!on) { uncovered.delete(edgeKey(u, w)); continue; }
    take([...out, ...on]);
  }
  return routes.filter(r => r.length >= 2);
}

/**
 * Build the routes trains run on one line.
 *
 * - Stations a track physically passes over are inserted as stops, so a train
 *   never runs straight through a station drawn on its own track.
 * - A branched (tree-shaped) line gets one route per branch, from a shared
 *   home terminal to each far terminal; trains alternate between them.
 * - A line with a loop falls back to walking the chain.
 */
export function buildLineRoutes(
  tracks: RouteTrack[],
  stations: RouteStation[],
  fallbackIds: string[],
): LineRoutePlan {
  const extraPaths = new Map<string, Pt[]>();
  if (tracks.length === 0) {
    return { routes: fallbackIds.length >= 2 ? [fallbackIds] : [], extraPaths };
  }

  // ── 1. Split tracks at stations they pass over ──────────────────────────
  const edges: { a: string; b: string }[] = [];
  for (const t of tracks) {
    if (!t.path || t.path.length < 2) {
      edges.push({ a: t.stationAId, b: t.stationBId });
      continue;
    }
    const cuts: { dist: number; at: Pt; id: string }[] = [];
    for (const s of stations) {
      if (s.id === t.stationAId || s.id === t.stationBId) continue;
      const d = distanceAlongPath(t.path, s);
      if (d !== null) cuts.push({ dist: d, at: { x: s.x, y: s.y }, id: s.id });
    }
    if (cuts.length === 0) {
      edges.push({ a: t.stationAId, b: t.stationBId });
      continue;
    }
    cuts.sort((p, q) => p.dist - q.dist);
    const ids = [t.stationAId, ...cuts.map(c => c.id), t.stationBId];
    const pieces = splitPath(t.path, cuts);
    for (let i = 0; i + 1 < ids.length; i++) {
      const piece = pieces[i];
      if (!extraPaths.has(key(ids[i], ids[i + 1]))) {
        extraPaths.set(key(ids[i], ids[i + 1]), piece);
        extraPaths.set(key(ids[i + 1], ids[i]), [...piece].reverse());
      }
      edges.push({ a: ids[i], b: ids[i + 1] });
    }
  }

  // ── 2. Graph of stations ────────────────────────────────────────────────
  const adj = new Map<string, string[]>();
  const seenEdge = new Set<string>();
  for (const { a, b } of edges) {
    if (a === b) continue;
    const k = a < b ? key(a, b) : key(b, a);
    if (seenEdge.has(k)) continue;
    seenEdge.add(k);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }

  const nodeCount = adj.size;
  const edgeCount = seenEdge.size;
  const leaves = [...adj.keys()].filter(id => adj.get(id)!.length === 1);
  const isTree = edgeCount === nodeCount - 1 && leaves.length >= 2;
  const order = new Map(fallbackIds.map((id, i) => [id, i]));
  if (!isTree && leaves.length === 0) {
    // Ring (or rings with no terminal): start at the busiest junction
    const home = [...adj.keys()].sort((p, q) =>
      adj.get(q)!.length - adj.get(p)!.length || (order.get(p) ?? 1e9) - (order.get(q) ?? 1e9),
    )[0];
    const routes = home ? loopRoutes(adj, leaves, home) : [];
    return { routes: routes.length ? routes : [fallbackIds], extraPaths };
  }

  // ── 3. Home terminal: the end of the longest unbranched run (the trunk) ──
  const tailLength = (leaf: string) => {
    let prev = leaf;
    let cur = adj.get(leaf)![0];
    let n = 1;
    while (adj.get(cur)!.length === 2) {
      const next = adj.get(cur)!.find(x => x !== prev)!;
      prev = cur;
      cur = next;
      n++;
    }
    return n;
  };
  const home = [...leaves].sort((p, q) =>
    tailLength(q) - tailLength(p) || (order.get(p) ?? 1e9) - (order.get(q) ?? 1e9),
  )[0];

  if (!isTree) {
    const routes = loopRoutes(adj, leaves, home);
    return { routes: routes.length ? routes : [fallbackIds], extraPaths };
  }

  // ── 4. One route per far terminal, in depth-first order ─────────────────
  const routes: string[][] = [];
  const walk = (node: string, parent: string | null, trail: string[]) => {
    const next = adj.get(node)!.filter(n => n !== parent);
    if (next.length === 0) {
      routes.push(trail);
      return;
    }
    for (const n of next) walk(n, node, [...trail, n]);
  };
  walk(home, null, [home]);

  return { routes, extraPaths };
}
