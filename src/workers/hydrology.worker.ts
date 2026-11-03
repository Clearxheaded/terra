import {
  D8_E,
  D8_N,
  D8_NE,
  D8_NONE,
  D8_NW,
  D8_OFFSETS_BY_CODE,
  D8_S,
  D8_SE,
  D8_SW,
  D8_W,
  type D8Direction,
} from '@/features/hydrology/types';
import type {
  HydrologyRoutingPayload,
  HydrologyRoutingResult,
  WorkerErrorResponse,
  WorkerProgressResponse,
  WorkerRequest,
  WorkerSuccessResponse,
} from './types';

function getMetricScale(unit: string): number {
  if (unit === 'degree') return 111320.0;
  if (unit === 'foot') return 0.3048;
  return 1.0;
}

function getDownstreamIndex(
  col: number,
  row: number,
  direction: D8Direction,
  width: number,
  height: number
): number {
  if (direction === D8_NONE) return -1;
  const offset = D8_OFFSETS_BY_CODE[direction];
  if (!offset) return -1;

  const nc = col + offset.dc;
  const nr = row + offset.dr;
  if (nc < 0 || nc >= width || nr < 0 || nr >= height) {
    return -1;
  }
  return nr * width + nc;
}

export function executeHydrologyRoutingTask(
  payload: HydrologyRoutingPayload,
  onProgress?: (progress: number, stage: string) => void
): { result: HydrologyRoutingResult; transferables: ArrayBuffer[] } {
  const {
    elevationData,
    width,
    height,
    noDataValue,
    pixelSizeX,
    pixelSizeY,
    crsUnit,
    zFactor = 1.0,
  } = payload;
  const totalCells = width * height;

  const isNoData = (val: number): boolean => {
    if (Number.isNaN(val)) return true;
    if (noDataValue !== null && Math.abs(val - noDataValue) < 1e-5) return true;
    return false;
  };

  const scale = getMetricScale(crsUnit);
  const dx = Math.max(pixelSizeX * scale, 1e-4);
  const dy = Math.max(pixelSizeY * scale, 1e-4);
  const diagDist = Math.sqrt(dx * dx + dy * dy);

  const neighborDistances: readonly [number, number, number, number, number, number, number, number] = [
    dx,       // E
    diagDist, // SE
    dy,       // S
    diagDist, // SW
    dx,       // W
    diagDist, // NW
    dy,       // N
    diagDist, // NE
  ];

  const neighborOffsets: readonly [
    { dc: number; dr: number; code: D8Direction },
    { dc: number; dr: number; code: D8Direction },
    { dc: number; dr: number; code: D8Direction },
    { dc: number; dr: number; code: D8Direction },
    { dc: number; dr: number; code: D8Direction },
    { dc: number; dr: number; code: D8Direction },
    { dc: number; dr: number; code: D8Direction },
    { dc: number; dr: number; code: D8Direction },
  ] = [
    { dc: 1, dr: 0, code: D8_E },
    { dc: 1, dr: 1, code: D8_SE },
    { dc: 0, dr: 1, code: D8_S },
    { dc: -1, dr: 1, code: D8_SW },
    { dc: -1, dr: 0, code: D8_W },
    { dc: -1, dr: -1, code: D8_NW },
    { dc: 0, dr: -1, code: D8_N },
    { dc: 1, dr: -1, code: D8_NE },
  ];

  const flowDirData = new Uint8Array(totalCells);
  let sinkCount = 0;
  let edgeCellCount = 0;
  let validCellCount = 0;

  // STAGE 1: D8 Flow Direction (0% to 50%)
  const progressInterval1 = Math.max(1, Math.floor(height / 10));

  for (let r = 0; r < height; r++) {
    if (onProgress && r % progressInterval1 === 0) {
      const p = (r / height) * 0.5;
      onProgress(p, `Routing D8 flow directions (${Math.round(p * 100)}%)`);
    }

    const isEdgeRow = r === 0 || r === height - 1;
    const rowOffset = r * width;

    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      const centerElev = elevationData[idx]!;

      if (isNoData(centerElev)) {
        flowDirData[idx] = D8_NONE;
        continue;
      }

      validCellCount++;
      const isEdge = isEdgeRow || c === 0 || c === width - 1;

      const zc = centerElev * zFactor;
      let maxDrop = 0;
      let bestDir: D8Direction = D8_NONE;

      for (let i = 0; i < 8; i++) {
        const off = neighborOffsets[i]!;
        const nc = c + off.dc;
        const nr = r + off.dr;

        if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;

        const nIdx = nr * width + nc;
        const nElev = elevationData[nIdx]!;
        if (isNoData(nElev)) continue;

        const zn = nElev * zFactor;
        const elevDiff = zc - zn;
        if (elevDiff <= 0) continue;

        const dist = neighborDistances[i]!;
        const drop = elevDiff / dist;

        if (drop > maxDrop) {
          maxDrop = drop;
          bestDir = off.code;
        }
      }

      flowDirData[idx] = bestDir;
      if (bestDir === D8_NONE) {
        if (isEdge) {
          edgeCellCount++;
        } else {
          sinkCount++;
        }
      }
    }
  }

  // STAGE 2: Flow Accumulation via In-Degree Topological Sort (50% to 100%)
  const accumData = new Float32Array(totalCells);
  const logAccumData = new Float32Array(totalCells);
  const inDegree = new Int32Array(totalCells);

  for (let idx = 0; idx < totalCells; idx++) {
    const elev = elevationData[idx]!;
    if (isNoData(elev)) {
      accumData[idx] = Number.NaN;
      logAccumData[idx] = Number.NaN;
    } else {
      accumData[idx] = 1.0;
    }
  }

  for (let r = 0; r < height; r++) {
    const rowOffset = r * width;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      if (isNoData(elevationData[idx]!)) continue;

      const dir = flowDirData[idx] as D8Direction;
      if (dir === 0) continue;

      const targetIdx = getDownstreamIndex(c, r, dir, width, height);
      if (targetIdx >= 0 && !isNoData(elevationData[targetIdx]!)) {
        inDegree[targetIdx] = (inDegree[targetIdx] ?? 0) + 1;
      }
    }
  }

  // Queue of cells with zero incoming flow
  const queue = new Int32Array(validCellCount);
  let queueHead = 0;
  let queueTail = 0;

  for (let idx = 0; idx < totalCells; idx++) {
    if (!isNoData(elevationData[idx]!) && inDegree[idx] === 0) {
      queue[queueTail++] = idx;
    }
  }

  let maxAccum = 1.0;
  let processedInAccum = 0;
  const progressInterval2 = Math.max(1000, Math.floor(validCellCount / 10));

  while (queueHead < queueTail) {
    const currIdx = queue[queueHead++]!;
    processedInAccum++;

    if (onProgress && processedInAccum % progressInterval2 === 0) {
      const p = 0.5 + (processedInAccum / Math.max(validCellCount, 1)) * 0.5;
      onProgress(p, `Accumulating drainage networks (${Math.round(p * 100)}%)`);
    }

    const c = currIdx % width;
    const r = Math.floor(currIdx / width);
    const dir = flowDirData[currIdx] as D8Direction;

    if (dir !== D8_NONE) {
      const targetIdx = getDownstreamIndex(c, r, dir, width, height);
      if (targetIdx >= 0 && !isNoData(elevationData[targetIdx]!)) {
        accumData[targetIdx] = (accumData[targetIdx] ?? 1.0) + (accumData[currIdx] ?? 1.0);
        inDegree[targetIdx] = (inDegree[targetIdx] ?? 1) - 1;

        if (inDegree[targetIdx] === 0) {
          queue[queueTail++] = targetIdx;
        }
      }
    }

    const finalVal = accumData[currIdx]!;
    if (finalVal > maxAccum) {
      maxAccum = finalVal;
    }
    logAccumData[currIdx] = Math.log10(Math.max(finalVal, 1.0));
  }

  if (onProgress) {
    onProgress(1.0, 'Hydrology routing and accumulation complete');
  }

  const result: HydrologyRoutingResult = {
    flowDirData,
    accumData,
    logAccumData,
    maxAccum,
    sinkCount,
    edgeCellCount,
    validCellCount,
  };

  return {
    result,
    transferables: [flowDirData.buffer, accumData.buffer, logAccumData.buffer],
  };
}

if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.addEventListener('message', (event: MessageEvent<WorkerRequest<HydrologyRoutingPayload>>) => {
    const { id, type, payload } = event.data;
    if (type !== 'hydrology-routing') return;

    try {
      const { result, transferables } = executeHydrologyRoutingTask(payload, (progress, stage) => {
        const progressMsg: WorkerProgressResponse = {
          id,
          type: 'progress',
          stage,
          progress,
        };
        (self as unknown as Worker).postMessage(progressMsg);
      });

      const successMsg: WorkerSuccessResponse<HydrologyRoutingResult> = {
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
