import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';

export interface GradientDerivatives {
  /** Partial derivative in East-West direction (positive = rises toward East) */
  dzdx: number;
  /** Partial derivative in North-South direction (positive = rises toward North) */
  dzdy: number;
}

/**
 * Computes metric pixel dimensions (dx, dy) in meters, accounting for CRS units.
 */
export function getMetricPixelSpacing(grid: ElevationGrid): { dx: number; dy: number } {
  let scale = 1.0;
  if (grid.crs.unit === 'degree') {
    // 1 degree of latitude/longitude is approximately 111,320 meters
    scale = 111320.0;
  } else if (grid.crs.unit === 'foot') {
    // 1 foot = 0.3048 meters
    scale = 0.3048;
  }

  const dx = Math.max(grid.pixelSizeX * scale, 1e-4);
  const dy = Math.max(grid.pixelSizeY * scale, 1e-4);

  return { dx, dy };
}

/**
 * Computes Horn's 3x3 finite-difference partial derivatives (dz/dx, dz/dy) for a cell.
 *
 * Horn's algorithm weights cardinal neighbors by 2 and diagonal neighbors by 1:
 *   dz/dx = ((z_tr + 2*z_r + z_br) - (z_tl + 2*z_l + z_bl)) / (8 * dx)
 *   dz/dy = ((z_tl + 2*z_t + z_tr) - (z_{bl} + 2*z_b + z_br)) / (8 * dy)
 *
 * Boundary and NoData policy:
 * - If the center cell is NoData, returns null.
 * - If a neighbor is out of bounds or NoData, it is replaced with the center cell value,
 *   preventing extreme slope spikes and numerical divergence at grid boundaries.
 */
export function computeCellDerivatives(
  grid: ElevationGrid,
  col: number,
  row: number,
  dx: number,
  dy: number,
  zFactor = 1.0
): GradientDerivatives | null {
  const width = grid.width;
  const height = grid.height;
  const data = grid.data;

  const centerIdx = row * width + col;
  const centerVal = data[centerIdx]!;
  if (grid.isNoData(centerVal)) {
    return null;
  }

  const zc = centerVal * zFactor;

  // Helper to fetch neighbor value with safe boundary and NoData substitution
  const getElevation = (c: number, r: number): number => {
    if (c < 0 || c >= width || r < 0 || r >= height) {
      return zc;
    }
    const val = data[r * width + c]!;
    if (grid.isNoData(val)) {
      return zc;
    }
    return val * zFactor;
  };

  // 3x3 Neighborhood:
  // Row r-1 is North (top), Row r+1 is South (bottom)
  // Col c-1 is West (left), Col c+1 is East (right)
  const ztl = getElevation(col - 1, row - 1);
  const zt = getElevation(col, row - 1);
  const ztr = getElevation(col + 1, row - 1);

  const zl = getElevation(col - 1, row);
  const zr = getElevation(col + 1, row);

  const zbl = getElevation(col - 1, row + 1);
  const zb = getElevation(col, row + 1);
  const zbr = getElevation(col + 1, row + 1);

  const dzdx = (ztr + 2 * zr + zbr - (ztl + 2 * zl + zbl)) / (8 * dx);
  const dzdy = (ztl + 2 * zt + ztr - (zbl + 2 * zb + zbr)) / (8 * dy);

  return { dzdx, dzdy };
}

