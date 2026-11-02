import { describe, expect, it } from 'vitest';
import { ElevationGrid } from '../src/lib/geospatial/elevation-grid';
import { buildTerrainGeometry, createTerrainMesh } from '../src/features/terrain/terrain-mesh';
import { evaluateColorRamp, TOPOGRAPHIC_RAMP } from '../src/features/terrain/color-ramps';

describe('TerrainMesh and ColorRamps', () => {
  it('interpolates color stops accurately along the color ramp', () => {
    // 0.0 stop
    const c0 = evaluateColorRamp(0.0, TOPOGRAPHIC_RAMP);
    expect(c0[0]).toBeCloseTo(0.18, 2);
    expect(c0[1]).toBeCloseTo(0.35, 2);
    expect(c0[2]).toBeCloseTo(0.22, 2);

    // 1.0 stop
    const c1 = evaluateColorRamp(1.0, TOPOGRAPHIC_RAMP);
    expect(c1[0]).toBeCloseTo(0.96, 2);
    expect(c1[1]).toBeCloseTo(0.97, 2);
    expect(c1[2]).toBeCloseTo(1.0, 2);

    // Midpoint between 0.0 and 0.15
    const mid = evaluateColorRamp(0.075, TOPOGRAPHIC_RAMP);
    expect(mid[0]).toBeGreaterThan(0.18);
    expect(mid[0]).toBeLessThan(0.35);
  });

  it('generates Three.js BufferGeometry with correct dimensions and vertex attributes', () => {
    const width = 4;
    const height = 3;
    const data = new Float32Array([
      100, 150, 200, 250,
      120, 180, 220, 280,
      140, 210, 260, 310,
    ]);

    const grid = new ElevationGrid({
      width,
      height,
      data,
      transform: [0, 10, 0, 0, 0, -10],
    });

    const { geometry, horizontalScale, minElevation, maxElevation } = buildTerrainGeometry(grid, {
      worldSize: 100,
    });

    expect(minElevation).toBe(100);
    expect(maxElevation).toBe(310);
    expect(horizontalScale).toBeGreaterThan(0);

    const posAttr = geometry.getAttribute('position');
    const colorAttr = geometry.getAttribute('color');
    const uvAttr = geometry.getAttribute('uv');
    const normalAttr = geometry.getAttribute('normal');
    const indexAttr = geometry.getIndex();

    expect(posAttr).toBeDefined();
    expect(colorAttr).toBeDefined();
    expect(uvAttr).toBeDefined();
    expect(normalAttr).toBeDefined();
    expect(indexAttr).toBeDefined();

    // Total vertices = width * height = 12
    expect(posAttr.count).toBe(12);
    expect(colorAttr.count).toBe(12);
    expect(uvAttr.count).toBe(12);

    // Total indices = (width - 1) * (height - 1) * 6 = 3 * 2 * 6 = 36
    expect(indexAttr?.count).toBe(36);

    // Check vertex positions centering:
    // Top-left vertex (c=0, r=0) should have negative X and negative Z
    const x0 = posAttr.getX(0);
    const z0 = posAttr.getZ(0);
    expect(x0).toBeLessThan(0);
    expect(z0).toBeLessThan(0);

    // Bottom-right vertex (c=3, r=2) should have positive X and positive Z
    const xEnd = posAttr.getX(11);
    const zEnd = posAttr.getZ(11);
    expect(xEnd).toBeGreaterThan(0);
    expect(zEnd).toBeGreaterThan(0);

    // Center symmetry
    expect(x0 + xEnd).toBeCloseTo(0, 4);
    expect(z0 + zEnd).toBeCloseTo(0, 4);
  });

  it('computes upward-pointing surface normals', () => {
    // Flat plane: all elevations 500m
    const width = 3;
    const height = 3;
    const data = new Float32Array(9).fill(500);

    const grid = new ElevationGrid({
      width,
      height,
      data,
    });

    const { geometry } = buildTerrainGeometry(grid);
    const normalAttr = geometry.getAttribute('normal');

    for (let i = 0; i < normalAttr.count; i++) {
      const ny = normalAttr.getY(i);
      // Flat plane normals must point directly upwards (+Y)
      expect(ny).toBeCloseTo(1.0, 4);
    }
  });

  it('assigns void fallback colors to NoData vertices', () => {
    const width = 2;
    const height = 2;
    const data = new Float32Array([100, -9999, 200, 300]);

    const grid = new ElevationGrid({
      width,
      height,
      data,
      noDataValue: -9999,
    });

    const { geometry } = buildTerrainGeometry(grid);
    const posAttr = geometry.getAttribute('position');
    const colorAttr = geometry.getAttribute('color');

    // Index 1 is the NoData cell (c=1, r=0)
    expect(posAttr.getY(1)).toBe(0); // Y set to base/0
    expect(colorAttr.getX(1)).toBeCloseTo(0.12, 2); // Dark slate red channel
  });

  it('creates a THREE.Mesh with standard material', () => {
    const grid = new ElevationGrid({
      width: 2,
      height: 2,
      data: new Float32Array([10, 20, 30, 40]),
    });
    const { geometry } = buildTerrainGeometry(grid);
    const mesh = createTerrainMesh(geometry, { wireframe: true });

    expect(mesh).toBeDefined();
    expect(mesh.isMesh).toBe(true);
  });
});

