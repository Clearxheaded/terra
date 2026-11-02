import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { computeCellDerivatives, getMetricPixelSpacing } from './derivatives';
import type { SlopeResult, SlopeUnit } from './types';

/**
 * Computes the topographic slope raster using Horn's 3x3 finite-difference algorithm.
 *
 * @param grid Input elevation grid
 * @param unit Output unit: 'degrees' (0° to 90°) or 'percent' (0% to +inf%)
 * @param zFactor Optional vertical scaling factor (default 1.0)
 * @returns SlopeResult containing Float32Array raster and summary statistics
 */
export function calculateSlope(
  grid: ElevationGrid,
  unit: SlopeUnit = 'degrees',
  zFactor = 1.0
): SlopeResult {
  const width = grid.width;
  const height = grid.height;
  const count = width * height;
  const slopeData = new Float32Array(count);

  const { dx, dy } = getMetricPixelSpacing(grid);
  const radToDeg = 180.0 / Math.PI;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let validCount = 0;

  for (let r = 0; r < height; r++) {
    const rowOffset = r * width;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      const deriv = computeCellDerivatives(grid, c, r, dx, dy, zFactor);

      if (!deriv) {
        slopeData[idx] = Number.NaN;
        continue;
      }

      const { dzdx, dzdy } = deriv;
      const riseRun = Math.sqrt(dzdx * dzdx + dzdy * dzdy);

      let slopeVal: number;
      if (unit === 'degrees') {
        slopeVal = Math.atan(riseRun) * radToDeg;
      } else {
        slopeVal = riseRun * 100.0;
      }

      slopeData[idx] = slopeVal;

      if (slopeVal < min) min = slopeVal;
      if (slopeVal > max) max = slopeVal;
      sum += slopeVal;
      validCount++;
    }
  }

  const safeMin = validCount > 0 ? min : 0;
  const safeMax = validCount > 0 ? max : 0;
  const mean = validCount > 0 ? sum / validCount : 0;

  return {
    data: slopeData,
    unit,
    min: safeMin,
    max: safeMax,
    mean,
    validCount,
  };
}

