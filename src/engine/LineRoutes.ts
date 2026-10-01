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

/** Simple chain walk used for lines that contain a loop. */
function chainWalk(adj: Map<string, string[]>, fallback: string[]): string[] {
  let start: string | undefined;
  for (const [id, n] of adj) if (n.length === 1) { start = id; break; }
  start ??= adj.keys().next().value ?? fallback[0];
  if (!start) return fallback;
  const ordered = [start];
  const seen = new Set([start]);
  let cur = start;
  for (;;) {
    const next = (adj.get(cur) ?? []).find(n => !seen.has(n));
    if (!next) break;
    ordered.push(next);
    seen.add(next);
    cur = next;
  }
  return ordered.length >= 2 ? ordered : fallback;
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
  if (!isTree) return { routes: [chainWalk(adj, fallbackIds)], extraPaths };

  // ── 3. Home terminal: the end of the longest unbranched run (the trunk) ──
  const order = new Map(fallbackIds.map((id, i) => [id, i]));
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
