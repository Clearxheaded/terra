import { CellMinHeap } from '@/features/hydrology/priority-flood';
import { D8_OFFSETS } from '@/features/hydrology/types';
import type {
  PriorityFloodPayload,
  PriorityFloodResult,
  WorkerErrorResponse,
  WorkerProgressResponse,
  WorkerRequest,
  WorkerSuccessResponse,
} from './types';

/**
 * Executes Barnes' Priority-Flood depression filling on a raw Float32Array.
 */
export function executePriorityFloodTask(
  payload: PriorityFloodPayload,
  onProgress?: (progress: number, stage: string) => void
): { result: PriorityFloodResult; transferables: ArrayBuffer[] } {
  const { elevationData, width, height, noDataValue, epsilon = 1e-5 } = payload;
  const totalCells = width * height;

  const isNoData = (val: number): boolean => {
    if (Number.isNaN(val)) return true;
    if (noDataValue !== null && Math.abs(val - noDataValue) < 1e-5) return true;
    return false;
  };

  const filledData = new Float32Array(elevationData);
  const visited = new Uint8Array(totalCells);

  const initialHeapCap = Math.min(totalCells, Math.max(1024, (width + height) * 2));
  const heap = new CellMinHeap(initialHeapCap);

  let validCells = 0;
  // Mark NoData cells as visited
  for (let idx = 0; idx < totalCells; idx++) {
    if (isNoData(filledData[idx]!)) {
      visited[idx] = 1;
    } else {
      validCells++;
    }
  }

  // 1. Initialize perimeter boundary cells
  for (let c = 0; c < width; c++) {
    const topIdx = c;
    if (!visited[topIdx]) {
      visited[topIdx] = 1;
      heap.push(topIdx, filledData[topIdx]!);
    }
    const bottomIdx = (height - 1) * width + c;
    if (!visited[bottomIdx]) {
      visited[bottomIdx] = 1;
      heap.push(bottomIdx, filledData[bottomIdx]!);
    }
  }

  for (let r = 1; r < height - 1; r++) {
    const leftIdx = r * width;
    if (!visited[leftIdx]) {
      visited[leftIdx] = 1;
      heap.push(leftIdx, filledData[leftIdx]!);
    }
    const rightIdx = r * width + (width - 1);
    if (!visited[rightIdx]) {
      visited[rightIdx] = 1;
      heap.push(rightIdx, filledData[rightIdx]!);
    }
  }

  // 2. Identify internal boundaries adjacent to NoData cells
  for (let r = 1; r < height - 1; r++) {
    const rowOffset = r * width;
    for (let c = 1; c < width - 1; c++) {
      const idx = rowOffset + c;
      if (visited[idx]) continue;

      let touchesNoData = false;
      for (let i = 0; i < 8; i++) {
        const off = D8_OFFSETS[i]!;
        const nIdx = (r + off.dr) * width + (c + off.dc);
        if (isNoData(filledData[nIdx]!)) {
          touchesNoData = true;
          break;
        }
      }

      if (touchesNoData) {
        visited[idx] = 1;
        heap.push(idx, filledData[idx]!);
      }
    }
  }

  // 3. Priority-Flood traversal
  let processedCells = 0;
  let filledCellsCount = 0;
  const progressInterval = Math.max(1000, Math.floor(validCells / 20));

  while (heap.length > 0) {
    const top = heap.pop()!;
    const currIdx = top.idx;
    const spillElev = top.elev;
    const c = currIdx % width;
    const r = Math.floor(currIdx / width);

    processedCells++;
    if (onProgress && processedCells % progressInterval === 0) {
      const prog = Math.min(0.99, processedCells / Math.max(validCells, 1));
      onProgress(prog, `Filling terrain depressions (${Math.round(prog * 100)}%)`);
    }

    for (let i = 0; i < 8; i++) {
      const off = D8_OFFSETS[i]!;
      const nc = c + off.dc;
      const nr = r + off.dr;

      if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;
      const nIdx = nr * width + nc;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;

      const neighborElev = filledData[nIdx]!;
      if (isNoData(neighborElev)) continue;

      if (neighborElev <= spillElev) {
        // Depression cell: raise to spillway elevation + epsilon
        const raisedElev = spillElev + epsilon;
        filledData[nIdx] = raisedElev;
        filledCellsCount++;
        heap.push(nIdx, raisedElev);
      } else {
        // Natural higher terrain
        heap.push(nIdx, neighborElev);
      }
    }
  }

  if (onProgress) {
    onProgress(1.0, 'Depression filling complete');
  }

  // Calculate stats on filledData
  let minElev = Number.POSITIVE_INFINITY;
  let maxElev = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < totalCells; i++) {
    const val = filledData[i]!;
    if (!isNoData(val)) {
      if (val < minElev) minElev = val;
      if (val > maxElev) maxElev = val;
    }
  }

  const result: PriorityFloodResult = {
    filledData,
    minElevation: minElev === Number.POSITIVE_INFINITY ? 0 : minElev,
    maxElevation: maxElev === Number.NEGATIVE_INFINITY ? 0 : maxElev,
    filledCellsCount,
  };

  return {
    result,
    transferables: [filledData.buffer],
  };
}

if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.addEventListener('message', (event: MessageEvent<WorkerRequest<PriorityFloodPayload>>) => {
    const { id, type, payload } = event.data;
    if (type !== 'priority-flood') return;

    try {
      const { result, transferables } = executePriorityFloodTask(payload, (progress, stage) => {
        const progressMsg: WorkerProgressResponse = {
          id,
          type: 'progress',
          stage,
          progress,
        };
        (self as unknown as Worker).postMessage(progressMsg);
      });

      const successMsg: WorkerSuccessResponse<PriorityFloodResult> = {
        id,
        type: 'success',
        result,
      };
      (self as unknown as Worker).postMessage(successMsg, transferables);
    } catch (err) {
      const errorMsg: WorkerErrorResponse = {
        id,
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
      (self as unknown as Worker).postMessage(errorMsg);
    }
  });
}
