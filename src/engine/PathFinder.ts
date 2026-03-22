import { manhattanPath } from '../utils/geometry';

type GridPoint = { x: number; y: number };

/**
 * Finds a grid path between two grid points using Manhattan (horizontal-first,
 * then vertical) routing.  This is a simple wrapper around the shared
 * manhattanPath utility so that engine code has a stable, named import.
 */
export function findGridPath(from: GridPoint, to: GridPoint): GridPoint[] {
  return manhattanPath(from, to);
}
