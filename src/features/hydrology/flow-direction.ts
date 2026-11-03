/**
 * D8 Flow Direction Algorithm (O'Callaghan & Mark, 1984).
 *
 * Computes steepest downward descent among the 8 adjacent neighboring cells.
 * Accounts for true horizontal metric cell distances (including diagonal sqrt(dx^2 + dy^2)).
 * Applies a documented deterministic tie-breaking policy (clockwise from East).
 */

import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import {
  D8_E,
  D8_N,
  D8_NE,
  D8_NONE,
  D8_NW,
  D8_OFFSETS,
  D8_OFFSETS_BY_CODE,
  D8_S,
  D8_SE,
  D8_SW,
  D8_W,
  type D8Direction,
  type FlowDirectionResult,
} from './types';

/**
 * Returns the downstream raster index given a current cell and its D8 direction.
 * Returns -1 if the direction is 0 or flows out of raster bounds.
 */
export function getDownstreamIndex(
  col: number,
  row: number,
  direction: D8Direction,
  width: number,
  height: number
): number {
  if (direction === D8_NONE) return -1;
  const offset = D8_OFFSETS_BY_CODE[direction];
  if (!offset) return -1;

  const nc = col + offset.dc;
  const nr = row + offset.dr;
  if (nc < 0 || nc >= width || nr < 0 || nr >= height) {
    return -1;
  }
  return nr * width + nc;
}

/**
 * Computes the D8 flow direction raster from an ElevationGrid.
 *
 * @param grid Input elevation model.
 * @returns FlowDirectionResult with uint8 raster array and statistics.
 */
export function calculateFlowDirection(grid: ElevationGrid): FlowDirectionResult {
  const width = grid.width;
  const height = grid.height;
  const totalCells = width * height;
  const data = new Uint8Array(totalCells);

  // Conversion factor from CRS units to metric meters
  let unitToMeters = 1.0;
  if (grid.crs.unit === 'degree') {
    unitToMeters = 111320;
  }

  const dx = Math.max(grid.pixelSizeX * unitToMeters, 1e-4);
  const dy = Math.max(grid.pixelSizeY * unitToMeters, 1e-4);
  const diagDist = Math.hypot(dx, dy);

  // Pre-calculate neighbor distances for each of the 8 offsets
  const distances = new Float64Array(8);
  for (let i = 0; i < 8; i++) {
    const off = D8_OFFSETS[i]!;
    if (off.isDiagonal) {
      distances[i] = diagDist;
    } else if (off.dr === 0) {
      distances[i] = dx; // East, West
    } else {
      distances[i] = dy; // North, South
    }
  }

  const histogram: Record<D8Direction, number> = {
    [D8_NONE]: 0,
    [D8_E]: 0,
    [D8_SE]: 0,
    [D8_S]: 0,
    [D8_SW]: 0,
    [D8_W]: 0,
    [D8_NW]: 0,
    [D8_N]: 0,
    [D8_NE]: 0,
  };

  let validCount = 0;
  let pitCount = 0;

  for (let r = 0; r < height; r++) {
    const rowOffset = r * width;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      const centerElev = grid.data[idx]!;

      if (grid.isNoData(centerElev)) {
        data[idx] = D8_NONE;
        histogram[D8_NONE]++;
        continue;
      }

      validCount++;

      let maxSlope = 0;
      let bestDir: D8Direction = D8_NONE;

      // Evaluate all 8 neighbors in deterministic order: E, SE, S, SW, W, NW, N, NE
      for (let i = 0; i < 8; i++) {
        const off = D8_OFFSETS[i]!;
        const nc = c + off.dc;
        const nr = r + off.dr;

        // Skip boundary overflow (boundary cells with no lower neighbor become outlets)
        if (nc < 0 || nc >= width || nr < 0 || nr >= height) {
          continue;
        }

        const nIdx = nr * width + nc;
        const nElev = grid.data[nIdx]!;

        // Do not route water into NoData cells
        if (grid.isNoData(nElev)) {
          continue;
        }

        const drop = centerElev - nElev;
        if (drop <= 0) {
          continue; // Flat or uphill
        }

        const slope = drop / distances[i]!;

        // Deterministic tie-breaking: only replace if strictly steeper
        // using a small epsilon (1e-9) to avoid floating point indeterminism
        if (slope > maxSlope + 1e-9) {
          maxSlope = slope;
          bestDir = off.code;
        }
      }

      data[idx] = bestDir;
      histogram[bestDir]++;

      if (bestDir === D8_NONE) {
        pitCount++;
      }
    }
  }

  return {
    data,
    pitCount,
    validCount,
    histogram,
  };
}

