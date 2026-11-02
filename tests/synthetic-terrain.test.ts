import { describe, expect, it } from 'vitest';
import { createSyntheticTerrain } from '../src/lib/geospatial/synthetic-terrain';

describe('SyntheticTerrain Generator', () => {
  it('generates a synthetic mountain with peak at center', () => {
    const width = 11;
    const height = 11;
    const terrain = createSyntheticTerrain({
      width,
      height,
      type: 'mountain',
      baseElevation: 200,
      peakElevation: 2000,
    });

    const stats = terrain.getStats();
    expect(stats.min).toBeGreaterThanOrEqual(200);
    expect(stats.max).toBeLessThanOrEqual(2100);

    // Center cell (5, 5) should be near peak elevation
    const centerElev = terrain.getElevation(5, 5)!;
    expect(centerElev).toBeGreaterThan(1800);

    // Corner cell should be near base elevation
    const cornerElev = terrain.getElevation(0, 0)!;
    expect(cornerElev).toBeLessThan(centerElev);
  });

  it('generates terrain with a NoData perimeter border when requested', () => {
    const terrain = createSyntheticTerrain({
      width: 5,
      height: 5,
      type: 'plane',
      noDataBorder: true,
    });

    // Perimeter cells should be null
    expect(terrain.getElevation(0, 0)).toBeNull();
    expect(terrain.getElevation(2, 0)).toBeNull();
    expect(terrain.getElevation(4, 4)).toBeNull();

    // Interior cells should have valid elevations
    expect(terrain.getElevation(2, 2)).not.toBeNull();
    expect(terrain.getStats().noDataCount).toBe(16); // 5x5 perimeter = 16 cells
    expect(terrain.getStats().validCount).toBe(9); // 3x3 interior = 9 cells
  });

  it('generates an inclined plane with strictly increasing elevation', () => {
    const terrain = createSyntheticTerrain({
      width: 5,
      height: 5,
      type: 'plane',
      baseElevation: 100,
    });

    const e00 = terrain.getElevation(0, 0)!;
    const e44 = terrain.getElevation(4, 4)!;
    expect(e44).toBeGreaterThan(e00);
  });
});

