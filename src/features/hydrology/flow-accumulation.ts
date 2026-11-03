/**
 * Flow Accumulation Algorithm via In-Degree Topological Sorting.
 *
 * Computes contributing upstream drainage area for each cell in the DEM.
 * Guarantees O(N) evaluation time and absolute cycle-freedom (zero infinite loops)
 * by evaluating cells strictly according to their drainage dependency order.
 */

import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { getDownstreamIndex } from './flow-direction';
import { type D8Direction, type FlowAccumulationResult } from './types';

/**
 * Calculates flow accumulation across an elevation grid using D8 flow directions.
 *
 * @param grid Reference elevation model (for dimensions and NoData masking).
 * @param flowDir D8 flow direction raster.
 * @returns FlowAccumulationResult containing raw and log10-scaled arrays and statistics.
 */
export function calculateFlowAccumulation(
  grid: ElevationGrid,
  flowDir: Uint8Array
): FlowAccumulationResult {
  const width = grid.width;
  const height = grid.height;
  const totalCells = width * height;

  const accum = new Float32Array(totalCells);
  const logData = new Float32Array(totalCells);
  const inDegree = new Int32Array(totalCells);

  let validCount = 0;

  // 1. Initialize accumulation to 1.0 for valid cells, NaN for NoData
  for (let idx = 0; idx < totalCells; idx++) {
    const elev = grid.data[idx]!;
    if (grid.isNoData(elev)) {
      accum[idx] = NaN;
      logData[idx] = NaN;
    } else {
      accum[idx] = 1.0;
      validCount++;
    }
  }

  // 2. Compute in-degree (number of upstream neighbors draining directly into each cell)
  for (let r = 0; r < height; r++) {
    const rowOffset = r * width;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      if (grid.isNoData(grid.data[idx]!)) continue;

      const dir = flowDir[idx] as D8Direction;
      if (dir === 0) continue;

      const targetIdx = getDownstreamIndex(c, r, dir, width, height);
      if (targetIdx >= 0 && !grid.isNoData(grid.data[targetIdx]!)) {
        inDegree[targetIdx] = (inDegree[targetIdx] ?? 0) + 1;
      }
    }
  }

  // 3. Collect headwater cells (in-degree == 0, summits / ridges)
  const queue: number[] = [];
  for (let idx = 0; idx < totalCells; idx++) {
    if (grid.isNoData(grid.data[idx]!)) continue;
    if (inDegree[idx] === 0) {
      queue.push(idx);
    }
  }

  // 4. Topological traversal: accumulate downstream dependencies
  let head = 0;
  while (head < queue.length) {
    const currIdx = queue[head++]!;
    const c = currIdx % width;
    const r = Math.floor(currIdx / width);

    const dir = flowDir[currIdx] as D8Direction;
    if (dir === 0) continue;

    const targetIdx = getDownstreamIndex(c, r, dir, width, height);
    if (targetIdx >= 0 && !grid.isNoData(grid.data[targetIdx]!)) {
      accum[targetIdx] = (accum[targetIdx] ?? 0) + (accum[currIdx] ?? 0);
      const remainingInDegree = (inDegree[targetIdx] ?? 1) - 1;
      inDegree[targetIdx] = remainingInDegree;

      if (remainingInDegree === 0) {
        queue.push(targetIdx);
      }
    }
  }

  // 5. Compute log-scaled accumulation and descriptive statistics
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let maxCell = { col: 0, row: 0 };

  for (let idx = 0; idx < totalCells; idx++) {
    const val = accum[idx]!;
    if (Number.isNaN(val)) continue;

    // Log-10 scaling: log10(val) >= 0 since val >= 1
    const logVal = Math.log10(val);
    logData[idx] = logVal;

    if (val < min) min = val;
    if (val > max) {
      max = val;
      maxCell = {
        col: idx % width,
        row: Math.floor(idx / width),
      };
    }
    sum += val;
  }

  const mean = validCount > 0 ? sum / validCount : 0;

  return {
    data: accum,
    logData,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    mean,
    validCount,
    maxAccumCell: maxCell,
  };
}
