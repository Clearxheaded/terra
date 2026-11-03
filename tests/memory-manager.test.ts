import { describe, expect, it } from 'vitest';
import {
  checkRasterSafety,
  computeOptimalLodStride,
  decimateGrid,
  estimateRasterMemoryUsage,
} from '@/lib/geospatial/memory-manager';
import { createSyntheticTerrain } from '@/lib/geospatial/synthetic-terrain';

describe('Raster Memory Management & Bounding', () => {
  it('computes accurate memory estimates for small and large rasters', () => {
    // 512 x 512 = 262,144 cells
    const est512 = estimateRasterMemoryUsage(512, 512);
    expect(est512.totalCells).toBe(262144);
    expect(est512.rawElevationMb).toBeCloseTo(1.0, 1);
    expect(est512.recommendedLodStride).toBe(1);
    expect(est512.isLargeDataset).toBe(false);

    // 2048 x 2048 = 4,194,304 cells
    const est2048 = estimateRasterMemoryUsage(2048, 2048);
    expect(est2048.totalCells).toBe(4194304);
    expect(est2048.rawElevationMb).toBeCloseTo(16.0, 1);
    expect(est2048.recommendedLodStride).toBeGreaterThanOrEqual(2);
    expect(est2048.isLargeDataset).toBe(false); // Exactly at boundary

    // 3000 x 3000 = 9,000,000 cells
    const est3000 = estimateRasterMemoryUsage(3000, 3000);
    expect(est3000.isLargeDataset).toBe(true);
    expect(est3000.recommendedLodStride).toBe(3);
  });

  it('determines optimal LOD strides to stay under vertex budgets', () => {
    expect(computeOptimalLodStride(500, 500, 1_000_000)).toBe(1);
    expect(computeOptimalLodStride(1000, 1000, 1_000_000)).toBe(1);
    // 1500 x 1500 = 2.25M cells -> ceil(sqrt(2.25)) = 2
    expect(computeOptimalLodStride(1500, 1500, 1_000_000)).toBe(2);
    // 2048 x 2048 = 4.19M cells -> ceil(sqrt(4.194)) = 3
    expect(computeOptimalLodStride(2048, 2048, 1_000_000)).toBe(3);
  });

  it('generates actionable safety warnings when dataset thresholds are exceeded', () => {
    const safeCheck = checkRasterSafety(512, 512);
    expect(safeCheck.safe).toBe(true);
    expect(safeCheck.warnings).toHaveLength(0);

    const largeCheck = checkRasterSafety(3000, 3000);
    expect(largeCheck.safe).toBe(true);
    expect(largeCheck.warnings.length).toBeGreaterThan(0);
    expect(largeCheck.warnings[0]).toContain('Large raster dataset detected');
  });

  it('decimates an ElevationGrid while maintaining georeferencing and boundaries', () => {
    const grid = createSyntheticTerrain({
      width: 100,
      height: 100,
      type: 'pyramid',
      baseElevation: 100,
      peakElevation: 1000,
    });

    const stride = 2;
    const decimated = decimateGrid(grid, stride);

    // Expected dimensions: ceil((100 - 1) / 2) + 1 = 51
    expect(decimated.width).toBe(51);
    expect(decimated.height).toBe(51);

    // Pixel size should scale proportionally by stride
    expect(decimated.pixelSizeX).toBeCloseTo(grid.pixelSizeX * stride);
    expect(decimated.pixelSizeY).toBeCloseTo(grid.pixelSizeY * stride);

    // Origin tiepoint should remain unchanged
    expect(decimated.transform[0]).toBe(grid.transform[0]);
    expect(decimated.transform[3]).toBe(grid.transform[3]);

    // First cell should match original first cell
    expect(decimated.data[0]).toBe(grid.data[0]);
    // Corner cell should match original corner cell
    const lastOrigIdx = (grid.height - 1) * grid.width + (grid.width - 1);
    const lastDecIdx = (decimated.height - 1) * decimated.width + (decimated.width - 1);
    expect(decimated.data[lastDecIdx]).toBe(grid.data[lastOrigIdx]);
  });
});
