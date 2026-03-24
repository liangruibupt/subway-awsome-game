import { describe, it, expect } from 'vitest';
import { distance, manhattanPath } from '../../src/utils/geometry';

describe('geometry utils', () => {
  it('calculates euclidean distance', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
    expect(distance(1, 1, 1, 1)).toBe(0);
  });

  it('generates manhattan path between two grid points', () => {
    const path = manhattanPath({ x: 0, y: 0 }, { x: 3, y: 2 });
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 2 });
    // Simplified path: start → corner → end = 3 points
    expect(path.length).toBe(3);
    expect(path[1]).toEqual({ x: 3, y: 0 }); // corner point
  });

  it('generates straight path when same axis', () => {
    const path = manhattanPath({ x: 0, y: 0 }, { x: 5, y: 0 });
    expect(path.length).toBe(2); // just start and end
  });
});
