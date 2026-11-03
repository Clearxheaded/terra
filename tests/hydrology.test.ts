import { describe, expect, it } from 'vitest';
import {
  calculateFlowAccumulation,
  calculateFlowDirection,
  delineateWatershed,
  extractStreamMask,
  fillDepressions,
  traceFlowPath,
} from '@/features/hydrology';
import {
  D8_E,
  D8_N,
  D8_NE,
  D8_NONE,
  D8_NW,
  D8_S,
  D8_SE,
  D8_SW,
  D8_W,
} from '@/features/hydrology/types';
import { ElevationGrid } from '@/lib/geospatial/elevation-grid';

/**
 * Helper to construct a synthetic ElevationGrid from a 2D array of heights.
 */
function createGridFrom2D(
  matrix: number[][],
  pixelSize = 10,
  noDataValue: number | null = -9999
): ElevationGrid {
  const height = matrix.length;
  const width = matrix[0]!.length;
  const data = new Float32Array(width * height);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      data[r * width + c] = matrix[r]![c]!;
    }
  }

  return new ElevationGrid({
    width,
    height,
    data,
    noDataValue,
    transform: [0, pixelSize, 0, 0, 0, -pixelSize],
    crs: { unit: 'meter' },
  });
}

describe('Priority-Flood Depression Filling (Barnes et al. 2014)', () => {
  it('fills an enclosed 3x3 depression bowl to the surrounding spill elevation', () => {
    // 3x3 bowl: outer rim is 50m, center is 10m deep pit
    const bowl = createGridFrom2D([
      [50, 50, 50],
      [50, 10, 50],
      [50, 50, 50],
    ]);

    const filled = fillDepressions(bowl, { epsilon: 0 });
    // Center cell (1, 1) should be raised to exactly 50m
    expect(filled.getElevation(1, 1)).toBe(50);
    // Perimeter cells should remain unchanged at 50m
    expect(filled.getElevation(0, 0)).toBe(50);
    expect(filled.getElevation(2, 2)).toBe(50);
  });

  it('preserves downstream drainage gradient when epsilon > 0', () => {
    const bowl = createGridFrom2D([
      [50, 50, 50],
      [50, 10, 50],
      [50, 50, 50],
    ]);

    const epsilon = 1e-4;
    const filled = fillDepressions(bowl, { epsilon });
    // Center should be raised to 50 + epsilon
    expect(filled.getElevation(1, 1)).toBeCloseTo(50 + epsilon, 5);
  });

  it('routes through the lowest spillway outlet', () => {
    // 5x5 basin where perimeter is 100m, but (2, 0) has a low notch at 40m
    const basin = createGridFrom2D([
      [100, 100, 40, 100, 100],
      [100, 20, 20, 20, 100],
      [100, 20, 10, 20, 100],
      [100, 20, 20, 20, 100],
      [100, 100, 100, 100, 100],
    ]);

    const filled = fillDepressions(basin, { epsilon: 0 });
    // The deep center (10m) should be raised to the spill notch elevation (40m), not 100m!
    expect(filled.getElevation(2, 2)).toBe(40);
    expect(filled.getElevation(1, 1)).toBe(40);
    expect(filled.getElevation(2, 0)).toBe(40);
  });

  it('leaves a naturally sloping planar surface completely unmodified', () => {
    // Sloping planar surface from 50m to 10m
    const plane = createGridFrom2D([
      [50, 40, 30],
      [50, 40, 30],
      [50, 40, 30],
    ]);

    const filled = fillDepressions(plane, { epsilon: 1e-5 });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        expect(filled.getElevation(c, r)).toBe(plane.getElevation(c, r));
      }
    }
  });
});

describe('D8 Flow Direction Algorithm', () => {
  it('accurately identifies cardinal directions on single-slope planes', () => {
    // Sloping East: elevation decreases as col increases
    const eastSlope = createGridFrom2D([
      [30, 20, 10],
      [30, 20, 10],
      [30, 20, 10],
    ]);
    const eastDir = calculateFlowDirection(eastSlope);
    // Center cell (1, 1) should flow East (bit 1)
    expect(eastDir.data[1 * 3 + 1]).toBe(D8_E);

    // Sloping South: elevation decreases as row increases
    const southSlope = createGridFrom2D([
      [30, 30, 30],
      [20, 20, 20],
      [10, 10, 10],
    ]);
    const southDir = calculateFlowDirection(southSlope);
    // Center cell should flow South (bit 4)
    expect(southDir.data[1 * 3 + 1]).toBe(D8_S);

    // Sloping West: elevation decreases as col decreases
    const westSlope = createGridFrom2D([
      [10, 20, 30],
      [10, 20, 30],
      [10, 20, 30],
    ]);
    const westDir = calculateFlowDirection(westSlope);
    // Center cell should flow West (bit 16)
    expect(westDir.data[1 * 3 + 1]).toBe(D8_W);

    // Sloping North: elevation decreases as row decreases
    const northSlope = createGridFrom2D([
      [10, 10, 10],
      [20, 20, 20],
      [30, 30, 30],
    ]);
    const northDir = calculateFlowDirection(northSlope);
    // Center cell should flow North (bit 64)
    expect(northDir.data[1 * 3 + 1]).toBe(D8_N);
  });

  it('accurately identifies diagonal directions accounting for sqrt(2) distance', () => {
    // Diagonal slope: Southeast (center (1,1) is 50, SE neighbor (2,2) is 10)
    const seSlope = createGridFrom2D([
      [80, 70, 60],
      [70, 50, 40],
      [60, 40, 10],
    ]);
    const seDir = calculateFlowDirection(seSlope);
    expect(seDir.data[1 * 3 + 1]).toBe(D8_SE);

    // Diagonal slope: Southwest
    const swSlope = createGridFrom2D([
      [60, 70, 80],
      [40, 50, 70],
      [10, 40, 60],
    ]);
    const swDir = calculateFlowDirection(swSlope);
    expect(swDir.data[1 * 3 + 1]).toBe(D8_SW);

    // Diagonal slope: Northwest
    const nwSlope = createGridFrom2D([
      [10, 40, 60],
      [40, 50, 70],
      [60, 70, 80],
    ]);
    const nwDir = calculateFlowDirection(nwSlope);
    expect(nwDir.data[1 * 3 + 1]).toBe(D8_NW);

    // Diagonal slope: Northeast
    const neSlope = createGridFrom2D([
      [60, 40, 10],
      [70, 50, 40],
      [80, 70, 60],
    ]);
    const neDir = calculateFlowDirection(neSlope);
    expect(neDir.data[1 * 3 + 1]).toBe(D8_NE);
  });

  it('properly favors steeper cardinal drop over gentle diagonal drop', () => {
    // Center is 100.
    // Cardinal South is 80 (drop = 20, dist = 10 -> slope = 2.0).
    // Diagonal SE is 75 (drop = 25, dist = 14.14 -> slope = 1.767).
    // Even though drop 25 > 20, cardinal slope 2.0 > diagonal slope 1.767!
    const grid = createGridFrom2D([
      [120, 120, 120],
      [120, 100, 120],
      [120, 80, 75],
    ]);
    const dir = calculateFlowDirection(grid);
    expect(dir.data[1 * 3 + 1]).toBe(D8_S);
  });

  it('marks flat areas or pits as D8_NONE (0)', () => {
    const flat = createGridFrom2D([
      [50, 50, 50],
      [50, 50, 50],
      [50, 50, 50],
    ]);
    const dir = calculateFlowDirection(flat);
    expect(dir.data[1 * 3 + 1]).toBe(D8_NONE);
    expect(dir.pitCount).toBe(9);
  });

  it('does not route flow into NoData cells', () => {
    // Center is 50. East neighbor is NoData (-9999). South neighbor is 40.
    // Flow should go to South (40), NOT into NoData!
    const grid = createGridFrom2D([
      [60, 60, 60],
      [60, 50, -9999],
      [60, 40, 60],
    ]);
    const dir = calculateFlowDirection(grid);
    expect(dir.data[1 * 3 + 1]).toBe(D8_S);
  });
});

describe('Flow Accumulation via Topological Sorting', () => {
  it('calculates analytical flow accumulation in a converging V-valley', () => {
    // 3x3 V-valley draining South along column 1:
    // Left col (0) slopes East to col 1.
    // Right col (2) slopes West to col 1.
    // Col 1 slopes South (row 0: 40, row 1: 35, row 2: 30).
    const valley = createGridFrom2D([
      [70, 40, 70],
      [60, 35, 60],
      [50, 30, 50],
    ]);

    const dir = calculateFlowDirection(valley);
    const accum = calculateFlowAccumulation(valley, dir.data);

    // Headwater ridges (0,0) and (2,0) each have accumulation = 1
    expect(accum.data[0 * 3 + 0]).toBe(1);
    expect(accum.data[0 * 3 + 2]).toBe(1);

    // Row 0, Col 1 has accumulation = 3 (itself + (0,0) + (2,0))
    expect(accum.data[0 * 3 + 1]).toBe(3);

    // Row 1, Col 1 receives: itself (1) + (0,1) [1] + (2,1) [1] + upstream (1,0) [3] = 6
    expect(accum.data[1 * 3 + 1]).toBe(6);

    // Outlet (1, 2) receives all 9 cells of the valley!
    expect(accum.data[2 * 3 + 1]).toBe(9);
    expect(accum.max).toBe(9);
    expect(accum.maxAccumCell).toEqual({ col: 1, row: 2 });
  });

  it('guarantees cycle-freedom and termination on unconditioned pit terrains', () => {
    // Basin with a flat central cycle/pit
    const pit = createGridFrom2D([
      [50, 50, 50],
      [50, 10, 50],
      [50, 50, 50],
    ]);

    const dir = calculateFlowDirection(pit);
    // Should terminate cleanly without hanging or crashing
    const accum = calculateFlowAccumulation(pit, dir.data);
    expect(accum.validCount).toBe(9);
    // Outer cells all flow inward to center (1, 1)
    expect(accum.data[1 * 3 + 1]).toBe(9);
  });

  it('computes valid log10-scaled accumulation', () => {
    const valley = createGridFrom2D([
      [70, 40, 70],
      [60, 35, 60],
      [50, 30, 50],
    ]);
    const dir = calculateFlowDirection(valley);
    const accum = calculateFlowAccumulation(valley, dir.data);

    // log10(1) = 0 for ridges
    expect(accum.logData[0 * 3 + 0]).toBeCloseTo(0, 5);
    // log10(9) ~ 0.95424 for outlet
    expect(accum.logData[2 * 3 + 1]).toBeCloseTo(Math.log10(9), 5);
  });
});

describe('Watershed Delineation & Flow Path Tracing', () => {
  it('delineates 100% of the contributing basin at the valley outlet', () => {
    const valley = createGridFrom2D([
      [70, 40, 70],
      [60, 35, 60],
      [50, 30, 50],
    ], 100); // 100m pixel size = 10,000 m² per cell

    const dir = calculateFlowDirection(valley);
    // Pour point at valley outlet (col 1, row 2)
    const watershed = delineateWatershed(dir.data, valley, 1, 2);

    expect(watershed.cellCount).toBe(9);
    expect(watershed.areaPercent).toBe(100);
    // 9 cells * 10,000 m² = 90,000 m² = 0.09 km²
    expect(watershed.areaKm2).toBeCloseTo(0.09, 4);
    // All mask cells are 1
    for (let i = 0; i < 9; i++) {
      expect(watershed.mask[i]).toBe(1);
    }
  });

  it('delineates sub-basin when pour point is midway up the valley', () => {
    const valley = createGridFrom2D([
      [70, 40, 70],
      [60, 35, 60],
      [50, 30, 50],
    ]);

    const dir = calculateFlowDirection(valley);
    // Pour point midway up at (col 1, row 0)
    const subWatershed = delineateWatershed(dir.data, valley, 1, 0);

    // Only row 0 cells (0,0), (1,0), (2,0) drain through (1,0)
    expect(subWatershed.cellCount).toBe(3);
    expect(subWatershed.mask[0 * 3 + 0]).toBe(1);
    expect(subWatershed.mask[0 * 3 + 1]).toBe(1);
    expect(subWatershed.mask[0 * 3 + 2]).toBe(1);
    // Downstream cells in row 1 and row 2 should NOT be in the watershed
    expect(subWatershed.mask[1 * 3 + 1]).toBe(0);
    expect(subWatershed.mask[2 * 3 + 1]).toBe(0);
  });

  it('traces complete downstream flow path from headwater to outlet', () => {
    const valley = createGridFrom2D([
      [70, 40, 70],
      [60, 35, 60],
      [50, 30, 50],
    ]);

    const dir = calculateFlowDirection(valley);
    const accum = calculateFlowAccumulation(valley, dir.data);

    // Trace from top-left ridge (0, 0)
    const path = traceFlowPath(dir.data, valley, accum.data, 0, 0);

    // Expected path: (0,0) -> (1,0) -> (1,1) -> (1,2)
    expect(path.length).toBe(4);
    expect(path[0]).toMatchObject({ col: 0, row: 0, elevation: 70 });
    expect(path[1]).toMatchObject({ col: 1, row: 0, elevation: 40 });
    expect(path[2]).toMatchObject({ col: 1, row: 1, elevation: 35 });
    expect(path[3]).toMatchObject({ col: 1, row: 2, elevation: 30 });
  });

  it('extracts stream network mask using accumulation threshold', () => {
    const valley = createGridFrom2D([
      [70, 40, 70],
      [60, 35, 60],
      [50, 30, 50],
    ]);

    const dir = calculateFlowDirection(valley);
    const accum = calculateFlowAccumulation(valley, dir.data);

    // Threshold = 5: only cells with accum >= 5 should be streams
    // (1,1 has 6, and 1,2 has 9)
    const streamMask = extractStreamMask(accum.data, 3, 3, 5);

    expect(streamMask[1 * 3 + 1]).toBe(1);
    expect(streamMask[2 * 3 + 1]).toBe(1);
    // Ridges (accum 1) and upper reach (accum 3) are not streams at threshold 5
    expect(streamMask[0 * 3 + 0]).toBe(0);
    expect(streamMask[0 * 3 + 1]).toBe(0);
  });
});
