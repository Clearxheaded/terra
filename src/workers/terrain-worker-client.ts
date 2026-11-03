import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import type { SlopeUnit } from '@/features/analysis/types';
import type { PriorityFloodOptions } from '@/features/hydrology/types';
import { executeDerivativesTask } from './derivatives.worker';
import { executeHydrologyRoutingTask } from './hydrology.worker';
import { executePriorityFloodTask } from './priority-flood.worker';
import type {
  ComputeDerivativesPayload,
  ComputeDerivativesResult,
  HydrologyRoutingPayload,
  HydrologyRoutingResult,
  PriorityFloodPayload,
  PriorityFloodResult,
  WorkerProgressResponse,
  WorkerRequest,
  WorkerResponse,
  WorkerSuccessResponse,
} from './types';

export interface DerivativesWorkerOptions {
  computeSlope?: boolean;
  slopeUnit?: SlopeUnit;
  computeAspect?: boolean;
  computeHillshade?: boolean;
  sunAzimuth?: number;
  sunAltitude?: number;
  zFactor?: number;
}

export type ProgressCallback = (progress: number, stage: string) => void;

/**
 * High-performance asynchronous client that dispatches computationally heavy
 * geospatial algorithms to dedicated Web Workers with zero-copy transferable buffers.
 * Gracefully falls back to direct main-thread execution in environments without Web Worker support (e.g. Node.js).
 */
export class TerrainWorkerClient {
  private derivativesWorker: Worker | null = null;
  private priorityFloodWorker: Worker | null = null;
  private hydrologyWorker: Worker | null = null;

  private pendingTasks = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      onProgress?: ProgressCallback;
    }
  >();

  private taskIdCounter = 0;
  private isDisposed = false;

  private hasWorkerSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof Blob !== 'undefined'
    );
  }

  private nextTaskId(prefix: string): string {
    return `${prefix}-${Date.now()}-${++this.taskIdCounter}`;
  }

  private getDerivativesWorker(): Worker | null {
    if (!this.hasWorkerSupport() || this.isDisposed) return null;
    if (!this.derivativesWorker) {
      this.derivativesWorker = new Worker(
        new URL('./derivatives.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.derivativesWorker.onmessage = this.handleWorkerMessage;
      this.derivativesWorker.onerror = this.handleWorkerError;
    }
    return this.derivativesWorker;
  }

  private getPriorityFloodWorker(): Worker | null {
    if (!this.hasWorkerSupport() || this.isDisposed) return null;
    if (!this.priorityFloodWorker) {
      this.priorityFloodWorker = new Worker(
        new URL('./priority-flood.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.priorityFloodWorker.onmessage = this.handleWorkerMessage;
      this.priorityFloodWorker.onerror = this.handleWorkerError;
    }
    return this.priorityFloodWorker;
  }

  private getHydrologyWorker(): Worker | null {
    if (!this.hasWorkerSupport() || this.isDisposed) return null;
    if (!this.hydrologyWorker) {
      this.hydrologyWorker = new Worker(
        new URL('./hydrology.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.hydrologyWorker.onmessage = this.handleWorkerMessage;
      this.hydrologyWorker.onerror = this.handleWorkerError;
    }
    return this.hydrologyWorker;
  }

  private handleWorkerMessage = (event: MessageEvent<WorkerResponse>): void => {
    const msg = event.data;
    const task = this.pendingTasks.get(msg.id);
    if (!task) return;

    if (msg.type === 'progress') {
      const pMsg = msg as WorkerProgressResponse;
      task.onProgress?.(pMsg.progress, pMsg.stage);
    } else if (msg.type === 'success') {
      this.pendingTasks.delete(msg.id);
      const sMsg = msg as WorkerSuccessResponse;
      task.resolve(sMsg.result);
    } else if (msg.type === 'error') {
      this.pendingTasks.delete(msg.id);
      task.reject(new Error(msg.error));
    }
  };

  private handleWorkerError = (err: ErrorEvent): void => {
    // If an uncaught worker error fires, reject all pending tasks
    const message = err.message || 'Unknown Web Worker error';
    for (const [id, task] of this.pendingTasks.entries()) {
      task.reject(new Error(`Worker fatal error: ${message}`));
      this.pendingTasks.delete(id);
    }
  };

  /**
   * Computes Horn's slope, circular aspect, and analytical hillshade asynchronously in a worker thread.
   */
  public async computeDerivatives(
    grid: ElevationGrid,
    options: DerivativesWorkerOptions = {},
    onProgress?: ProgressCallback
  ): Promise<ComputeDerivativesResult> {
    const payload: ComputeDerivativesPayload = {
      elevationData: new Float32Array(grid.data), // Cloned buffer to keep source grid data intact
      width: grid.width,
      height: grid.height,
      noDataValue: grid.noDataValue,
      pixelSizeX: grid.pixelSizeX,
      pixelSizeY: grid.pixelSizeY,
      crsUnit: grid.crs.unit,
      zFactor: options.zFactor ?? 1.0,
      computeSlope: options.computeSlope ?? true,
      slopeUnit: options.slopeUnit ?? 'degrees',
      computeAspect: options.computeAspect ?? true,
      computeHillshade: options.computeHillshade ?? true,
      sunAzimuth: options.sunAzimuth ?? 315,
      sunAltitude: options.sunAltitude ?? 45,
    };

    const worker = this.getDerivativesWorker();
    if (!worker) {
      // Fallback: execute pure algorithm directly
      const { result } = executeDerivativesTask(payload, onProgress);
      return result;
    }

    const taskId = this.nextTaskId('deriv');
    return new Promise<ComputeDerivativesResult>((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve: resolve as (val: unknown) => void,
        reject,
        onProgress,
      });

      const req: WorkerRequest<ComputeDerivativesPayload> = {
        id: taskId,
        type: 'compute-derivatives',
        payload,
      };

      // Transfer the cloned elevationData buffer zero-copy to the worker
      worker.postMessage(req, [payload.elevationData.buffer]);
    });
  }

  /**
   * Runs Barnes' Priority-Flood depression filling asynchronously in a worker thread.
   */
  public async fillDepressions(
    grid: ElevationGrid,
    options: PriorityFloodOptions = {},
    onProgress?: ProgressCallback
  ): Promise<ElevationGrid> {
    const payload: PriorityFloodPayload = {
      elevationData: new Float32Array(grid.data), // Cloned buffer to keep source grid intact
      width: grid.width,
      height: grid.height,
      noDataValue: grid.noDataValue,
      epsilon: options.epsilon ?? 1e-5,
    };

    const worker = this.getPriorityFloodWorker();
    if (!worker) {
      // Fallback: execute pure algorithm directly
      const { result } = executePriorityFloodTask(payload, onProgress);
      return new ElevationGrid({
        width: grid.width,
        height: grid.height,
        data: result.filledData,
        noDataValue: grid.noDataValue,
        transform: grid.transform,
        crs: grid.crs,
        elevationUnit: grid.elevationUnit,
        datasetName: grid.datasetName ? `${grid.datasetName} (Conditioned)` : undefined,
      });
    }

    const taskId = this.nextTaskId('flood');
    const result = await new Promise<PriorityFloodResult>((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve: resolve as (val: unknown) => void,
        reject,
        onProgress,
      });

      const req: WorkerRequest<PriorityFloodPayload> = {
        id: taskId,
        type: 'priority-flood',
        payload,
      };

      // Transfer the cloned elevationData buffer zero-copy to the worker
      worker.postMessage(req, [payload.elevationData.buffer]);
    });

    return new ElevationGrid({
      width: grid.width,
      height: grid.height,
      data: result.filledData,
      noDataValue: grid.noDataValue,
      transform: grid.transform,
      crs: grid.crs,
      elevationUnit: grid.elevationUnit,
      datasetName: grid.datasetName ? `${grid.datasetName} (Conditioned)` : undefined,
    });
  }

  /**
   * Computes D8 flow direction and in-degree topological flow accumulation asynchronously in a worker.
   */
  public async calculateHydrologyRouting(
    grid: ElevationGrid,
    options: { zFactor?: number } = {},
    onProgress?: ProgressCallback
  ): Promise<HydrologyRoutingResult> {
    const payload: HydrologyRoutingPayload = {
      elevationData: new Float32Array(grid.data), // Cloned buffer
      width: grid.width,
      height: grid.height,
      noDataValue: grid.noDataValue,
      pixelSizeX: grid.pixelSizeX,
      pixelSizeY: grid.pixelSizeY,
      crsUnit: grid.crs.unit,
      zFactor: options.zFactor ?? 1.0,
    };

    const worker = this.getHydrologyWorker();
    if (!worker) {
      // Fallback: execute pure algorithm directly
      const { result } = executeHydrologyRoutingTask(payload, onProgress);
      return result;
    }

    const taskId = this.nextTaskId('hydro');
    return new Promise<HydrologyRoutingResult>((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve: resolve as (val: unknown) => void,
        reject,
        onProgress,
      });

      const req: WorkerRequest<HydrologyRoutingPayload> = {
        id: taskId,
        type: 'hydrology-routing',
        payload,
      };

      // Transfer the cloned elevationData buffer zero-copy to the worker
      worker.postMessage(req, [payload.elevationData.buffer]);
    });
  }

  /**
   * Disposes all running worker threads and rejects any outstanding pending tasks.
   */
  public dispose(): void {
    this.isDisposed = true;

    for (const [id, task] of this.pendingTasks.entries()) {
      task.reject(new Error('TerrainWorkerClient was disposed'));
      this.pendingTasks.delete(id);
    }

    if (this.derivativesWorker) {
      this.derivativesWorker.terminate();
      this.derivativesWorker = null;
    }
    if (this.priorityFloodWorker) {
      this.priorityFloodWorker.terminate();
      this.priorityFloodWorker = null;
    }
    if (this.hydrologyWorker) {
      this.hydrologyWorker.terminate();
      this.hydrologyWorker = null;
    }
  }
}

// Global singleton instance for app-wide compute tasks
export const terrainWorkerClient = new TerrainWorkerClient();
