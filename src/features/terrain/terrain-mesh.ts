import * as THREE from 'three';
import type { AnalysisLayerType } from '@/features/analysis/types';
import {
  evaluateAspectColor,
  evaluateHillshadeColor,
  evaluateSlopeColor,
} from '@/features/analysis/color-ramps';
import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { evaluateColorRamp, TOPOGRAPHIC_RAMP, type ColorStop } from './color-ramps';

export interface TerrainMeshOptions {
  /** Target maximum horizontal dimension in Three.js world units (default: 100) */
  worldSize?: number;
  /** Custom color ramp for elevation */
  colorRamp?: readonly ColorStop[];
  /** Wireframe mode */
  wireframe?: boolean;
  /** Active analysis layer for vertex coloring */
  layer?: AnalysisLayerType;
  /** Pre-calculated data array for active analysis layer */
  layerData?: Float32Array | null;
}

export interface TerrainGeometryData {
  geometry: THREE.BufferGeometry;
  horizontalScale: number;
  elevationScale: number;
  baseElevation: number;
  minElevation: number;
  maxElevation: number;
}

/**
 * Computes RGB vertex color based on active analysis layer.
 */
function getVertexRgb(
  layer: AnalysisLayerType,
  rawVal: number,
  idx: number,
  statsMin: number,
  elevationRange: number,
  colorRamp: readonly ColorStop[],
  layerData?: Float32Array | null
): [r: number, g: number, b: number] {
  if (layer === 'elevation') {
    const normalizedElev = (rawVal - statsMin) / elevationRange;
    return evaluateColorRamp(normalizedElev, colorRamp);
  }
  if (layer === 'slope') {
    const val = layerData ? layerData[idx]! : 0;
    return evaluateSlopeColor(val);
  }
  if (layer === 'aspect') {
    const val = layerData ? layerData[idx]! : -1;
    return evaluateAspectColor(val);
  }
  if (layer === 'hillshade') {
    const val = layerData ? layerData[idx]! : 180;
    return evaluateHillshadeColor(val);
  }
  return [0.5, 0.5, 0.5];
}

/**
 * In-place updates the vertex color buffer attribute without reallocating geometry.
 */
export function updateTerrainGeometryColors(
  geometry: THREE.BufferGeometry,
  grid: ElevationGrid,
  layer: AnalysisLayerType = 'elevation',
  layerData?: Float32Array | null,
  colorRamp: readonly ColorStop[] = TOPOGRAPHIC_RAMP
): void {
  const colorsAttr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!colorsAttr) return;

  const colors = colorsAttr.array as Float32Array;
  const width = grid.width;
  const height = grid.height;
  const stats = grid.getStats();
  const elevationRange = Math.max(stats.max - stats.min, 1);

  for (let r = 0; r < height; r++) {
    const rowOffset = r * width;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      const attrOffset3 = idx * 3;
      const rawVal = grid.data[idx]!;

      if (grid.isNoData(rawVal)) {
        colors[attrOffset3] = 0.12;
        colors[attrOffset3 + 1] = 0.14;
        colors[attrOffset3 + 2] = 0.17;
        continue;
      }

      const rgb = getVertexRgb(layer, rawVal, idx, stats.min, elevationRange, colorRamp, layerData);
      colors[attrOffset3] = rgb[0];
      colors[attrOffset3 + 1] = rgb[1];
      colors[attrOffset3 + 2] = rgb[2];
    }
  }

  colorsAttr.needsUpdate = true;
}

/**
 * Builds a THREE.BufferGeometry from an ElevationGrid with vertex positions,
 * normals, UV coordinates, and analysis-aware vertex colors.
 */
export function buildTerrainGeometry(
  grid: ElevationGrid,
  options: TerrainMeshOptions = {}
): TerrainGeometryData {
  const {
    worldSize = 100,
    colorRamp = TOPOGRAPHIC_RAMP,
    layer = 'elevation',
    layerData = null,
  } = options;

  const width = grid.width;
  const height = grid.height;
  const stats = grid.getStats();

  // Unit conversion factor if coordinates are in degrees
  let unitToMeters = 1.0;
  if (grid.crs.unit === 'degree') {
    // Approximate 1 deg latitude/longitude ~ 111,320m
    unitToMeters = 111320;
  }

  const realPixelWidth = grid.pixelSizeX * unitToMeters;
  const realPixelHeight = grid.pixelSizeY * unitToMeters;

  const realSpanX = Math.max((width - 1) * realPixelWidth, 1);
  const realSpanY = Math.max((height - 1) * realPixelHeight, 1);
  const maxRealSpan = Math.max(realSpanX, realSpanY);

  const horizontalScale = worldSize / maxRealSpan;
  // Elevation scale matches horizontal scale so 1m elevation = 1m horizontal at 1x exaggeration
  const elevationScale = horizontalScale;

  const elevationRange = Math.max(stats.max - stats.min, 1);
  const vertexCount = width * height;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  const halfWidth = (width - 1) / 2;
  const halfHeight = (height - 1) / 2;
  const stepX = realPixelWidth * horizontalScale;
  const stepY = realPixelHeight * horizontalScale;

  // Fill vertex attributes
  for (let r = 0; r < height; r++) {
    // r=0 is North (-Z), r=height-1 is South (+Z)
    const z = (r - halfHeight) * stepY;
    const rowOffset = r * width;

    for (let c = 0; c < width; c++) {
      // c=0 is West (-X), c=width-1 is East (+X)
      const x = (c - halfWidth) * stepX;
      const idx = rowOffset + c;
      const attrOffset3 = idx * 3;
      const attrOffset2 = idx * 2;

      const rawVal = grid.data[idx]!;
      const isVoid = grid.isNoData(rawVal);

      let y = 0;
      let rgb: [number, number, number];

      if (isVoid) {
        y = 0;
        rgb = [0.12, 0.14, 0.17]; // Dim slate for void / NoData
      } else {
        y = (rawVal - stats.min) * elevationScale;
        rgb = getVertexRgb(layer, rawVal, idx, stats.min, elevationRange, colorRamp, layerData);
      }

      positions[attrOffset3] = x;
      positions[attrOffset3 + 1] = y;
      positions[attrOffset3 + 2] = z;

      colors[attrOffset3] = rgb[0];
      colors[attrOffset3 + 1] = rgb[1];
      colors[attrOffset3 + 2] = rgb[2];

      uvs[attrOffset2] = c / Math.max(width - 1, 1);
      uvs[attrOffset2 + 1] = 1 - r / Math.max(height - 1, 1);
    }
  }

  // Generate triangle quad indices
  const quadCount = (width - 1) * (height - 1);
  const indexCount = quadCount * 6;
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  let ptr = 0;
  for (let r = 0; r < height - 1; r++) {
    for (let c = 0; c < width - 1; c++) {
      const tl = r * width + c;
      const tr = tl + 1;
      const bl = (r + 1) * width + c;
      const br = bl + 1;

      // Triangle 1: TL -> BL -> TR (upward normal +Y)
      indices[ptr++] = tl;
      indices[ptr++] = bl;
      indices[ptr++] = tr;

      // Triangle 2: TR -> BL -> BR (upward normal +Y)
      indices[ptr++] = tr;
      indices[ptr++] = bl;
      indices[ptr++] = br;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return {
    geometry,
    horizontalScale,
    elevationScale,
    baseElevation: stats.min,
    minElevation: stats.min,
    maxElevation: stats.max,
  };
}

/**
 * Creates a mesh from the terrain geometry with standard material.
 */
export function createTerrainMesh(
  geometry: THREE.BufferGeometry,
  options: { wireframe?: boolean } = {}
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.1,
    flatShading: false,
    wireframe: options.wireframe ?? false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
