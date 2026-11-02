import { describe, expect, it } from 'vitest';
import { ElevationGrid } from '../src/lib/geospatial/elevation-grid';
import type { AffineTransform } from '../src/lib/geospatial/types';

describe('ElevationGrid', () => {
  it('constructs an ElevationGrid with valid dimensions and data', () => {
    const width = 3;
    const height = 2;
    const data = new Float32Array([100, 110, 120, 130, 140, 150]);
    const grid = new ElevationGrid({
      width,
      height,
      data,
      datasetName: 'Test Grid',
    });

    expect(grid.width).toBe(3);
    expect(grid.height).toBe(2);
    expect(grid.data.length).toBe(6);
    expect(grid.datasetName).toBe('Test Grid');
  });

  it('rejects invalid dimensions and mismatched buffer lengths', () => {
    const data = new Float32Array([10, 20, 30, 40]);

    // Zero / negative dimensions
    expect(() => new ElevationGrid({ width: 0, height: 4, data })).toThrow(/positive integer/);
    expect(() => new ElevationGrid({ width: -2, height: 2, data })).toThrow(/positive integer/);
    expect(() => new ElevationGrid({ width: 2.5, height: 2, data })).toThrow(/positive integer/);

    // Buffer length mismatch
    expect(() => new ElevationGrid({ width: 3, height: 3, data })).toThrow(/Buffer length mismatch/);
  });

  it('calculates raster 1D indices correctly', () => {
    const grid = new ElevationGrid({
      width: 4,
      height: 3,
      data: new Float32Array(12),
    });

    expect(grid.getIndex(0, 0)).toBe(0);
    expect(grid.getIndex(3, 0)).toBe(3);
    expect(grid.getIndex(0, 1)).toBe(4);
    expect(grid.getIndex(2, 2)).toBe(10);
    expect(grid.getIndex(3, 2)).toBe(11);
  });

  it('checks bounds correctly', () => {
    const grid = new ElevationGrid({
      width: 4,
      height: 3,
      data: new Float32Array(12),
    });

    expect(grid.isInBounds(0, 0)).toBe(true);
    expect(grid.isInBounds(3, 2)).toBe(true);
    expect(grid.isInBounds(-1, 0)).toBe(false);
    expect(grid.isInBounds(0, -1)).toBe(false);
    expect(grid.isInBounds(4, 0)).toBe(false);
    expect(grid.isInBounds(0, 3)).toBe(false);
  });

  it('handles NoData values, sentinel numbers, and NaNs', () => {
    // 2x2 grid with one NaN, one sentinel (-9999), and two valid elevations
    const data = new Float32Array([100, -9999, Number.NaN, 250]);
    const grid = new ElevationGrid({
      width: 2,
      height: 2,
      data,
      noDataValue: -9999,
    });

    expect(grid.getElevation(0, 0)).toBe(100);
    expect(grid.getElevation(1, 0)).toBeNull(); // sentinel
    expect(grid.getElevation(0, 1)).toBeNull(); // NaN
    expect(grid.getElevation(1, 1)).toBe(250);
    expect(grid.getElevation(5, 5)).toBeNull(); // out of bounds
  });

  it('computes accurate elevation statistics excluding NoData', () => {
    const data = new Float32Array([
      100, 200, -9999,
      400, 500, 600,
    ]);
    const grid = new ElevationGrid({
      width: 3,
      height: 2,
      data,
      noDataValue: -9999,
    });

    const stats = grid.getStats();
    expect(stats.validCount).toBe(5);
    expect(stats.noDataCount).toBe(1);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(600);
    expect(stats.mean).toBe((100 + 200 + 400 + 500 + 600) / 5);
  });

  it('transforms coordinates between grid and geographic space', () => {
    // Top-left origin: (500000, 4000000), 10m pixel width, -10m pixel height
    const transform: AffineTransform = [500000, 10, 0, 4000000, 0, -10];
    const grid = new ElevationGrid({
      width: 10,
      height: 10,
      data: new Float32Array(100),
      transform,
    });

    // Top-left corner (0, 0)
    const [x0, y0] = grid.gridToGeo(0, 0);
    expect(x0).toBe(500000);
    expect(y0).toBe(4000000);

    // Cell at column 5, row 3
    const [x53, y53] = grid.gridToGeo(5, 3);
    expect(x53).toBe(500000 + 5 * 10);
    expect(y53).toBe(4000000 + 3 * -10);

    // Inverse conversion back to grid
    const [col, row] = grid.geoToGrid(x53, y53);
    expect(col).toBeCloseTo(5, 6);
    expect(row).toBeCloseTo(3, 6);
  });

  it('resamples an elevation grid to smaller dimensions', () => {
    const width = 4;
    const height = 4;
    const data = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      data[i] = i * 10;
    }

    const grid = new ElevationGrid({
      width,
      height,
      data,
      transform: [1000, 5, 0, 2000, 0, -5],
    });

    const resampled = grid.resample(2, 2);
    expect(resampled.width).toBe(2);
    expect(resampled.height).toBe(2);
    expect(resampled.data.length).toBe(4);
    // Pixel resolution should scale by 2x
    expect(resampled.pixelSizeX).toBe(10);
    expect(resampled.pixelSizeY).toBe(10);
  });
});

