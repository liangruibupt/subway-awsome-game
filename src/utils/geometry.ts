export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function manhattanPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [{ ...from }];
  let { x, y } = from;
  const dx = to.x > x ? 1 : -1;
  while (x !== to.x) {
    x += dx;
    path.push({ x, y });
  }
  const dy = to.y > y ? 1 : -1;
  while (y !== to.y) {
    y += dy;
    path.push({ x, y });
  }
  return path;
}
