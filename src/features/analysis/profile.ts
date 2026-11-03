import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';

export interface ProfilePoint {
  readonly index: number;
  readonly col: number;
  readonly row: number;
  readonly geoX: number;
  readonly geoY: number;
  readonly elevation: number | null;
  readonly distanceHorizontal: number;
  readonly distanceSurface: number;
  readonly slopeDegrees: number | null;
}

export interface ProfileTransect {
  readonly start: { readonly col: number; readonly row: number };
  readonly end: { readonly col: number; readonly row: number };
}

export interface ProfileResult {
  readonly transect: ProfileTransect;
  readonly points: readonly ProfilePoint[];
  readonly totalHorizontalDistance: number;
  readonly totalSurfaceDistance: number;
  readonly minElevation: number;
  readonly maxElevation: number;
  readonly meanElevation: number;
  readonly elevationGain: number;
  readonly elevationLoss: number;
  readonly validPointCount: number;
}

/**
 * Performs bilinear interpolation of elevation at fractional grid coordinates (col, row).
 *
 * Accounts for NoData cells by performing normalized weighted interpolation among valid
 * corners, returning null only if all surrounding corners are missing or out of bounds.
 */
export function interpolateElevation(
  grid: ElevationGrid,
  col: number,
  row: number
): number | null {
  const { width, height } = grid;

  if (col < 0 || col > width - 1 || row < 0 || row > height - 1) {
    return null;
  }

  const c0 = Math.floor(col);
  const r0 = Math.floor(row);
  const c1 = Math.min(c0 + 1, width - 1);
  const r1 = Math.min(r0 + 1, height - 1);

  const u = col - c0;
  const v = row - r0;

  // Exact point or cell boundary
  if (c0 === c1 && r0 === r1) {
    return grid.getElevation(c0, r0);
  }

  const z00 = grid.getElevation(c0, r0);
  const z10 = grid.getElevation(c1, r0);
  const z01 = grid.getElevation(c0, r1);
  const z11 = grid.getElevation(c1, r1);

  // If all 4 are valid (most common path), standard bilinear interpolation
  if (z00 !== null && z10 !== null && z01 !== null && z11 !== null) {
    return (
      (1 - u) * (1 - v) * z00 +
      u * (1 - v) * z10 +
      (1 - u) * v * z01 +
      u * v * z11
    );
  }

  // Handle NoData with normalized weights of valid corner samples
  let sumWeighted = 0;
  let sumWeights = 0;

  const w00 = (1 - u) * (1 - v);
  if (z00 !== null && w00 > 1e-6) {
    sumWeighted += w00 * z00;
    sumWeights += w00;
  }

  const w10 = u * (1 - v);
  if (z10 !== null && w10 > 1e-6) {
    sumWeighted += w10 * z10;
    sumWeights += w10;
  }

  const w01 = (1 - u) * v;
  if (z01 !== null && w01 > 1e-6) {
    sumWeighted += w01 * z01;
    sumWeights += w01;
  }

  const w11 = u * v;
  if (z11 !== null && w11 > 1e-6) {
    sumWeighted += w11 * z11;
    sumWeights += w11;
  }

  if (sumWeights <= 1e-6) {
    return null;
  }

  return sumWeighted / sumWeights;
}

/**
 * Calculates metric distance between two geographic/projected coordinates.
 */
function getMetricDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  isDegree: boolean
): number {
  if (isDegree) {
    // 1 deg latitude ~ 111,320 meters
    const meanLatRad = (((y1 + y2) / 2) * Math.PI) / 180;
    const dx = (x2 - x1) * 111320 * Math.cos(meanLatRad);
    const dy = (y2 - y1) * 111320;
    return Math.sqrt(dx * dx + dy * dy);
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface ProfileOptions {
  /** Optional custom number of sample points along the transect */
  sampleCount?: number;
}

/**
 * Computes a 2D topographic cross-section elevation profile along a transect.
 *
 * Samples the elevation grid using bilinear interpolation, calculating:
 * - Cumulative horizontal ground distance
 * - Cumulative 3D surface distance (hypotenuse accounting for slope)
 * - Local slope between consecutive points
 * - Summary statistics (min, max, mean, gain, loss)
 */
export function calculateElevationProfile(
  grid: ElevationGrid,
  transect: ProfileTransect,
  options: ProfileOptions = {}
): ProfileResult {
  const { start, end } = transect;
  const isDegree = grid.crs.unit === 'degree';

  const dCol = end.col - start.col;
  const dRow = end.row - start.row;
  const pixelDist = Math.sqrt(dCol * dCol + dRow * dRow);

  // Adaptive sampling: at least 2 samples per pixel, bounded between 50 and 1500 samples
  const defaultSamples = Math.max(50, Math.min(1500, Math.ceil(pixelDist * 2) + 1));
  const numSamples = Math.max(2, options.sampleCount ?? defaultSamples);

  const points: ProfilePoint[] = [];

  let cumHorizontalDist = 0;
  let cumSurfaceDist = 0;
  let elevationGain = 0;
  let elevationLoss = 0;

  let minElev = Number.POSITIVE_INFINITY;
  let maxElev = Number.NEGATIVE_INFINITY;
  let sumElev = 0;
  let validCount = 0;

  let prevGeoX = 0;
  let prevGeoY = 0;
  let prevElevation: number | null = null;

  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    const col = start.col + t * dCol;
    const row = start.row + t * dRow;

    const [geoX, geoY] = grid.gridToGeo(col, row);
    const elev = interpolateElevation(grid, col, row);

    let stepHorizontalDist = 0;
    let stepSurfaceDist = 0;
    let slopeDeg: number | null = null;

    if (i > 0) {
      stepHorizontalDist = getMetricDistance(prevGeoX, prevGeoY, geoX, geoY, isDegree);
      cumHorizontalDist += stepHorizontalDist;

      if (elev !== null && prevElevation !== null) {
        const dZ = elev - prevElevation;
        stepSurfaceDist = Math.sqrt(stepHorizontalDist * stepHorizontalDist + dZ * dZ);
        cumSurfaceDist += stepSurfaceDist;

        if (dZ > 0) {
          elevationGain += dZ;
        } else {
          elevationLoss += Math.abs(dZ);
        }

        if (stepHorizontalDist > 1e-4) {
          slopeDeg = (Math.atan(Math.abs(dZ) / stepHorizontalDist) * 180) / Math.PI;
        } else {
          slopeDeg = 0;
        }
      } else {
        stepSurfaceDist = stepHorizontalDist;
        cumSurfaceDist += stepSurfaceDist;
      }
    }

    if (elev !== null) {
      if (elev < minElev) minElev = elev;
      if (elev > maxElev) maxElev = elev;
      sumElev += elev;
      validCount++;
    }

    points.push({
      index: i,
      col,
      row,
      geoX,
      geoY,
      elevation: elev,
      distanceHorizontal: cumHorizontalDist,
      distanceSurface: cumSurfaceDist,
      slopeDegrees: slopeDeg,
    });

    prevGeoX = geoX;
    prevGeoY = geoY;
    prevElevation = elev;
  }

  const safeMin = validCount > 0 ? minElev : 0;
  const safeMax = validCount > 0 ? maxElev : 0;
  const meanElev = validCount > 0 ? sumElev / validCount : 0;

  return {
    transect,
    points,
    totalHorizontalDistance: cumHorizontalDist,
    totalSurfaceDistance: cumSurfaceDist,
    minElevation: safeMin,
    maxElevation: safeMax,
    meanElevation: meanElev,
    elevationGain,
    elevationLoss,
    validPointCount: validCount,
  };
}

