import { fromArrayBuffer } from 'geotiff';
import { ElevationGrid } from './elevation-grid';
import type { AffineTransform, CoordinateReferenceSystem, DistanceUnit, ElevationUnit } from './types';

export interface GeoTIFFLoadResult {
  readonly grid: ElevationGrid;
  readonly warnings: string[];
}

/**
 * Parses a GeoTIFF ArrayBuffer or File into an ElevationGrid, extracting
 * dimensions, elevation raster, affine georeferencing, NoData sentinels,
 * and CRS metadata.
 */
export async function parseGeoTIFF(
  buffer: ArrayBuffer,
  datasetName = 'GeoTIFF Dataset'
): Promise<GeoTIFFLoadResult> {
  const warnings: string[] = [];

  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();

  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid raster dimensions: ${width}x${height}.`);
  }

  // Read first raster band
  const rasters = await image.readRasters();
  const firstBand = rasters[0];

  if (!firstBand) {
    throw new Error('GeoTIFF does not contain any raster elevation bands.');
  }

  // Convert to Float32Array
  let elevationData: Float32Array;
  if (firstBand instanceof Float32Array) {
    elevationData = firstBand;
  } else if (
    firstBand instanceof Int16Array ||
    firstBand instanceof Uint16Array ||
    firstBand instanceof Int32Array ||
    firstBand instanceof Uint32Array ||
    firstBand instanceof Float64Array ||
    firstBand instanceof Int8Array ||
    firstBand instanceof Uint8Array
  ) {
    elevationData = new Float32Array(firstBand);
  } else if (Array.isArray(firstBand)) {
    elevationData = new Float32Array(firstBand);
  } else {
    // TypedArray fallback
    elevationData = new Float32Array(firstBand as unknown as ArrayLike<number>);
  }

  // Parse NoData value
  let noDataValue: number | null = null;
  const fileDir = image.fileDirectory;

  if (fileDir?.GDAL_NODATA) {
    const rawNoData = String(fileDir.GDAL_NODATA).trim();
    const parsed = Number.parseFloat(rawNoData);
    if (!Number.isNaN(parsed)) {
      noDataValue = parsed;
    }
  }

  // Resolve Georeferencing / Affine Transform
  let transform: AffineTransform;
  try {
    const origin = image.getOrigin();
    const resolution = image.getResolution();

    if (origin && resolution) {
      // GeoTIFF getResolution returns positive values [resX, resY, resZ].
      // For standard north-up rasters, pixelHeight is negative (top-to-bottom rows).
      const pixelWidth = resolution[0] ?? 1;
      const pixelHeight = -(resolution[1] ?? 1);
      transform = [origin[0] ?? 0, pixelWidth, 0, origin[1] ?? 0, 0, pixelHeight];
    } else {
      warnings.push('GeoTIFF missing tiepoints or pixel resolution tags. Using unit grid coordinates.');
      transform = [0, 1, 0, 0, 0, -1];
    }
  } catch {
    warnings.push('Failed to parse GeoTIFF affine transform. Using unit grid coordinates.');
    transform = [0, 1, 0, 0, 0, -1];
  }

  // Coordinate Reference System metadata
  const geoKeys = image.geoKeys;
  let crsCode: string | number | undefined;
  let isProjected: boolean | undefined;
  let unit: DistanceUnit = 'unknown';

  if (geoKeys) {
    if (geoKeys.ProjectedCSTypeGeoKey) {
      crsCode = geoKeys.ProjectedCSTypeGeoKey;
      isProjected = true;
      unit = 'meter';
    } else if (geoKeys.GeographicTypeGeoKey) {
      crsCode = geoKeys.GeographicTypeGeoKey;
      isProjected = false;
      unit = 'degree';
      warnings.push(
        'Dataset uses a geographic coordinate reference system (degrees). Horizontal distances and vertical elevations use different units.'
      );
    }
  } else {
    warnings.push('GeoTIFF does not contain GeoKey metadata. Coordinate reference system is unknown.');
  }

  const crs: CoordinateReferenceSystem = {
    code: crsCode,
    isProjected,
    unit,
  };

  const elevationUnit: ElevationUnit = 'meter';

  const grid = new ElevationGrid({
    width,
    height,
    data: elevationData,
    noDataValue,
    transform,
    crs,
    elevationUnit,
    datasetName,
  });

  return { grid, warnings };
}
