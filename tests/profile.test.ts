import { describe, expect, it } from 'vitest';
import { calculateElevationProfile, interpolateElevation } from '@/features/analysis/profile';
import { ElevationGrid } from '@/lib/geospatial/elevation-grid';

describe('interpolateElevation (Bilinear Interpolation)', () => {
  it('interpolates exactly on a flat terrain plane', () => {
    const data = new Float32Array(9).fill(500);
    const grid = new ElevationGrid({
      width: 3,
      height: 3,
      data,
      transform: [0, 10, 0, 0, 0, -10],
    });

    expect(interpolateElevation(grid, 0, 0)).toBeCloseTo(500, 4);
    expect(interpolateElevation(grid, 1.5, 1.5)).toBeCloseTo(500, 4);
    expect(interpolateElevation(grid, 0.25, 1.75)).toBeCloseTo(500, 4);
  });

  it('interpolates exactly on an inclined ramp plane (z = 10*c + 20*r)', () => {
    // 3x3 grid
    const width = 3;
    const height = 3;
    const data = new Float32Array(width * height);
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        data[r * width + c] = 10 * c + 20 * r;
      }
    }
    const grid = new ElevationGrid({
      width,
      height,
      data,
      transform: [0, 10, 0, 0, 0, -10],
    });

    // Check exact integer cell
    expect(interpolateElevation(grid, 1, 1)).toBeCloseTo(30, 4);

    // Check midpoints
    // (0.5, 0) -> (0 + 10) / 2 = 5
    expect(interpolateElevation(grid, 0.5, 0)).toBeCloseTo(5, 4);
    // (1.5, 1.5) -> 10 * 1.5 + 20 * 1.5 = 15 + 30 = 45
    expect(interpolateElevation(grid, 1.5, 1.5)).toBeCloseTo(45, 4);
    // (0.2, 0.8) -> 10 * 0.2 + 20 * 0.8 = 2 + 16 = 18
    expect(interpolateElevation(grid, 0.2, 0.8)).toBeCloseTo(18, 4);
  });

  it('returns null for coordinates strictly out of bounds', () => {
    const data = new Float32Array(4).fill(100);
    const grid = new ElevationGrid({
      width: 2,
      height: 2,
      data,
      transform: [0, 1, 0, 0, 0, -1],
    });

    expect(interpolateElevation(grid, -0.5, 0)).toBeNull();
    expect(interpolateElevation(grid, 0, -0.1)).toBeNull();
    expect(interpolateElevation(grid, 1.1, 0.5)).toBeNull();
    expect(interpolateElevation(grid, 0.5, 1.5)).toBeNull();
  });

  it('handles NoData gracefully by weighting valid corners', () => {
    // 2x2 grid where (1, 1) is NoData
    // (0,0)=100, (1,0)=100, (0,1)=100, (1,1)=-9999 (NoData)
    const data = new Float32Array([100, 100, 100, -9999]);
    const grid = new ElevationGrid({
      width: 2,
      height: 2,
      data,
      noDataValue: -9999,
      transform: [0, 1, 0, 0, 0, -1],
    });

    // At (0, 0), all valid
    expect(interpolateElevation(grid, 0, 0)).toBeCloseTo(100, 4);
    // At (0.5, 0.5), missing (1, 1) should be excluded, remaining 3 corners are 100
    expect(interpolateElevation(grid, 0.5, 0.5)).toBeCloseTo(100, 4);
    // Directly at (1, 1), should return null
    expect(interpolateElevation(grid, 1, 1)).toBeNull();
  });

  it('returns null if all surrounding corners are NoData', () => {
    const data = new Float32Array(4).fill(-9999);
    const grid = new ElevationGrid({
      width: 2,
      height: 2,
      data,
      noDataValue: -9999,
      transform: [0, 1, 0, 0, 0, -1],
    });

    expect(interpolateElevation(grid, 0.5, 0.5)).toBeNull();
  });
});

describe('calculateElevationProfile', () => {
  it('computes correct cumulative distances, gain, and loss along an inclined ramp', () => {
    // 5x5 grid with cell spacing 10m in both X and Y
    const width = 5;
    const height = 5;
    const data = new Float32Array(width * height);
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        data[r * width + c] = c * 25; // 0, 25, 50, 75, 100
      }
    }

    const grid = new ElevationGrid({
      width,
      height,
      data,
      transform: [1000, 10, 0, 2000, 0, -10],
      crs: { unit: 'meter' },
    });

    // Transect from (0, 2) to (4, 2) [purely horizontal East along row 2]
    // Total horizontal distance = 4 cells * 10m/cell = 40m
    // Elevation goes from 0 to 100m (gain = 100m, loss = 0m)
    const profile = calculateElevationProfile(
      grid,
      { start: { col: 0, row: 2 }, end: { col: 4, row: 2 } },
      { sampleCount: 5 }
    );

    expect(profile.validPointCount).toBe(5);
    expect(profile.totalHorizontalDistance).toBeCloseTo(40, 2);
    expect(profile.minElevation).toBeCloseTo(0, 2);
    expect(profile.maxElevation).toBeCloseTo(100, 2);
    expect(profile.elevationGain).toBeCloseTo(100, 2);
    expect(profile.elevationLoss).toBeCloseTo(0, 2);

    // Surface distance: sqrt(40^2 + 100^2) = sqrt(1600 + 10000) = sqrt(11600) ~ 107.703m
    expect(profile.totalSurfaceDistance).toBeCloseTo(Math.sqrt(40 * 40 + 100 * 100), 1);
  });

  it('computes symmetric gain and loss on an up-and-down pyramid transect', () => {
    // 5x5 grid with a central peak at (2, 2) = 200m, borders = 100m
    const width = 5;
    const height = 5;
    const data = new Float32Array([
      100, 100, 100, 100, 100,
      100, 150, 150, 150, 100,
      100, 150, 200, 150, 100,
      100, 150, 150, 150, 100,
      100, 100, 100, 100, 100,
    ]);

    const grid = new ElevationGrid({
      width,
      height,
      data,
      transform: [0, 20, 0, 0, 0, -20],
      crs: { unit: 'meter' },
    });

    // Transect from (0, 2) across peak at (2, 2) to (4, 2)
    const profile = calculateElevationProfile(
      grid,
      { start: { col: 0, row: 2 }, end: { col: 4, row: 2 } },
      { sampleCount: 9 }
    );

    expect(profile.minElevation).toBeCloseTo(100, 1);
    expect(profile.maxElevation).toBeCloseTo(200, 1);
    expect(profile.elevationGain).toBeCloseTo(100, 1);
    expect(profile.elevationLoss).toBeCloseTo(100, 1);
    expect(profile.totalHorizontalDistance).toBeCloseTo(80, 1); // 4 cells * 20m = 80m
  });
});

