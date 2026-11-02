import { describe, expect, it } from 'vitest';
import { writeArrayBuffer } from 'geotiff';
import { parseGeoTIFF } from '../src/lib/geospatial/geotiff-loader';

describe('GeoTIFF Loader', () => {
  it('parses a valid GeoTIFF array buffer into an ElevationGrid', async () => {
    const width = 4;
    const height = 3;
    const values = new Uint8Array([
      120, 130, 140, 150,
      125, 135, 145, 155,
      130, 140, 150, 160,
    ]);

    const buffer = await writeArrayBuffer(values, {
      width,
      height,
    });

    const { grid, warnings } = await parseGeoTIFF(buffer, 'Sample DEM');

    expect(grid).toBeDefined();
    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect(grid.datasetName).toBe('Sample DEM');
    expect(grid.getElevation(0, 0)).toBe(120);
    expect(grid.getElevation(3, 2)).toBe(160);

    const stats = grid.getStats();
    expect(stats.min).toBe(120);
    expect(stats.max).toBe(160);
    expect(stats.validCount).toBe(12);

    // Should warn about missing CRS or unit coordinate fallback
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('rejects an empty or corrupt buffer', async () => {
    const corruptBuffer = new Uint8Array([0, 1, 2, 3, 4]).buffer;
    await expect(parseGeoTIFF(corruptBuffer)).rejects.toThrow();
  });
});
