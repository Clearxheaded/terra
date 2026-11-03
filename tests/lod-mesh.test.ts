import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildTerrainGeometry,
  updateTerrainGeometryColors,
} from '@/features/terrain/terrain-mesh';
import { createSyntheticTerrain } from '@/lib/geospatial/synthetic-terrain';

describe('Adaptive Geometry & Level-of-Detail (LOD)', () => {
  it('builds full 1:1 geometry when lodStride is 1', () => {
    const grid = createSyntheticTerrain({
      width: 50,
      height: 50,
      type: 'pyramid',
    });

    const geomData = buildTerrainGeometry(grid, { lodStride: 1 });
    expect(geomData.lodStride).toBe(1);
    expect(geomData.meshWidth).toBe(50);
    expect(geomData.meshHeight).toBe(50);
    expect(geomData.vertexCount).toBe(2500);

    const posAttr = geomData.geometry.getAttribute('position');
    expect(posAttr.count).toBe(2500);

    const indexAttr = geomData.geometry.getIndex();
    expect(indexAttr).toBeDefined();
    expect(indexAttr?.count).toBe(49 * 49 * 6);
  });

  it('subsamples geometry cleanly when lodStride > 1', () => {
    const grid = createSyntheticTerrain({
      width: 101,
      height: 101,
      type: 'pyramid',
    });

    const stride = 2;
    const geomData = buildTerrainGeometry(grid, { lodStride: stride });

    // With stride 2 on 101 cells: ceil(100 / 2) + 1 = 51
    expect(geomData.lodStride).toBe(2);
    expect(geomData.meshWidth).toBe(51);
    expect(geomData.meshHeight).toBe(51);
    expect(geomData.vertexCount).toBe(51 * 51);

    const posAttr = geomData.geometry.getAttribute('position');
    expect(posAttr.count).toBe(2601);

    const indexAttr = geomData.geometry.getIndex();
    expect(indexAttr?.count).toBe(50 * 50 * 6);

    // Verify UV extents span full 0 to 1
    const uvAttr = geomData.geometry.getAttribute('uv');
    expect(uvAttr.getX(0)).toBe(0); // top-left
    expect(uvAttr.getY(0)).toBe(1);
    expect(uvAttr.getX(geomData.vertexCount - 1)).toBe(1); // bottom-right
    expect(uvAttr.getY(geomData.vertexCount - 1)).toBe(0);
  });

  it('automatically calculates LOD stride when total cells exceed maxVertices', () => {
    const grid = createSyntheticTerrain({
      width: 100,
      height: 100,
      type: 'mountain',
    });

    // Request budget of max 2000 vertices:
    // 10,000 / 2,000 = 5 -> sqrt(5) ~ 2.23 -> ceil is 3
    const geomData = buildTerrainGeometry(grid, { maxVertices: 2000 });
    expect(geomData.lodStride).toBeGreaterThanOrEqual(2);
    expect(geomData.vertexCount).toBeLessThanOrEqual(2500);
  });

  it('in-place updates colors on downsampled LOD geometry without memory reallocation', () => {
    const grid = createSyntheticTerrain({
      width: 51,
      height: 51,
      type: 'mountain',
    });

    const geomData = buildTerrainGeometry(grid, { lodStride: 2 });
    const colorsAttr = geomData.geometry.getAttribute('color') as THREE.BufferAttribute;
    const origBuffer = colorsAttr.array;
    const initialVersion = colorsAttr.version;

    // In-place update
    updateTerrainGeometryColors(
      geomData.geometry,
      grid,
      'elevation',
      null,
      1.0,
      null,
      undefined,
      undefined,
      geomData.lodStride
    );

    // Attribute buffer identity should be preserved (zero allocation)
    expect(colorsAttr.array).toBe(origBuffer);
    expect(colorsAttr.version).toBeGreaterThan(initialVersion);
  });
});
