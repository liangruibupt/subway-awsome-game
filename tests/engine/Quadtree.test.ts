import { describe, it, expect } from 'vitest';
import { Quadtree } from '../../src/engine/Quadtree';

describe('Quadtree', () => {
  it('inserts and queries points in range', () => {
    const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 });
    qt.insert({ id: 'a', x: 10, y: 10 });
    qt.insert({ id: 'b', x: 90, y: 90 });
    qt.insert({ id: 'c', x: 50, y: 50 });

    const results = qt.query({ x: 0, y: 0, w: 60, h: 60 });
    expect(results.map(r => r.id)).toContain('a');
    expect(results.map(r => r.id)).toContain('c');
    expect(results.map(r => r.id)).not.toContain('b');
  });

  it('finds nearest point', () => {
    const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 });
    qt.insert({ id: 'a', x: 10, y: 10 });
    qt.insert({ id: 'b', x: 50, y: 50 });
    const nearest = qt.findNearest(12, 12, 20);
    expect(nearest?.id).toBe('a');
  });

  it('returns null when no point within radius', () => {
    const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 });
    qt.insert({ id: 'a', x: 90, y: 90 });
    const nearest = qt.findNearest(10, 10, 5);
    expect(nearest).toBeNull();
  });

  it('handles many points', () => {
    const qt = new Quadtree({ x: 0, y: 0, w: 1000, h: 1000 });
    for (let i = 0; i < 100; i++) {
      qt.insert({ id: `p${i}`, x: i * 10, y: i * 10 });
    }
    const results = qt.query({ x: 0, y: 0, w: 50, h: 50 });
    expect(results.length).toBe(6); // 0,0 through 50,50 inclusive
  });
});
