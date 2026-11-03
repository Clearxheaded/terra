import { describe, expect, it } from 'vitest';
import { calculateElevationProfile } from '@/features/analysis/profile';
import {
  encodeGeoTIFF,
  exportStreamsToGeoJSON,
  exportWatershedToGeoJSON,
  serializeProfileToCsv,
} from '@/features/export';
import { ElevationGrid } from '@/lib/geospatial/elevation-grid';

describe('Geospatial Export Suite', () => {
  describe('Profile CSV Serialization', () => {
    it('serializes profile transect points into standard CSV format with correct headers', () => {
      const data = new Float32Array([100, 120, 140, 160]);
      const grid = new ElevationGrid({
        width: 4,
        height: 1,
        data,
        transform: [500000, 10, 0, 4000000, 0, -10],
        crs: { unit: 'meter' },
      });

      const profile = calculateElevationProfile(
        grid,
        { start: { col: 0, row: 0 }, end: { col: 3, row: 0 } },
        { sampleCount: 4 }
      );

      const csv = serializeProfileToCsv(profile);
      const lines = csv.split('\r\n');

      expect(lines.length).toBe(5); // Header + 4 data points
      expect(lines[0]).toBe(
        'Index,Column,Row,Map_X,Map_Y,Elevation_m,Elevation_ft,Horizontal_Dist_m,Surface_Dist_m,Slope_deg'
      );

      // Verify first data line
      const firstRow = lines[1]!.split(',');
      expect(firstRow[0]).toBe('0'); // Index 0
      expect(firstRow[1]).toBe('0.00'); // Col 0
      expect(firstRow[3]).toBe('500000.0000'); // Map X
      expect(firstRow[5]).toBe('100.00'); // Elevation m
      expect(firstRow[7]).toBe('0.00'); // Horizontal dist

      // Verify last data line
      const lastRow = lines[4]!.split(',');
      expect(lastRow[0]).toBe('3');
      expect(lastRow[1]).toBe('3.00');
      expect(lastRow[3]).toBe('500030.0000');
      expect(lastRow[5]).toBe('160.00');
      expect(parseFloat(lastRow[7]!)).toBeCloseTo(30, 1);
    });
  });

  describe('GeoJSON Stream Network Serialization', () => {
    it('serializes extracted stream channels as valid GeoJSON LineString features', () => {
      const width = 3;
      const height = 3;
      const data = new Float32Array(width * height).fill(100);
      const grid = new ElevationGrid({
        width,
        height,
        data,
        transform: [100, 10, 0, 200, 0, -10],
        crs: { code: 32610, unit: 'meter', isProjected: true },
      });

      // Flow direction pointing East (1)
      const flowDir = new Uint8Array([
        1, 1, 0,
        1, 1, 0,
        1, 1, 0,
      ]);

      // Flow accumulation values
      const flowAccum = new Float32Array([
        10, 20, 30,
        1, 2, 3,
        50, 100, 150,
      ]);

      // Filter threshold >= 20
      const geojson = exportStreamsToGeoJSON(grid, flowDir, flowAccum, 20);

      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.crs?.properties.name).toContain('32610');
      expect(geojson.features.length).toBeGreaterThan(0);

      // Check feature structure
      const feat = geojson.features[0]!;
      expect(feat.type).toBe('Feature');
      expect(feat.geometry.type).toBe('LineString');
      const coords = feat.geometry.coordinates as number[][];
      expect(coords.length).toBe(2); // Start [x, y], End [x, y]
      expect(feat.properties.flowAccumulation).toBeGreaterThanOrEqual(20);
    });
  });

  describe('GeoJSON Watershed Basin Serialization', () => {
    it('serializes delineated watershed mask into closed GeoJSON Polygon rings', () => {
      const width = 4;
      const height = 4;
      const data = new Float32Array(width * height).fill(500);
      const grid = new ElevationGrid({
        width,
        height,
        data,
        transform: [1000, 25, 0, 2000, 0, -25],
        crs: { code: 4326, unit: 'degree' },
      });

      // 2x2 contiguous watershed mask in center
      const mask = new Uint8Array([
        0, 0, 0, 0,
        0, 1, 1, 0,
        0, 1, 1, 0,
        0, 0, 0, 0,
      ]);

      const geojson = exportWatershedToGeoJSON(grid, mask, { col: 2, row: 2 }, 1.25);

      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features.length).toBe(1);

      const feat = geojson.features[0]!;
      expect(feat.geometry.type).toBe('Polygon');
      expect(feat.properties.areaKm2).toBeCloseTo(1.25, 2);
      expect(feat.properties.cellCount).toBe(4);

      const rings = feat.geometry.coordinates as number[][][];
      expect(rings.length).toBe(1);
      const exteriorRing = rings[0]!;
      expect(exteriorRing.length).toBeGreaterThanOrEqual(4);

      // A valid GeoJSON polygon ring must be closed (first and last vertex match)
      const firstVertex = exteriorRing[0]!;
      const lastVertex = exteriorRing[exteriorRing.length - 1]!;
      expect(firstVertex[0]).toBeCloseTo(lastVertex[0]!, 5);
      expect(firstVertex[1]).toBeCloseTo(lastVertex[1]!, 5);
    });
  });

  describe('GeoTIFF Binary Encoder', () => {
    it('encodes a valid 32-bit floating point GeoTIFF binary buffer with TIFF/GeoTIFF metadata tags', () => {
      const width = 4;
      const height = 3;
      const data = new Float32Array([
        10.5, 20.25, 30.125, 40.0,
        50.5, 60.25, 70.125, 80.0,
        90.5, 100.25, 110.125, 120.0,
      ]);

      const grid = new ElevationGrid({
        width,
        height,
        data,
        noDataValue: -9999,
        transform: [500000, 30, 0, 4200000, 0, -30],
        crs: { code: 32611, unit: 'meter', isProjected: true },
        datasetName: 'Test DEM',
      });

      const buffer = encodeGeoTIFF(grid, data);
      const view = new DataView(buffer);

      // 1. TIFF Header Verification
      // 'II' (Little-endian)
      expect(view.getUint8(0)).toBe(0x49);
      expect(view.getUint8(1)).toBe(0x49);
      // Magic number 42
      expect(view.getUint16(2, true)).toBe(42);
      // First IFD offset = 8
      expect(view.getUint32(4, true)).toBe(8);

      // 2. IFD Tag Count
      const numTags = view.getUint16(8, true);
      expect(numTags).toBe(17);

      // 3. Verify TIFF Tag IDs are strictly sorted in ascending order
      let prevTagId = -1;
      let rasterOffset = 0;
      let rasterByteCount = 0;
      let pixelScaleOffset = 0;
      let tiepointOffset = 0;

      for (let i = 0; i < numTags; i++) {
        const entryOffset = 10 + i * 12;
        const tagId = view.getUint16(entryOffset, true);
        expect(tagId).toBeGreaterThan(prevTagId);
        prevTagId = tagId;

        if (tagId === 256) {
          // ImageWidth
          expect(view.getUint32(entryOffset + 8, true)).toBe(width);
        } else if (tagId === 257) {
          // ImageLength
          expect(view.getUint32(entryOffset + 8, true)).toBe(height);
        } else if (tagId === 258) {
          // BitsPerSample
          expect(view.getUint16(entryOffset + 8, true)).toBe(32);
        } else if (tagId === 273) {
          // StripOffsets
          rasterOffset = view.getUint32(entryOffset + 8, true);
        } else if (tagId === 279) {
          // StripByteCounts
          rasterByteCount = view.getUint32(entryOffset + 8, true);
        } else if (tagId === 339) {
          // SampleFormat = 3 (IEEE Float)
          expect(view.getUint16(entryOffset + 8, true)).toBe(3);
        } else if (tagId === 33550) {
          // ModelPixelScaleTag
          pixelScaleOffset = view.getUint32(entryOffset + 8, true);
        } else if (tagId === 33922) {
          // ModelTiepointTag
          tiepointOffset = view.getUint32(entryOffset + 8, true);
        }
      }

      expect(rasterByteCount).toBe(width * height * 4);
      expect(rasterOffset).toBeGreaterThan(0);

      // 4. Verify ModelPixelScaleTag values [scaleX, scaleY, 0]
      expect(view.getFloat64(pixelScaleOffset, true)).toBeCloseTo(30, 5);
      expect(view.getFloat64(pixelScaleOffset + 8, true)).toBeCloseTo(30, 5);
      expect(view.getFloat64(pixelScaleOffset + 16, true)).toBeCloseTo(0, 5);

      // 5. Verify ModelTiepointTag values [0, 0, 0, originX, originY, 0]
      expect(view.getFloat64(tiepointOffset + 24, true)).toBeCloseTo(500000, 1);
      expect(view.getFloat64(tiepointOffset + 32, true)).toBeCloseTo(4200000, 1);

      // 6. Verify Raster Data values
      const rasterFloats = new Float32Array(buffer, rasterOffset, width * height);
      expect(rasterFloats[0]).toBeCloseTo(10.5, 4);
      expect(rasterFloats[1]).toBeCloseTo(20.25, 4);
      expect(rasterFloats[width * height - 1]).toBeCloseTo(120.0, 4);
    });
  });
});

