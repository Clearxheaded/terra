import { describe, expect, it } from 'vitest';
import {
  calculateAspect,
  calculateHillshade,
  calculateSlope,
  computeCellDerivatives,
  FLAT_ASPECT_SENTINEL,
  getMetricPixelSpacing,
} from '@/features/analysis';
import { ElevationGrid } from '@/lib/geospatial/elevation-grid';

function createGridWithElevation(
  width: number,
  height: number,
  elevationFn: (col: number, row: number) => number,
  pixelSize = 10,
  noDataValue: number | null = -9999
): ElevationGrid {
  const data = new Float32Array(width * height);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      data[r * width + c] = elevationFn(c, r);
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

describe('Terrain Analysis — Mathematical Correctness', () => {
  describe('Cell Spacing & CRS Metric Conversion', () => {
    it('uses direct pixel sizes for projected metric CRS', () => {
      const grid = createGridWithElevation(5, 5, () => 100, 25);
      const { dx, dy } = getMetricPixelSpacing(grid);
      expect(dx).toBeCloseTo(25, 4);
      expect(dy).toBeCloseTo(25, 4);
    });

    it('converts geographic degree coordinates to metric meters', () => {
      const data = new Float32Array(4).fill(100);
      const degreeGrid = new ElevationGrid({
        width: 2,
        height: 2,
        data,
        transform: [0, 0.001, 0, 0, 0, -0.001],
        crs: { unit: 'degree' },
      });

      const { dx, dy } = getMetricPixelSpacing(degreeGrid);
      // 0.001 deg * 111,320m/deg = 111.32m
      expect(dx).toBeCloseTo(111.32, 2);
      expect(dy).toBeCloseTo(111.32, 2);
    });
  });

  describe('Slope (Horn 3x3 Algorithm)', () => {
    it('calculates zero slope on a perfectly flat surface', () => {
      const grid = createGridWithElevation(5, 5, () => 250);
      const result = calculateSlope(grid, 'degrees');

      expect(result.validCount).toBe(25);
      expect(result.min).toBeCloseTo(0, 4);
      expect(result.max).toBeCloseTo(0, 4);
      expect(result.mean).toBeCloseTo(0, 4);
    });

    it('calculates exact 45° slope on a plane with 1:1 rise/run', () => {
      // dx = 10m, dy = 10m. Rise is 10m per column (c * 10)
      const grid = createGridWithElevation(7, 7, (c) => c * 10, 10);
      const resultDeg = calculateSlope(grid, 'degrees');
      const resultPct = calculateSlope(grid, 'percent');

      // Interior cell (col=3, row=3)
      const centerIdx = 3 * 7 + 3;
      expect(resultDeg.data[centerIdx]).toBeCloseTo(45.0, 3);
      expect(resultPct.data[centerIdx]).toBeCloseTo(100.0, 3);
    });

    it('calculates exact 30° slope with trigonometric precision', () => {
      const angleDeg = 30;
      const angleRad = (angleDeg * Math.PI) / 180;
      const risePerMeter = Math.tan(angleRad); // ~0.57735

      const pixelSize = 10;
      const grid = createGridWithElevation(7, 7, (c) => c * pixelSize * risePerMeter, pixelSize);
      const result = calculateSlope(grid, 'degrees');

      const centerIdx = 3 * 7 + 3;
      expect(result.data[centerIdx]).toBeCloseTo(30.0, 3);
    });

    it('correctly scales with custom vertical zFactor', () => {
      const grid = createGridWithElevation(5, 5, (c) => c * 10, 10);
      // With zFactor = 2.0, effective rise/run is 2.0, slope = atan(2.0) rad = 63.435°
      const result = calculateSlope(grid, 'degrees', 2.0);

      const centerIdx = 2 * 5 + 2;
      expect(result.data[centerIdx]).toBeCloseTo((Math.atan(2.0) * 180) / Math.PI, 3);
    });
  });

  describe('Aspect (Directional Compass Azimuth)', () => {
    const pixelSize = 10;

    it('identifies flat terrain with FLAT_ASPECT_SENTINEL (-1)', () => {
      const grid = createGridWithElevation(5, 5, () => 150, pixelSize);
      const result = calculateAspect(grid);

      expect(result.flatCount).toBe(25);
      expect(result.dominantDirection).toBe('Flat Terrain');
      expect(result.circularMean).toBeNull();
      expect(result.data[12]).toBe(FLAT_ASPECT_SENTINEL);
    });

    it('calculates North-facing aspect (0°) on a plane sloping down to the North', () => {
      // Row 0 is North, row H-1 is South.
      // Plane slopes down to North when elevation increases as row increases (South is high, North is low)
      const grid = createGridWithElevation(5, 5, (_c, r) => r * 10, pixelSize);
      const result = calculateAspect(grid);

      const centerIdx = 2 * 5 + 2;
      expect(result.data[centerIdx]).toBeCloseTo(0.0, 2);
      expect(result.dominantDirection).toBe('North');
    });

    it('calculates East-facing aspect (90°) on a plane sloping down to the East', () => {
      // West (col 0) is high, East (col W-1) is low -> elevation decreases as col increases
      const grid = createGridWithElevation(5, 5, (c) => -c * 10, pixelSize);
      const result = calculateAspect(grid);

      const centerIdx = 2 * 5 + 2;
      expect(result.data[centerIdx]).toBeCloseTo(90.0, 2);
      expect(result.dominantDirection).toBe('East');
    });

    it('calculates South-facing aspect (180°) on a plane sloping down to the South', () => {
      // North (row 0) is high, South (row H-1) is low -> elevation decreases as row increases
      const grid = createGridWithElevation(5, 5, (_c, r) => -r * 10, pixelSize);
      const result = calculateAspect(grid);

      const centerIdx = 2 * 5 + 2;
      expect(result.data[centerIdx]).toBeCloseTo(180.0, 2);
      expect(result.dominantDirection).toBe('South');
    });

    it('calculates West-facing aspect (270°) on a plane sloping down to the West', () => {
      // East (col W-1) is high, West (col 0) is low -> elevation increases as col increases
      const grid = createGridWithElevation(5, 5, (c) => c * 10, pixelSize);
      const result = calculateAspect(grid);

      const centerIdx = 2 * 5 + 2;
      expect(result.data[centerIdx]).toBeCloseTo(270.0, 2);
      expect(result.dominantDirection).toBe('West');
    });

    it('calculates North-West aspect (315°) on a diagonal slope', () => {
      // Downhill toward North (r * 10) and toward West (c * 10)
      const grid = createGridWithElevation(5, 5, (c, r) => c * 10 + r * 10, pixelSize);
      const result = calculateAspect(grid);

      const centerIdx = 2 * 5 + 2;
      expect(result.data[centerIdx]).toBeCloseTo(315.0, 2);
      expect(result.dominantDirection).toBe('North-West');
    });
  });

  describe('Hillshade (Analytical Shaded Relief)', () => {
    it('produces expected Lambertian illumination for flat terrain at 45° altitude', () => {
      const grid = createGridWithElevation(5, 5, () => 200, 10);
      const result = calculateHillshade(grid, { azimuth: 315, altitude: 45 });

      // On flat terrain, normal is (0, 0, 1). Cos(incidence) = sin(45°) = 0.707106.
      // Hillshade = 0.707106 * 255 = 180.31
      const expected = Math.sin((45 * Math.PI) / 180) * 255;
      expect(result.mean).toBeCloseTo(expected, 1);
    });

    it('produces maximum illumination (255) when sun is directly overhead (90° altitude)', () => {
      const grid = createGridWithElevation(5, 5, () => 200, 10);
      const result = calculateHillshade(grid, { azimuth: 315, altitude: 90 });

      expect(result.min).toBeCloseTo(255, 1);
      expect(result.max).toBeCloseTo(255, 1);
    });

    it('produces complete shadow (0) when sun is below horizon or terrain faces away', () => {
      // Slope tilted sharply to the South (slopes down South, faces South at 45°)
      // Sun shining from direct North (azimuth 0°) at low altitude (15°)
      const grid = createGridWithElevation(5, 5, (_c, r) => -r * 10, 10);
      const result = calculateHillshade(grid, { azimuth: 0, altitude: 15 });

      // The south-facing slope is in shadow from a northern light source
      const centerIdx = 2 * 5 + 2;
      expect(result.data[centerIdx]).toBe(0);
    });

    it('produces maximum brightness (255) when surface normal aligns with sun direction', () => {
      // Sun at azimuth 270° (West), altitude 45°
      // Terrain slopes down to the West at 45° (rises to East: c * 10, dx = 10)
      const grid = createGridWithElevation(5, 5, (c) => c * 10, 10);
      const result = calculateHillshade(grid, { azimuth: 270, altitude: 45 });

      const centerIdx = 2 * 5 + 2;
      expect(result.data[centerIdx]).toBeCloseTo(255, 1);
    });
  });

  describe('Boundary Handling & NoData Robustness', () => {
    it('computes valid finite derivatives at all border cells without crashing', () => {
      const grid = createGridWithElevation(4, 4, (c, r) => c * 10 + r * 5, 10);

      // Check all 16 cells including corners
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const deriv = computeCellDerivatives(grid, c, r, 10, 10);
          expect(deriv).not.toBeNull();
          expect(Number.isFinite(deriv!.dzdx)).toBe(true);
          expect(Number.isFinite(deriv!.dzdy)).toBe(true);
        }
      }
    });

    it('outputs NaN when the center cell is NoData', () => {
      const noDataSentinel = -9999;
      const grid = createGridWithElevation(
        5,
        5,
        (c, r) => (c === 2 && r === 2 ? noDataSentinel : 100),
        10,
        noDataSentinel
      );

      const slope = calculateSlope(grid);
      const aspect = calculateAspect(grid);
      const hillshade = calculateHillshade(grid);

      const centerIdx = 2 * 5 + 2;
      expect(Number.isNaN(slope.data[centerIdx])).toBe(true);
      expect(Number.isNaN(aspect.data[centerIdx])).toBe(true);
      expect(Number.isNaN(hillshade.data[centerIdx])).toBe(true);

      // Other 24 cells should be valid
      expect(slope.validCount).toBe(24);
      expect(aspect.validCount).toBe(24);
      expect(hillshade.validCount).toBe(24);
    });

    it('gracefully handles neighboring NoData cells without creating extreme artificial slope spikes', () => {
      const noDataSentinel = -9999;
      // Flat terrain at 100m, but top-left cell (0, 0) is NoData
      const grid = createGridWithElevation(
        5,
        5,
        (c, r) => (c === 0 && r === 0 ? noDataSentinel : 100),
        10,
        noDataSentinel
      );

      // Cell (1, 1) is diagonal neighbor to (0, 0)
      const slope = calculateSlope(grid, 'degrees');
      const idx = 1 * 5 + 1;

      // Because NoData neighbors are substituted with center cell value (100m),
      // the calculated slope remains 0° instead of exploding to thousands of degrees!
      expect(slope.data[idx]).toBeCloseTo(0, 3);
    });
  });
});

