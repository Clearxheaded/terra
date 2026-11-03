import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { downloadFile } from './download';

export interface GeoTIFFExportOptions {
  filename?: string;
  noDataValue?: number;
}

/**
 * Encodes a 2D float32 raster into a valid, standard 32-bit floating point GeoTIFF binary buffer.
 *
 * Emits full TIFF/GeoTIFF metadata tags including:
 * - Little-endian IEEE 754 float32 raster strip
 * - ModelPixelScaleTag (33550) for pixel spatial resolution
 * - ModelTiepointTag (33922) for raster georeferencing origin
 * - GeoKeyDirectoryTag (34735) with CRS projection and raster model keys
 * - GDAL_NODATA (42113) ASCII metadata tag
 */
export function encodeGeoTIFF(
  grid: ElevationGrid,
  data: Float32Array,
  options: GeoTIFFExportOptions = {}
): ArrayBuffer {
  const { width, height } = grid;
  const noDataVal = options.noDataValue ?? grid.noDataValue ?? -9999;
  const noDataStr = `${noDataVal}\0`;

  // Scale and tiepoint coordinates from affine transform
  const scaleX = grid.pixelSizeX;
  const scaleY = grid.pixelSizeY;
  const originX = grid.transform[0];
  const originY = grid.transform[3];

  const isProjected = grid.crs.isProjected ?? grid.crs.unit === 'meter';
  const rawCrsCode = typeof grid.crs.code === 'number' ? grid.crs.code : 4326;

  // GeoKeys: 4 shorts header + 3 keys * 4 shorts = 16 shorts (32 bytes)
  const geoKeys = new Uint16Array([
    // KeyDirectoryHeader
    1, 1, 0, 3,
    // Key 1: GTModelTypeGeoKey (1024) -> 1 (Projected) or 2 (Geographic)
    1024, 0, 1, isProjected ? 1 : 2,
    // Key 2: GTRasterTypeGeoKey (1025) -> 1 (RasterPixelIsArea)
    1025, 0, 1, 1,
    // Key 3: ProjectedCSTypeGeoKey (3072) or GeographicTypeGeoKey (2048)
    isProjected ? 3072 : 2048, 0, 1, rawCrsCode,
  ]);

  // Layout calculations
  const numTags = 17;
  const headerSize = 8;
  const ifdSize = 2 + numTags * 12 + 4; // 210 bytes
  let extraDataOffset = (headerSize + ifdSize + 3) & ~3; // 4-byte aligned (212 bytes)

  const xResOffset = extraDataOffset;
  extraDataOffset += 8;

  const yResOffset = extraDataOffset;
  extraDataOffset += 8;

  const pixelScaleOffset = extraDataOffset;
  extraDataOffset += 24; // 3 * 8 bytes double

  const tiepointOffset = extraDataOffset;
  extraDataOffset += 48; // 6 * 8 bytes double

  const geoKeyOffset = extraDataOffset;
  extraDataOffset += geoKeys.byteLength; // 32 bytes

  const noDataOffset = extraDataOffset;
  const noDataBytes = new TextEncoder().encode(noDataStr);
  extraDataOffset += (noDataBytes.length + 3) & ~3; // 4-byte aligned

  const rasterDataOffset = (extraDataOffset + 3) & ~3;
  const rasterByteLength = width * height * 4;
  const totalFileSize = rasterDataOffset + rasterByteLength;

  const buffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(buffer);

  // 1. TIFF Header
  // 'II' (Little-endian)
  view.setUint8(0, 0x49);
  view.setUint8(1, 0x49);
  // Version 42
  view.setUint16(2, 42, true);
  // Offset to first IFD
  view.setUint32(4, headerSize, true);

  // 2. IFD
  let ifdPtr = headerSize;
  view.setUint16(ifdPtr, numTags, true);
  ifdPtr += 2;

  // Helper to write a 12-byte IFD directory entry
  const writeTag = (
    tagId: number,
    type: number,
    count: number,
    valOrOffset: number
  ) => {
    view.setUint16(ifdPtr, tagId, true);
    view.setUint16(ifdPtr + 2, type, true);
    view.setUint32(ifdPtr + 4, count, true);
    view.setUint32(ifdPtr + 8, valOrOffset, true);
    ifdPtr += 12;
  };

  // Types: 1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL, 12=DOUBLE
  // Strict ascending order of Tag IDs required by TIFF standard!
  writeTag(256, 4, 1, width); // ImageWidth
  writeTag(257, 4, 1, height); // ImageLength
  writeTag(258, 3, 1, 32); // BitsPerSample
  writeTag(259, 3, 1, 1); // Compression (1 = uncompressed)
  writeTag(262, 3, 1, 1); // PhotometricInterpretation (1 = BlackIsZero)
  writeTag(273, 4, 1, rasterDataOffset); // StripOffsets
  writeTag(277, 3, 1, 1); // SamplesPerPixel
  writeTag(278, 4, 1, height); // RowsPerStrip
  writeTag(279, 4, 1, rasterByteLength); // StripByteCounts
  writeTag(282, 5, 1, xResOffset); // XResolution
  writeTag(283, 5, 1, yResOffset); // YResolution
  writeTag(296, 3, 1, 2); // ResolutionUnit (2 = Inch)
  writeTag(339, 3, 1, 3); // SampleFormat (3 = IEEE float)
  writeTag(33550, 12, 3, pixelScaleOffset); // ModelPixelScaleTag
  writeTag(33922, 12, 6, tiepointOffset); // ModelTiepointTag
  writeTag(34735, 3, geoKeys.length, geoKeyOffset); // GeoKeyDirectoryTag
  writeTag(42113, 2, noDataBytes.length, noDataOffset); // GDAL_NODATA

  // Next IFD offset = 0 (terminate chain)
  view.setUint32(ifdPtr, 0, true);

  // 3. Write Extra Tag Data
  // XResolution: 72 / 1
  view.setUint32(xResOffset, 72, true);
  view.setUint32(xResOffset + 4, 1, true);

  // YResolution: 72 / 1
  view.setUint32(yResOffset, 72, true);
  view.setUint32(yResOffset + 4, 1, true);

  // ModelPixelScaleTag: [scaleX, scaleY, 0]
  view.setFloat64(pixelScaleOffset, scaleX, true);
  view.setFloat64(pixelScaleOffset + 8, scaleY, true);
  view.setFloat64(pixelScaleOffset + 16, 0.0, true);

  // ModelTiepointTag: [0, 0, 0, originX, originY, 0]
  view.setFloat64(tiepointOffset, 0, true);
  view.setFloat64(tiepointOffset + 8, 0, true);
  view.setFloat64(tiepointOffset + 16, 0, true);
  view.setFloat64(tiepointOffset + 24, originX, true);
  view.setFloat64(tiepointOffset + 32, originY, true);
  view.setFloat64(tiepointOffset + 40, 0, true);

  // GeoKeyDirectoryTag
  for (let i = 0; i < geoKeys.length; i++) {
    view.setUint16(geoKeyOffset + i * 2, geoKeys[i]!, true);
  }

  // GDAL_NODATA string
  const u8Array = new Uint8Array(buffer);
  u8Array.set(noDataBytes, noDataOffset);

  // 4. Copy Raster Float32 Data
  const rasterFloatView = new Float32Array(buffer, rasterDataOffset, width * height);
  rasterFloatView.set(data);

  return buffer;
}

/**
 * Encodes an active elevation or analysis layer into a GeoTIFF and prompts browser download.
 */
export function exportLayerToGeoTIFF(
  grid: ElevationGrid,
  data: Float32Array,
  filename = 'terra-export.tif',
  options?: GeoTIFFExportOptions
): void {
  const buffer = encodeGeoTIFF(grid, data, options);
  downloadFile(buffer, filename, 'image/tiff');
}

