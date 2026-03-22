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
    // Path should only move in cardinal directions (one axis changes at a time)
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i].x - path[i - 1].x);
      const dy = Math.abs(path[i].y - path[i - 1].y);
      expect(dx + dy).toBe(1);
    }
  });
});
