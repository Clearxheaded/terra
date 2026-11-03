import { getDownstreamIndex, type D8Direction } from '@/features/hydrology';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { downloadFile } from './download';

export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: GeoJSONGeometry;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  name?: string;
  crs?: {
    type: string;
    properties: { name: string };
  };
  features: GeoJSONFeature[];
}

/**
 * Exports extracted drainage stream network channels as standard GeoJSON LineString features.
 */
export function exportStreamsToGeoJSON(
  grid: ElevationGrid,
  flowDir: Uint8Array,
  flowAccum: Float32Array,
  threshold: number
): GeoJSONFeatureCollection {
  const { width, height } = grid;
  const features: GeoJSONFeature[] = [];

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

      const [x1, y1] = grid.gridToGeo(c, r, true);
      const [x2, y2] = grid.gridToGeo(tc, tr, true);

      const elev1 = grid.getElevation(c, r);
      const elev2 = grid.getElevation(tc, tr);

      features.push({
        type: 'Feature',
        properties: {
          id: `reach_${c}_${r}`,
          sourceCol: c,
          sourceRow: r,
          targetCol: tc,
          targetRow: tr,
          flowAccumulation: acc,
          elevationStart: elev1,
          elevationEnd: elev2,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [Number(x1.toFixed(6)), Number(y1.toFixed(6))],
            [Number(x2.toFixed(6)), Number(y2.toFixed(6))],
          ],
        },
      });
    }
  }

  const crsName = grid.crs.code
    ? `urn:ogc:def:crs:EPSG::${grid.crs.code}`
    : 'urn:ogc:def:crs:OGC:1.3:CRS84';

  return {
    type: 'FeatureCollection',
    name: 'Terra Stream Network',
    crs: {
      type: 'name',
      properties: { name: crsName },
    },
    features,
  };
}

/**
 * Traces outer boundary grid edges of a watershed mask and stitches them
 * into closed polygonal rings.
 */
function traceWatershedRings(
  grid: ElevationGrid,
  watershedMask: Uint8Array
): Array<Array<[number, number]>> {
  const { width, height } = grid;
  type Edge = { from: string; to: string; x1: number; y1: number; x2: number; y2: number };

  const edgesMap = new Map<string, Edge[]>();

  const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const fromKey = `${x1},${y1}`;
    const toKey = `${x2},${y2}`;
    const edge: Edge = { from: fromKey, to: toKey, x1, y1, x2, y2 };
    if (!edgesMap.has(fromKey)) {
      edgesMap.set(fromKey, []);
    }
    edgesMap.get(fromKey)!.push(edge);
  };

  // Check each cell in the mask
  for (let r = 0; r < height; r++) {
    const rowOffset = r * width;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      if (watershedMask[idx] !== 1) continue;

      // North edge: (c, r) -> (c+1, r)
      if (r === 0 || watershedMask[(r - 1) * width + c] !== 1) {
        addEdge(c, r, c + 1, r);
      }
      // East edge: (c+1, r) -> (c+1, r+1)
      if (c === width - 1 || watershedMask[rowOffset + c + 1] !== 1) {
        addEdge(c + 1, r, c + 1, r + 1);
      }
      // South edge: (c+1, r+1) -> (c, r+1)
      if (r === height - 1 || watershedMask[(r + 1) * width + c] !== 1) {
        addEdge(c + 1, r + 1, c, r + 1);
      }
      // West edge: (c, r+1) -> (c, r)
      if (c === 0 || watershedMask[rowOffset + c - 1] !== 1) {
        addEdge(c, r + 1, c, r);
      }
    }
  }

  // Stitch edges into closed loops
  const rings: Array<Array<[number, number]>> = [];
  const visitedEdges = new Set<Edge>();

  for (const [, edgeList] of edgesMap) {
    for (const startEdge of edgeList) {
      if (visitedEdges.has(startEdge)) continue;

      const ring: Array<[number, number]> = [];
      let currentEdge: Edge | null = startEdge;

      while (currentEdge && !visitedEdges.has(currentEdge)) {
        visitedEdges.add(currentEdge);

        // Convert grid corner coordinates to map coordinates
        const [geoX, geoY] = grid.gridToGeo(currentEdge.x1, currentEdge.y1, false);
        ring.push([Number(geoX.toFixed(6)), Number(geoY.toFixed(6))]);

        const nextKey = currentEdge.to;
        const candidates = edgesMap.get(nextKey);
        currentEdge = null;

        if (candidates) {
          for (const cand of candidates) {
            if (!visitedEdges.has(cand)) {
              currentEdge = cand;
              break;
            }
          }
        }
      }

      // Close the ring if it looped back to start
      if (ring.length >= 3) {
        ring.push([...ring[0]!]); // Close polygon
        rings.push(ring);
      }
    }
  }

  return rings;
}

/**
 * Exports a delineated watershed basin mask as standard GeoJSON Polygon / MultiPolygon features.
 */
export function exportWatershedToGeoJSON(
  grid: ElevationGrid,
  watershedMask: Uint8Array,
  pourPoint: { col: number; row: number },
  areaKm2 = 0
): GeoJSONFeatureCollection {
  const rings = traceWatershedRings(grid, watershedMask);
  const [pourGeoX, pourGeoY] = grid.gridToGeo(pourPoint.col, pourPoint.row, true);

  const features: GeoJSONFeature[] = [];

  let cellCount = 0;
  for (let i = 0; i < watershedMask.length; i++) {
    if (watershedMask[i] === 1) cellCount++;
  }

  if (rings.length === 1) {
    features.push({
      type: 'Feature',
      properties: {
        name: 'Delineated Watershed Basin',
        pourPoint: {
          col: pourPoint.col,
          row: pourPoint.row,
          geoX: Number(pourGeoX.toFixed(6)),
          geoY: Number(pourGeoY.toFixed(6)),
        },
        cellCount,
        areaKm2: Number(areaKm2.toFixed(4)),
      },
      geometry: {
        type: 'Polygon',
        coordinates: rings,
      },
    });
  } else if (rings.length > 1) {
    // MultiPolygon
    features.push({
      type: 'Feature',
      properties: {
        name: 'Delineated Watershed Basin (Multi-part)',
        pourPoint: {
          col: pourPoint.col,
          row: pourPoint.row,
          geoX: Number(pourGeoX.toFixed(6)),
          geoY: Number(pourGeoY.toFixed(6)),
        },
        cellCount,
        areaKm2: Number(areaKm2.toFixed(4)),
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: rings.map((r) => [r]),
      },
    });
  }

  const crsName = grid.crs.code
    ? `urn:ogc:def:crs:EPSG::${grid.crs.code}`
    : 'urn:ogc:def:crs:OGC:1.3:CRS84';

  return {
    type: 'FeatureCollection',
    name: 'Terra Delineated Watershed',
    crs: {
      type: 'name',
      properties: { name: crsName },
    },
    features,
  };
}

/**
 * Downloads a GeoJSON FeatureCollection to a client file.
 */
export function downloadGeoJSON(
  data: GeoJSONFeatureCollection,
  filename = 'terra-vectors.geojson'
): void {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename, 'application/geo+json');
}

