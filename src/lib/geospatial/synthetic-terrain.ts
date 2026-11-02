import { ElevationGrid } from './elevation-grid';
import type { AffineTransform, CoordinateReferenceSystem } from './types';

export interface SyntheticTerrainOptions {
  width: number;
  height: number;
  type: 'mountain' | 'valley' | 'plane' | 'pyramid' | 'depression';
  baseElevation?: number;
  peakElevation?: number;
  noDataBorder?: boolean;
}

/**
 * Generates deterministic mathematical elevation grids for testing and visualization.
 */
export function createSyntheticTerrain(options: SyntheticTerrainOptions): ElevationGrid {
  const {
    width,
    height,
    type,
    baseElevation = 500,
    peakElevation = 2500,
    noDataBorder = false,
  } = options;

  const data = new Float32Array(width * height);
  const noDataValue = -9999;
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const maxRadius = Math.hypot(centerX, centerY);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;

      if (noDataBorder && (r === 0 || r === height - 1 || c === 0 || c === width - 1)) {
        data[idx] = noDataValue;
        continue;
      }

      switch (type) {
        case 'mountain': {
          // Double gaussian peak with radial harmonics
          const dist = Math.hypot(c - centerX, r - centerY);
          const normDist = dist / maxRadius;
          const peakHeight = peakElevation - baseElevation;
          const cone = Math.exp(-normDist * 3.5);
          const noise = 0.05 * Math.sin(c * 0.4) * Math.cos(r * 0.4);
          const factor = Math.max(0, cone + noise);
          data[idx] = baseElevation + peakHeight * factor;
          break;
        }
        case 'valley': {
          // Parabolic valley sloping downwards along X
          const distFromCenterY = Math.abs(r - centerY) / centerY;
          const slopeX = (c / width) * 400;
          data[idx] = baseElevation + slopeX + distFromCenterY * distFromCenterY * 800;
          break;
        }
        case 'plane': {
          // Constant slope from NW to SE
          const slopeX = (c / width) * 500;
          const slopeY = (r / height) * 300;
          data[idx] = baseElevation + slopeX + slopeY;
          break;
        }
        case 'pyramid': {
          // Stepped or continuous 4-sided pyramid
          const distEdgeX = Math.min(c, width - 1 - c);
          const distEdgeY = Math.min(r, height - 1 - r);
          const minEdge = Math.min(distEdgeX, distEdgeY);
          const step = Math.floor(minEdge / 2) * 50;
          data[idx] = baseElevation + step;
          break;
        }
        case 'depression': {
          // Elevated plateau with a central basin/depression
          const dist = Math.hypot(c - centerX, r - centerY);
          const normDist = dist / maxRadius;
          const basin = (1 - Math.exp(-normDist * 5)) * 400;
          data[idx] = baseElevation + basin;
          break;
        }
      }
    }
  }

  const transform: AffineTransform = [
    500000, 30, 0, // UTM Zone 10N easting, 30m pixel size
    4500000, 0, -30, // northing, -30m pixel size
  ];

  const crs: CoordinateReferenceSystem = {
    code: 'EPSG:32610',
    name: 'WGS 84 / UTM zone 10N',
    isProjected: true,
    unit: 'meter',
  };

  return new ElevationGrid({
    width,
    height,
    data,
    noDataValue,
    transform,
    crs,
    elevationUnit: 'meter',
    datasetName: `Synthetic ${type.charAt(0).toUpperCase() + type.slice(1)} Terrain`,
  });
}
