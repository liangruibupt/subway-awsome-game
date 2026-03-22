export interface Point {
  id: string;
  x: number;
  y: number;
}

export interface Rect {
  x: number; // top-left corner
  y: number;
  w: number;
  h: number;
}

/** Returns true if the point lies within the rect (inclusive boundaries). */
function rectContains(rect: Rect, p: Point): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.w &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.h
  );
}

/** Returns true if two rectangles overlap (touching edges count). */
function rectIntersects(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.w &&
    a.x + a.w >= b.x &&
    a.y <= b.y + b.h &&
    a.y + a.h >= b.y
  );
}

/**
 * Simple quadtree for 2-D spatial indexing of named points.
 *
 * Points at exactly the split boundary are placed in the NW or NE child so
 * that every point belongs to exactly one leaf node.
 */
export class Quadtree {
  private bounds: Rect;
  private maxPoints: number;
  private maxDepth: number;
  private depth: number;

  private points: Point[] = [];
  private children: [Quadtree, Quadtree, Quadtree, Quadtree] | null = null;

  constructor(bounds: Rect, maxPoints = 4, maxDepth = 8, depth = 0) {
    this.bounds = bounds;
    this.maxPoints = maxPoints;
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  /** Remove all points and collapse all subdivisions. */
  clear(): void {
    this.points = [];
    this.children = null;
  }

  /** Insert a point into the quadtree, subdividing as needed. */
  insert(point: Point): void {
    if (!rectContains(this.bounds, point)) return;

    if (this.children !== null) {
      this.insertIntoChild(point);
      return;
    }

    this.points.push(point);

    if (
      this.points.length > this.maxPoints &&
      this.depth < this.maxDepth
    ) {
      this.subdivide();
    }
  }

  /** Return all points whose coordinates fall within the query rectangle. */
  query(range: Rect): Point[] {
    const found: Point[] = [];
    this.collectInRange(range, found);
    return found;
  }

  /**
   * Return the closest point within maxRadius of (x, y), or null if none
   * exists within that radius.
   */
  findNearest(x: number, y: number, maxRadius: number): Point | null {
    // Search the bounding box of the circle first; then verify actual distance.
    const searchRect: Rect = {
      x: x - maxRadius,
      y: y - maxRadius,
      w: maxRadius * 2,
      h: maxRadius * 2,
    };
    const candidates = this.query(searchRect);

    let best: Point | null = null;
    let bestDist = maxRadius;

    for (const p of candidates) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= bestDist) {
        bestDist = d;
        best = p;
      }
    }

    return best;
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private subdivide(): void {
    const { x, y, w, h } = this.bounds;
    const hw = w / 2;
    const hh = h / 2;

    const makeChild = (cx: number, cy: number) =>
      new Quadtree(
        { x: cx, y: cy, w: hw, h: hh },
        this.maxPoints,
        this.maxDepth,
        this.depth + 1,
      );

    this.children = [
      makeChild(x,      y),      // NW
      makeChild(x + hw, y),      // NE
      makeChild(x,      y + hh), // SW
      makeChild(x + hw, y + hh), // SE
    ];

    for (const p of this.points) {
      this.insertIntoChild(p);
    }
    this.points = [];
  }

  private insertIntoChild(point: Point): void {
    if (this.children === null) return;
    for (const child of this.children) {
      if (rectContains(child['bounds'], point)) {
        child.insert(point);
        return;
      }
    }
    // Fallback: point is on the outer boundary of the root; keep it here.
    this.points.push(point);
  }

  private collectInRange(range: Rect, found: Point[]): void {
    if (!rectIntersects(this.bounds, range)) return;

    for (const p of this.points) {
      if (rectContains(range, p)) {
        found.push(p);
      }
    }

    if (this.children !== null) {
      for (const child of this.children) {
        child.collectInRange(range, found);
      }
    }
  }
}
