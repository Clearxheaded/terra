import type { SlopeUnit } from '@/features/analysis/types';

export type WorkerTaskType = 'compute-derivatives' | 'priority-flood' | 'hydrology-routing';

export interface WorkerRequest<T = unknown> {
  id: string;
  type: WorkerTaskType;
  payload: T;
}

export interface WorkerProgressResponse {
  id: string;
  type: 'progress';
  stage: string;
  progress: number; // 0.0 to 1.0
}

export interface WorkerSuccessResponse<T = unknown> {
  id: string;
  type: 'success';
  result: T;
}

export interface WorkerErrorResponse {
  id: string;
  type: 'error';
  error: string;
}

export type WorkerResponse<T = unknown> =
  | WorkerProgressResponse
  | WorkerSuccessResponse<T>
  | WorkerErrorResponse;

// Payload & Result definitions for Derivatives
export interface ComputeDerivativesPayload {
  elevationData: Float32Array;
  width: number;
  height: number;
  noDataValue: number | null;
  pixelSizeX: number;
  pixelSizeY: number;
  crsUnit: string;
  zFactor?: number;
  computeSlope?: boolean;
  slopeUnit?: SlopeUnit;
  computeAspect?: boolean;
  computeHillshade?: boolean;
  sunAzimuth?: number;
  sunAltitude?: number;
}

export interface ComputeDerivativesResult {
  slopeData?: Float32Array;
  slopeMin?: number;
  slopeMax?: number;
  slopeMean?: number;
  aspectData?: Float32Array;
  aspectMin?: number;
  aspectMax?: number;
  aspectMean?: number;
  hillshadeData?: Float32Array;
  hillshadeMin?: number;
  hillshadeMax?: number;
  hillshadeMean?: number;
}

// Payload & Result definitions for Priority-Flood
export interface PriorityFloodPayload {
  elevationData: Float32Array;
  width: number;
  height: number;
  noDataValue: number | null;
  epsilon?: number;
}

export interface PriorityFloodResult {
  filledData: Float32Array;
  minElevation: number;
  maxElevation: number;
  filledCellsCount: number;
}

// Payload & Result definitions for Hydrology Routing
export interface HydrologyRoutingPayload {
  elevationData: Float32Array;
  width: number;
  height: number;
  noDataValue: number | null;
  pixelSizeX: number;
  pixelSizeY: number;
  crsUnit: string;
  zFactor?: number;
}

export interface HydrologyRoutingResult {
  flowDirData: Uint8Array;
  accumData: Float32Array;
  logAccumData: Float32Array;
  maxAccum: number;
  sinkCount: number;
  edgeCellCount: number;
  validCellCount: number;
}
