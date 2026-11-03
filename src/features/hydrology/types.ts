/**
 * Type definitions and constants for hydrological terrain analysis.
 *
 * Implements standard D8 flow routing (O'Callaghan & Mark 1984),
 * Priority-Flood sink filling (Barnes et al. 2014),
 * topological flow accumulation, and watershed delineation.
 */

import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';

/**
 * Standard D8 direction bit-codes:
 * 1: East, 2: Southeast, 4: South, 8: Southwest,
 * 16: West, 32: Northwest, 64: North, 128: Northeast,
 * 0: Undefined / Flat / Pit / Outlet / NoData.
 */
export const D8_E = 1 as const;
export const D8_SE = 2 as const;
export const D8_S = 4 as const;
export const D8_SW = 8 as const;
export const D8_W = 16 as const;
export const D8_NW = 32 as const;
export const D8_N = 64 as const;
export const D8_NE = 128 as const;
export const D8_NONE = 0 as const;

export type D8Direction = 0 | 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128;

export interface D8NeighborOffset {
  readonly dc: number;
  readonly dr: number;
  readonly code: D8Direction;
  readonly name: string;
  readonly compass: string;
  readonly isDiagonal: boolean;
  readonly azimuthDeg: number;
}

/**
 * Clockwise neighbor offsets starting from East (0° cartesian, 90° azimuth).
 * In grid coordinates:
 * - col increases East (+dc)
 * - row increases South (+dr)
 */
export const D8_OFFSETS: readonly D8NeighborOffset[] = [
  { dc: 1, dr: 0, code: 1, name: 'East', compass: 'E', isDiagonal: false, azimuthDeg: 90 },
  { dc: 1, dr: 1, code: 2, name: 'South-East', compass: 'SE', isDiagonal: true, azimuthDeg: 135 },
  { dc: 0, dr: 1, code: 4, name: 'South', compass: 'S', isDiagonal: false, azimuthDeg: 180 },
  { dc: -1, dr: 1, code: 8, name: 'South-West', compass: 'SW', isDiagonal: true, azimuthDeg: 225 },
  { dc: -1, dr: 0, code: 16, name: 'West', compass: 'W', isDiagonal: false, azimuthDeg: 270 },
  { dc: -1, dr: -1, code: 32, name: 'North-West', compass: 'NW', isDiagonal: true, azimuthDeg: 315 },
  { dc: 0, dr: -1, code: 64, name: 'North', compass: 'N', isDiagonal: false, azimuthDeg: 0 },
  { dc: 1, dr: -1, code: 128, name: 'North-East', compass: 'NE', isDiagonal: true, azimuthDeg: 45 },
] as const;

/**
 * Fast lookup map from D8 direction bit-code to neighbor offset.
 */
export const D8_OFFSETS_BY_CODE: Readonly<Record<D8Direction, D8NeighborOffset | null>> = {
  0: null,
  1: D8_OFFSETS[0]!,
  2: D8_OFFSETS[1]!,
  4: D8_OFFSETS[2]!,
  8: D8_OFFSETS[3]!,
  16: D8_OFFSETS[4]!,
  32: D8_OFFSETS[5]!,
  64: D8_OFFSETS[6]!,
  128: D8_OFFSETS[7]!,
};

/**
 * Configuration options for Priority-Flood depression filling.
 */
export interface PriorityFloodOptions {
  /**
   * Infinitesimal upward elevation increment added per depression cell
   * so that filled sinks retain a strictly downward gradient toward the spill sill.
   * Default: 1e-5 meters. Set to 0 for exact flat spill elevation.
   */
  epsilon?: number;
}

/**
 * Result of D8 Flow Direction calculation.
 */
export interface FlowDirectionResult {
  /** Raster of D8Direction bit-codes (Uint8Array of length width * height) */
  readonly data: Uint8Array;
  /** Number of cells with flow direction 0 (Pits, Flats, Outlets, or NoData) */
  readonly pitCount: number;
  /** Total valid (non-NoData) cells evaluated */
  readonly validCount: number;
  /** Frequency distribution of flow directions */
  readonly histogram: Record<D8Direction, number>;
}

/**
 * Result of topological flow accumulation calculation.
 */
export interface FlowAccumulationResult {
  /** Upstream contributing cell count per cell (Float32Array) */
  readonly data: Float32Array;
  /** Log10-scaled accumulation for high dynamic range display */
  readonly logData: Float32Array;
  /** Minimum accumulation (typically 1 for ridges) */
  readonly min: number;
  /** Maximum accumulation (major river outlet) */
  readonly max: number;
  /** Mean accumulation across valid cells */
  readonly mean: number;
  /** Total valid cells evaluated */
  readonly validCount: number;
  /** Coordinates of the cell with maximum accumulated flow */
  readonly maxAccumCell: { col: number; row: number };
}

/**
 * Point along a traced downstream flow path.
 */
export interface FlowPathPoint {
  readonly col: number;
  readonly row: number;
  readonly elevation: number;
  readonly accumulation: number;
}

/**
 * Upstream contributing watershed delineation result.
 */
export interface WatershedResult {
  /** Binary mask where 1 = inside watershed, 0 = outside */
  readonly mask: Uint8Array;
  /** Total number of cells within watershed */
  readonly cellCount: number;
  /** Total contributing drainage area in km² */
  readonly areaKm2: number;
  /** Percentage of valid grid cells covered by watershed */
  readonly areaPercent: number;
  /** Pour point / outlet coordinates */
  readonly pourPoint: { col: number; row: number };
}

/**
 * Hydrology analysis context containing raw and conditioned grids and computed layers.
 */
export interface HydrologyWorkspace {
  readonly rawGrid: ElevationGrid;
  readonly conditionedGrid: ElevationGrid;
  readonly isConditioned: boolean;
  readonly flowDir: FlowDirectionResult;
  readonly flowAccum: FlowAccumulationResult;
  readonly activeWatershed: WatershedResult | null;
  readonly tracedFlowPath: FlowPathPoint[] | null;
}

