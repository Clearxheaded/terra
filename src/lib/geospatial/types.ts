/**
 * Geospatial data structures and type definitions for Terra.
 */

/**
 * Standard affine transform 6-tuple representing raster georeferencing:
 * [originX, pixelWidth, xSkew, originY, ySkew, pixelHeight]
 *
 * For a standard north-up raster without rotation:
 * - originX: top-left X coordinate (e.g. easting / longitude)
 * - pixelWidth: horizontal distance per pixel (usually > 0)
 * - xSkew: 0 (rotation parameter)
 * - originY: top-left Y coordinate (e.g. northing / latitude)
 * - ySkew: 0 (rotation parameter)
 * - pixelHeight: vertical distance per pixel (usually < 0 for north-up grids)
 *
 * Coordinate transformation formula:
 *   X = originX + col * pixelWidth + row * xSkew
 *   Y = originY + col * ySkew + row * pixelHeight
 */
export type AffineTransform = [
  originX: number,
  pixelWidth: number,
  xSkew: number,
  originY: number,
  ySkew: number,
  pixelHeight: number,
];

export type DistanceUnit = 'meter' | 'degree' | 'foot' | 'unknown';
export type ElevationUnit = 'meter' | 'foot' | 'unknown';

export interface CoordinateReferenceSystem {
  readonly code?: string | number;
  readonly name?: string;
  readonly isProjected?: boolean;
  readonly unit: DistanceUnit;
}

export interface ElevationStats {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly validCount: number;
  readonly noDataCount: number;
}

export interface ElevationGridOptions {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
  readonly noDataValue?: number | null;
  readonly transform?: AffineTransform;
  readonly crs?: CoordinateReferenceSystem;
  readonly elevationUnit?: ElevationUnit;
  readonly datasetName?: string;
}

