import { describe, it, expect } from 'vitest';
import { findGridPath } from '../../src/engine/PathFinder';

describe('PathFinder', () => {
  it('finds path between two grid points', () => {
    const path = findGridPath({ x: 0, y: 0 }, { x: 4, y: 3 });
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 3 });
    expect(path.length).toBe(8); // 4 horizontal + 3 vertical + start = 8
  });

  it('returns direct path for same-axis stations', () => {
    const path = findGridPath({ x: 0, y: 0 }, { x: 5, y: 0 });
    expect(path.length).toBe(6);
    path.forEach(p => expect(p.y).toBe(0));
  });
});
