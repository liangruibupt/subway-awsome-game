import { describe, it, expect } from 'vitest';
import { snapToGrid, gridToPixel, pixelToGrid } from '../../src/utils/grid';

describe('grid utils', () => {
  it('snaps to nearest grid intersection', () => {
    expect(snapToGrid(47, 30)).toBe(60);
    expect(snapToGrid(14, 30)).toBe(0);
    expect(snapToGrid(15, 30)).toBe(30);
  });

  it('converts grid coords to pixel coords', () => {
    expect(gridToPixel(2, 30)).toBe(60);
    expect(gridToPixel(0, 30)).toBe(0);
  });

  it('converts pixel coords to grid coords', () => {
    expect(pixelToGrid(60, 30)).toBe(2);
    expect(pixelToGrid(75, 30)).toBe(3);
  });
});
