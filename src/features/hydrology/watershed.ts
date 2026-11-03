/**
 * Watershed Delineation, Flow Path Tracing, and Stream Network Extraction.
 *
 * Provides exact upstream contributing area delineation via reverse flow BFS,
 * downstream flow path tracing to drainage outlets, and threshold-based stream extraction.
 */

import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { getDownstreamIndex } from './flow-direction';
import {
  D8_OFFSETS,
  type D8Direction,
  type FlowPathPoint,
  type WatershedResult,
} from './types';

/**
 * Delineates the upstream contributing watershed draining into a specified pour point.
 *
 * Uses reverse graph traversal (breadth-first search), recursively identifying
 * every neighbor whose D8 flow direction points directly into the expanding watershed basin.
 *
 * @param flowDir D8 flow direction raster.
 * @param grid Reference ElevationGrid for dimensions, NoData check, and spatial resolution.
 * @param pourCol Column index of pour point / outlet.
 * @param pourRow Row index of pour point / outlet.
 * @returns WatershedResult containing binary mask, cell count, and drainage area in km².
 */
export function delineateWatershed(
  flowDir: Uint8Array,
  grid: ElevationGrid,
  pourCol: number,
  pourRow: number
): WatershedResult {
  const width = grid.width;
  const height = grid.height;
  const totalCells = width * height;
  const mask = new Uint8Array(totalCells);

  // Validate pour point bounds
  if (pourCol < 0 || pourCol >= width || pourRow < 0 || pourRow >= height) {
    return {
      mask,
      cellCount: 0,
      areaKm2: 0,
      areaPercent: 0,
      pourPoint: { col: pourCol, row: pourRow },
    };
  }

  const pourIdx = pourRow * width + pourCol;
  if (grid.isNoData(grid.data[pourIdx]!)) {
    return {
      mask,
      cellCount: 0,
      areaKm2: 0,
      areaPercent: 0,
      pourPoint: { col: pourCol, row: pourRow },
    };
  }

  // Unit conversion factor to meters
  let unitToMeters = 1.0;
  if (grid.crs.unit === 'degree') {
    unitToMeters = 111320;
  }
  const pixelAreaM2 = (grid.pixelSizeX * unitToMeters) * (grid.pixelSizeY * unitToMeters);

  // Seed BFS with pour point
  mask[pourIdx] = 1;
  const queue: number[] = [pourIdx];
  let cellCount = 1;

  let head = 0;
  while (head < queue.length) {
    const currIdx = queue[head++]!;
    const c = currIdx % width;
    const r = Math.floor(currIdx / width);

    // Examine all 8 neighbors to see which flow into (c, r)
    for (let i = 0; i < 8; i++) {
      const off = D8_OFFSETS[i]!;
      const nc = c + off.dc;
      const nr = r + off.dr;

      if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;
      const nIdx = nr * width + nc;

      // Skip already marked or NoData cells
      if (mask[nIdx] === 1 || grid.isNoData(grid.data[nIdx]!)) continue;

      const nDir = flowDir[nIdx] as D8Direction;
      if (nDir === 0) continue;

      // Check if neighbor flows into current cell
      const downstreamIdx = getDownstreamIndex(nc, nr, nDir, width, height);
      if (downstreamIdx === currIdx) {
        mask[nIdx] = 1;
        cellCount++;
        queue.push(nIdx);
      }
    }
  }

  const areaKm2 = (cellCount * pixelAreaM2) / 1_000_000;
  const stats = grid.getStats();
  const areaPercent = stats.validCount > 0 ? (cellCount / stats.validCount) * 100 : 0;

  return {
    mask,
    cellCount,
    areaKm2,
    areaPercent,
    pourPoint: { col: pourCol, row: pourRow },
  };
}

/**
 * Traces a downstream water flow path from a given starting point until reaching an outlet.
 *
 * @param flowDir D8 flow direction raster.
 * @param grid Reference ElevationGrid.
 * @param flowAccum Flow accumulation array.
 * @param startCol Starting column index.
 * @param startRow Starting row index.
 * @returns Array of FlowPathPoints from source to terminus.
 */
export function traceFlowPath(
  flowDir: Uint8Array,
  grid: ElevationGrid,
  flowAccum: Float32Array,
  startCol: number,
  startRow: number
): FlowPathPoint[] {
  const width = grid.width;
  const height = grid.height;
  const path: FlowPathPoint[] = [];
  const visited = new Uint8Array(width * height);

  let c = startCol;
  let r = startRow;

  while (c >= 0 && c < width && r >= 0 && r < height) {
    const idx = r * width + c;
    if (visited[idx] === 1 || grid.isNoData(grid.data[idx]!)) {
      break;
    }

    visited[idx] = 1;
    path.push({
      col: c,
      row: r,
      elevation: grid.data[idx]!,
      accumulation: flowAccum[idx] ?? 1,
    });

    const dir = flowDir[idx] as D8Direction;
    if (dir === 0) {
      break; // Reached an outlet, pit, or boundary
    }

    const nextIdx = getDownstreamIndex(c, r, dir, width, height);
    if (nextIdx < 0) {
      break;
    }

    c = nextIdx % width;
    r = Math.floor(nextIdx / width);
  }

  return path;
}

/**
 * Extracts a binary stream network mask based on a minimum accumulation threshold.
 *
 * @param flowAccum Flow accumulation array.
 * @param width Raster width.
 * @param height Raster height.
 * @param threshold Minimum accumulation cell count for channel initiation.
 * @returns Binary Uint8Array mask where 1 indicates a stream channel cell.
 */
export function extractStreamMask(
  flowAccum: Float32Array,
  width: number,
  height: number,
  threshold: number
): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const val = flowAccum[i]!;
    if (!Number.isNaN(val) && val >= threshold) {
      mask[i] = 1;
    }
  }
  return mask;
}

