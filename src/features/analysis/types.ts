/**
 * Type definitions for terrain analysis algorithms (Slope, Aspect, Hillshade).
 */

export type SlopeUnit = 'degrees' | 'percent';

export type AnalysisLayerType =
  | 'elevation'
  | 'slope'
  | 'aspect'
  | 'hillshade'
  | 'd8-flow'
  | 'flow-accumulation';

export interface SlopeResult {
  readonly data: Float32Array;
  readonly unit: SlopeUnit;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly validCount: number;
}

export interface AspectHistogram {
  readonly N: number;
  readonly NE: number;
  readonly E: number;
  readonly SE: number;
  readonly S: number;
  readonly SW: number;
  readonly W: number;
  readonly NW: number;
  readonly flat: number;
}

export interface AspectResult {
  readonly data: Float32Array;
  readonly validCount: number;
  readonly flatCount: number;
  /** Mean direction in degrees [0, 360) computed via directional/circular statistics, or null if all flat */
  readonly circularMean: number | null;
  /** Primary compass direction name (e.g., 'North-West', 'South', 'Flat') */
  readonly dominantDirection: string;
  /** Percentage of valid cells facing dominant direction */
  readonly dominantPercentage: number;
  readonly histogram: AspectHistogram;
}

export interface HillshadeOptions {
  /** Sun azimuth in degrees [0, 360] clockwise from North (default: 315 NW) */
  azimuth?: number;
  /** Sun altitude/elevation angle in degrees [0, 90] above horizon (default: 45) */
  altitude?: number;
  /** Vertical exaggeration factor applied to elevation before calculating hillshade (default: 1.0) */
  zFactor?: number;
}

export interface HillshadeResult {
  readonly data: Float32Array;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly validCount: number;
  readonly azimuth: number;
  readonly altitude: number;
}

