import * as THREE from 'three';
import {
  blendRgb,
  type BaseLayerType,
  type BlendMode,
  type OverlayLayerType,
} from '@/features/analysis/blending';
import type { ProfilePoint } from '@/features/analysis/profile';
import type { AnalysisLayerType } from '@/features/analysis/types';
import {
  evaluateAspectColor,
  evaluateHillshadeColor,
  evaluateSlopeColor,
} from '@/features/analysis/color-ramps';
import {
  evaluateD8FlowColor,
  evaluateFlowAccumulationColor,
  getDownstreamIndex,
  type D8Direction,
  type FlowPathPoint,
} from '@/features/hydrology';
import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { evaluateColorRamp, TOPOGRAPHIC_RAMP, type ColorStop } from './color-ramps';

export interface LayerBlendOptions {
  baseLayer?: BaseLayerType;
  baseLayerData?: Float32Array | null;
  overlayLayer?: OverlayLayerType;
  overlayLayerData?: Float32Array | null;
  overlayOpacity?: number;
  blendMode?: BlendMode;
  maxOverlayVal?: number;
}

export interface TerrainMeshOptions {
  /** Target maximum horizontal dimension in Three.js world units (default: 100) */
  worldSize?: number;
  /** Custom color ramp for elevation */
  colorRamp?: readonly ColorStop[];
  /** Wireframe mode */
  wireframe?: boolean;
  /** Active analysis layer for vertex coloring (legacy single layer) */
  layer?: AnalysisLayerType;
  /** Pre-calculated data array for active analysis layer */
  layerData?: Float32Array | null;
  /** Maximum value for scaling (e.g. maxLogAccum for flow accumulation) */
  maxLayerVal?: number;
  /** Binary mask (1 = in watershed, 0 = outside) for watershed highlight */
  watershedMask?: Uint8Array | null;
  /** Multi-layer blending options */
  blendOptions?: LayerBlendOptions;
}

export interface TerrainGeometryData {
  geometry: THREE.BufferGeometry;
  horizontalScale: number;
  elevationScale: number;
  baseElevation: number;
  minElevation: number;
  maxElevation: number;
  stepX: number;
  stepY: number;
  halfWidth: number;
  halfHeight: number;
}

/**
 * Computes RGB vertex color based on active analysis layer.
 */
function computeSingleLayerRgb(
  layer: AnalysisLayerType | BaseLayerType | OverlayLayerType,
  rawVal: number,
  idx: number,
  statsMin: number,
  elevationRange: number,
  colorRamp: readonly ColorStop[],
  layerData?: Float32Array | null,
  maxLayerVal = 1.0
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
  if (layer === 'd8-flow') {
    const val = layerData ? layerData[idx]! : 0;
    return evaluateD8FlowColor(val);
  }
  if (layer === 'flow-accumulation') {
    const logVal = layerData ? layerData[idx]! : 0;
    return evaluateFlowAccumulationColor(logVal, maxLayerVal);
  }
  return [0.5, 0.5, 0.5];
}

/**
 * Computes blended RGB vertex color based on base and overlay layers.
 */
export function getVertexRgb(
  layer: AnalysisLayerType,
  rawVal: number,
  idx: number,
  statsMin: number,
  elevationRange: number,
  colorRamp: readonly ColorStop[],
  layerData?: Float32Array | null,
  maxLayerVal = 1.0,
  blendOptions?: LayerBlendOptions
): [r: number, g: number, b: number] {
  if (!blendOptions || (!blendOptions.baseLayer && !blendOptions.overlayLayer)) {
    return computeSingleLayerRgb(
      layer,
      rawVal,
      idx,
      statsMin,
      elevationRange,
      colorRamp,
      layerData,
      maxLayerVal
    );
  }

  const baseLayer = blendOptions.baseLayer ?? 'elevation';
  const baseRgb = computeSingleLayerRgb(
    baseLayer,
    rawVal,
    idx,
    statsMin,
    elevationRange,
    colorRamp,
    blendOptions.baseLayerData
  );

  const overlayLayer = blendOptions.overlayLayer ?? 'none';
  const overlayOpacity = blendOptions.overlayOpacity ?? 0;
  if (overlayLayer === 'none' || overlayOpacity <= 0) {
    return baseRgb;
  }

  const overlayRgb = computeSingleLayerRgb(
    overlayLayer,
    rawVal,
    idx,
    statsMin,
    elevationRange,
    colorRamp,
    blendOptions.overlayLayerData,
    blendOptions.maxOverlayVal ?? 1.0
  );

  return blendRgb(
    baseRgb,
    overlayRgb,
    overlayOpacity,
    blendOptions.blendMode ?? 'normal'
  );
}

/**
 * In-place updates the vertex color buffer attribute without reallocating geometry.
 */
export function updateTerrainGeometryColors(
  geometry: THREE.BufferGeometry,
  grid: ElevationGrid,
  layer: AnalysisLayerType = 'elevation',
  layerData?: Float32Array | null,
  maxLayerVal = 1.0,
  watershedMask?: Uint8Array | null,
  colorRamp: readonly ColorStop[] = TOPOGRAPHIC_RAMP,
  blendOptions?: LayerBlendOptions
): void {
  const colorsAttr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!colorsAttr) return;

  const colors = colorsAttr.array as Float32Array;
  const width = grid.width;
  const height = grid.height;
  const stats = grid.getStats();
  const elevationRange = Math.max(stats.max - stats.min, 1);
  const hasWatershed = watershedMask && watershedMask.length === width * height;

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

      let rgb = getVertexRgb(
        layer,
        rawVal,
        idx,
        stats.min,
        elevationRange,
        colorRamp,
        layerData,
        maxLayerVal,
        blendOptions
      );

      // Apply watershed highlighting if active
      if (hasWatershed) {
        if (watershedMask[idx] === 1) {
          // Warm gold/amber highlight for cells in watershed
          rgb = [
            rgb[0] * 0.4 + 1.0 * 0.6,
            rgb[1] * 0.4 + 0.76 * 0.6,
            rgb[2] * 0.4 + 0.18 * 0.6,
          ];
        } else {
          // Dim terrain outside watershed
          rgb = [rgb[0] * 0.32, rgb[1] * 0.32, rgb[2] * 0.32];
        }
      }

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
        rgb = getVertexRgb(
          layer,
          rawVal,
          idx,
          stats.min,
          elevationRange,
          colorRamp,
          layerData,
          options.maxLayerVal,
          options.blendOptions
        );
        if (options.watershedMask && options.watershedMask.length === vertexCount) {
          if (options.watershedMask[idx] === 1) {
            rgb = [
              rgb[0] * 0.4 + 1.0 * 0.6,
              rgb[1] * 0.4 + 0.76 * 0.6,
              rgb[2] * 0.4 + 0.18 * 0.6,
            ];
          } else {
            rgb = [rgb[0] * 0.32, rgb[1] * 0.32, rgb[2] * 0.32];
          }
        }
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
    stepX,
    stepY,
    halfWidth,
    halfHeight,
  };
}

/**
 * Builds a THREE.BufferGeometry representing the 3D stream network polyline segments
 * draped over the terrain surface.
 */
export function buildStreamLinesGeometry(
  grid: ElevationGrid,
  flowDir: Uint8Array,
  flowAccum: Float32Array,
  threshold: number,
  geomData: TerrainGeometryData,
  yOffset = 0.35
): THREE.BufferGeometry | null {
  const { width, height } = grid;
  const { stepX, stepY, halfWidth, halfHeight, elevationScale, minElevation } = geomData;

  const segments: number[] = [];

  for (let r = 0; r < height; r++) {
    const rowOffset = r * width;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      const acc = flowAccum[idx];
      if (acc === undefined || Number.isNaN(acc) || acc < threshold) continue;

      const dir = flowDir[idx] as D8Direction;
      if (dir === 0) continue;

      const targetIdx = getDownstreamIndex(c, r, dir, width, height);
      if (targetIdx < 0) continue;

      const targetAcc = flowAccum[targetIdx];
      if (targetAcc === undefined || Number.isNaN(targetAcc) || targetAcc < threshold) continue;

      const tc = targetIdx % width;
      const tr = Math.floor(targetIdx / width);

      const x1 = (c - halfWidth) * stepX;
      const z1 = (r - halfHeight) * stepY;
      const y1 = (grid.data[idx]! - minElevation) * elevationScale + yOffset;

      const x2 = (tc - halfWidth) * stepX;
      const z2 = (tr - halfHeight) * stepY;
      const y2 = (grid.data[targetIdx]! - minElevation) * elevationScale + yOffset;

      segments.push(x1, y1, z1, x2, y2, z2);
    }
  }

  if (segments.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  return geometry;
}

/**
 * Builds a THREE.BufferGeometry representing a traced downstream flow path.
 */
export function buildFlowPathGeometry(
  _grid: ElevationGrid,
  path: readonly FlowPathPoint[],
  geomData: TerrainGeometryData,
  yOffset = 0.6
): THREE.BufferGeometry | null {
  if (path.length < 2) return null;

  const { stepX, stepY, halfWidth, halfHeight, elevationScale, minElevation } = geomData;
  const positions = new Float32Array(path.length * 3);

  for (let i = 0; i < path.length; i++) {
    const pt = path[i]!;
    const x = (pt.col - halfWidth) * stepX;
    const z = (pt.row - halfHeight) * stepY;
    const y = (pt.elevation - minElevation) * elevationScale + yOffset;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Converts raster (col, row) coordinates to local 3D mesh space.
 */
export function gridCoordToWorld(
  col: number,
  row: number,
  elevation: number,
  geomData: TerrainGeometryData,
  yOffset = 0.5
): [x: number, y: number, z: number] {
  const { stepX, stepY, halfWidth, halfHeight, elevationScale, minElevation } = geomData;
  const x = (col - halfWidth) * stepX;
  const z = (row - halfHeight) * stepY;
  const y = (elevation - minElevation) * elevationScale + yOffset;
  return [x, y, z];
}

/**
 * Converts local 3D mesh coordinates (x, z) to raster (col, row).
 */
export function worldToGridCoord(
  x: number,
  z: number,
  grid: ElevationGrid,
  geomData: TerrainGeometryData
): { col: number; row: number } {
  const { stepX, stepY, halfWidth, halfHeight } = geomData;
  const col = Math.round(x / stepX + halfWidth);
  const row = Math.round(z / stepY + halfHeight);

  return {
    col: Math.max(0, Math.min(grid.width - 1, col)),
    row: Math.max(0, Math.min(grid.height - 1, row)),
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

/**
 * Builds a THREE.BufferGeometry representing the 3D draped elevation profile transect line.
 */
export function buildProfileTransectGeometry(
  points: readonly ProfilePoint[],
  geomData: TerrainGeometryData,
  yOffset = 0.55
): THREE.BufferGeometry | null {
  if (points.length < 2) return null;

  const { stepX, stepY, halfWidth, halfHeight, elevationScale, minElevation } = geomData;
  const positions: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]!;
    if (pt.elevation === null) continue;

    const x = (pt.col - halfWidth) * stepX;
    const z = (pt.row - halfHeight) * stepY;
    const y = (pt.elevation - minElevation) * elevationScale + yOffset;

    positions.push(x, y, z);
  }

  if (positions.length < 6) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

