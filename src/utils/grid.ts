export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function gridToPixel(gridCoord: number, gridSize: number): number {
  return gridCoord * gridSize;
}

export function pixelToGrid(pixel: number, gridSize: number): number {
  return Math.round(pixel / gridSize);
}
