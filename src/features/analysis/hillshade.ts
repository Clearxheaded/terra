import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { computeCellDerivatives, getMetricPixelSpacing } from './derivatives';
import type { HillshadeOptions, HillshadeResult } from './types';

/**
 * Computes analytical shaded relief (Hillshade) raster.
 *
 * Implements Lambertian cosine illumination:
 *   Illumination = max(0, N · L) * 255.0
 * where:
 *   L = unit light vector directed toward the sun at (azimuth, altitude)
 *   N = upward-facing surface normal derived from Horn's partial derivatives (dz/dx, dz/dy)
 *
 * @param grid Input elevation grid
 * @param options Sun illumination options (azimuth, altitude, zFactor)
 * @returns HillshadeResult containing 8-bit equivalent grayscale values [0, 255]
 */
export function calculateHillshade(
  grid: ElevationGrid,
  options: HillshadeOptions = {}
): HillshadeResult {
  const { azimuth = 315.0, altitude = 45.0, zFactor = 1.0 } = options;

  const width = grid.width;
  const height = grid.height;
  const count = width * height;
  const hillshadeData = new Float32Array(count);

  const { dx, dy } = getMetricPixelSpacing(grid);

  // Convert angles to radians
  const degToRad = Math.PI / 180.0;
  const azRad = azimuth * degToRad;
  const altRad = Math.max(0, Math.min(90, altitude)) * degToRad;

  // Unit vector toward the sun in geographic space (+X = East, +Y = North, +Z = Up)
  const cosAlt = Math.cos(altRad);
  const sunX = cosAlt * Math.sin(azRad);
  const sunY = cosAlt * Math.cos(azRad);
  const sunZ = Math.sin(altRad);

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
        hillshadeData[idx] = Number.NaN;
        continue;
      }

      const { dzdx, dzdy } = deriv;

      // Unnormalized surface normal: (-dz/dx, -dz/dy, 1.0)
      const normX = -dzdx;
      const normY = -dzdy;
      const normZ = 1.0;
      const normLen = Math.hypot(normX, normY, normZ);

      // Lambertian cosine law: N · L
      const cosIncidence = (normX * sunX + normY * sunY + normZ * sunZ) / normLen;

      // Clamp to [0, 1] then scale to [0, 255]
      const shade = Math.max(0, Math.min(1, cosIncidence)) * 255.0;

      hillshadeData[idx] = shade;

      if (shade < min) min = shade;
      if (shade > max) max = shade;
      sum += shade;
      validCount++;
    }
  }

  const safeMin = validCount > 0 ? min : 0;
  const safeMax = validCount > 0 ? max : 0;
  const mean = validCount > 0 ? sum / validCount : 0;

  return {
    data: hillshadeData,
    min: safeMin,
    max: safeMax,
    mean,
    validCount,
    azimuth,
    altitude,
  };
}

