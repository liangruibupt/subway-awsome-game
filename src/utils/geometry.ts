export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function manhattanPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number }[] {
  // Only 2-3 key points: start, corner (if needed), end
  if (from.x === to.x || from.y === to.y) {
    // Straight line — just start and end
    return [{ ...from }, { ...to }];
  }
  // L-shaped: horizontal first, then vertical → 3 points
  return [
    { ...from },
    { x: to.x, y: from.y },  // corner
    { ...to },
  ];
}

/**
 * Simplify a path by removing collinear intermediate points.
 * Keeps only points where the direction changes.
 */
export function simplifyPath(path: { x: number; y: number }[]): { x: number; y: number }[] {
  if (path.length <= 2) return [...path];
  const result = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const next = path[i + 1];
    // Check if prev→curr→next are collinear
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    // Cross product ≠ 0 means direction change
    if (dx1 * dy2 - dy1 * dx2 !== 0) {
      result.push(curr);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}
