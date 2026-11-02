import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { computeCellDerivatives, getMetricPixelSpacing } from './derivatives';
import type { AspectHistogram, AspectResult } from './types';

/** Sentinel value used to represent flat terrain where aspect is undefined */
export const FLAT_ASPECT_SENTINEL = -1;

/**
 * Maps a compass azimuth angle [0, 360) in degrees to an 8-cardinal direction name.
 */
export function azimuthToCompass(azimuth: number): string {
  if (azimuth < 0 || Number.isNaN(azimuth)) {
    return 'Flat';
  }
  const normalized = (azimuth % 360 + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'North';
  if (normalized < 67.5) return 'North-East';
  if (normalized < 112.5) return 'East';
  if (normalized < 157.5) return 'South-East';
  if (normalized < 202.5) return 'South';
  if (normalized < 247.5) return 'South-West';
  if (normalized < 292.5) return 'West';
  return 'North-West';
}

/**
 * Computes directional aspect raster (0° to 360° clockwise from North).
 * Flat terrain is explicitly assigned FLAT_ASPECT_SENTINEL (-1).
 *
 * @param grid Input elevation grid
 * @param zFactor Optional vertical scaling factor
 * @returns AspectResult containing Float32Array raster and directional analysis
 */
export function calculateAspect(grid: ElevationGrid, zFactor = 1.0): AspectResult {
  const width = grid.width;
  const height = grid.height;
  const count = width * height;
  const aspectData = new Float32Array(count);

  const { dx, dy } = getMetricPixelSpacing(grid);
  const radToDeg = 180.0 / Math.PI;

  let validCount = 0;
  let flatCount = 0;
  let sumSin = 0;
  let sumCos = 0;

  const counts: Record<keyof AspectHistogram, number> = {
    N: 0,
    NE: 0,
    E: 0,
    SE: 0,
    S: 0,
    SW: 0,
    W: 0,
    NW: 0,
    flat: 0,
  };

  for (let r = 0; r < height; r++) {
    const rowOffset = r * width;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      const deriv = computeCellDerivatives(grid, c, r, dx, dy, zFactor);

      if (!deriv) {
        aspectData[idx] = Number.NaN;
        continue;
      }

      const { dzdx, dzdy } = deriv;
      const slopeMagnitude = Math.hypot(dzdx, dzdy);

      // Downhill direction vector
      const vx = -dzdx; // Downhill East component
      const vy = -dzdy; // Downhill North component

      // Flat terrain threshold: slope gradient < 1e-6
      if (slopeMagnitude < 1e-6) {
        aspectData[idx] = FLAT_ASPECT_SENTINEL;
        counts.flat++;
        flatCount++;
        validCount++;
        continue;
      }

      // Compass azimuth clockwise from North:
      // atan2(vx, vy) where vx is East (+X) and vy is North (+Y)
      let deg = Math.atan2(vx, vy) * radToDeg;
      if (deg < 0) {
        deg += 360.0;
      }
      if (deg >= 360.0) {
        deg -= 360.0;
      }

      aspectData[idx] = deg;
      validCount++;

      // Circular statistics accumulators
      const rad = deg * (Math.PI / 180.0);
      sumSin += Math.sin(rad);
      sumCos += Math.cos(rad);

      // Bin into cardinal histogram
      if (deg >= 337.5 || deg < 22.5) counts.N++;
      else if (deg < 67.5) counts.NE++;
      else if (deg < 112.5) counts.E++;
      else if (deg < 157.5) counts.SE++;
      else if (deg < 202.5) counts.S++;
      else if (deg < 247.5) counts.SW++;
      else if (deg < 292.5) counts.W++;
      else counts.NW++;
    }
  }

  // Calculate circular mean (directional mean angle)
  const nonFlatCount = validCount - flatCount;
  let circularMean: number | null = null;
  if (nonFlatCount > 0) {
    let meanRad = Math.atan2(sumSin / nonFlatCount, sumCos / nonFlatCount) * radToDeg;
    if (meanRad < 0) meanRad += 360.0;
    circularMean = meanRad;
  }

  // Find dominant direction
  let dominantDirKey: keyof AspectHistogram = 'flat';
  let maxCount = -1;
  for (const [key, cnt] of Object.entries(counts) as [keyof AspectHistogram, number][]) {
    if (cnt > maxCount) {
      maxCount = cnt;
      dominantDirKey = key;
    }
  }

  const dirNames: Record<keyof AspectHistogram, string> = {
    N: 'North',
    NE: 'North-East',
    E: 'East',
    SE: 'South-East',
    S: 'South',
    SW: 'South-West',
    W: 'West',
    NW: 'North-West',
    flat: 'Flat Terrain',
  };

  const dominantDirection = dirNames[dominantDirKey];
  const dominantPercentage = validCount > 0 ? (maxCount / validCount) * 100 : 0;

  return {
    data: aspectData,
    validCount,
    flatCount,
    circularMean,
    dominantDirection,
    dominantPercentage,
    histogram: counts,
  };
}

