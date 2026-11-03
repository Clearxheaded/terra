import type {
  ComputeDerivativesPayload,
  ComputeDerivativesResult,
  WorkerErrorResponse,
  WorkerProgressResponse,
  WorkerRequest,
  WorkerSuccessResponse,
} from './types';

/**
 * Computes metric pixel dimensions (dx, dy) in meters, accounting for CRS units.
 */
function getMetricScale(unit: string): number {
  if (unit === 'degree') {
    return 111320.0;
  }
  if (unit === 'foot') {
    return 0.3048;
  }
  return 1.0;
}

/**
 * Executes topographic derivatives computation with optional row chunking and progress reporting.
 */
export function executeDerivativesTask(
  payload: ComputeDerivativesPayload,
  onProgress?: (progress: number, stage: string) => void
): { result: ComputeDerivativesResult; transferables: ArrayBuffer[] } {
  const {
    elevationData,
    width,
    height,
    noDataValue,
    pixelSizeX,
    pixelSizeY,
    crsUnit,
    zFactor = 1.0,
    computeSlope = true,
    slopeUnit = 'degrees',
    computeAspect = true,
    computeHillshade = true,
    sunAzimuth = 315,
    sunAltitude = 45,
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
  const eightDx = 8.0 * dx;
  const eightDy = 8.0 * dy;
  const radToDeg = 180.0 / Math.PI;
  const degToRad = Math.PI / 180.0;

  // Pre-calculate solar constants for analytical hillshade
  const zenithRad = (90.0 - sunAltitude) * degToRad;
  const azimuthRad = ((360.0 - sunAzimuth + 90.0) % 360.0) * degToRad;
  const cosZenith = Math.cos(zenithRad);
  const sinZenith = Math.sin(zenithRad);

  const slopeData = computeSlope ? new Float32Array(totalCells) : undefined;
  const aspectData = computeAspect ? new Float32Array(totalCells) : undefined;
  const hillshadeData = computeHillshade ? new Float32Array(totalCells) : undefined;

  let slopeMin = Number.POSITIVE_INFINITY;
  let slopeMax = Number.NEGATIVE_INFINITY;
  let slopeSum = 0;
  let slopeCount = 0;

  let aspectMin = Number.POSITIVE_INFINITY;
  let aspectMax = Number.NEGATIVE_INFINITY;
  let aspectSum = 0;
  let aspectCount = 0;

  let hillshadeMin = Number.POSITIVE_INFINITY;
  let hillshadeMax = Number.NEGATIVE_INFINITY;
  let hillshadeSum = 0;
  let hillshadeCount = 0;

  // Row chunk size for reporting progress
  const progressInterval = Math.max(1, Math.floor(height / 10));

  for (let r = 0; r < height; r++) {
    if (onProgress && (r % progressInterval === 0 || r === height - 1)) {
      onProgress((r + 1) / height, `Computing terrain derivatives (${Math.round(((r + 1) / height) * 100)}%)`);
    }

    const rowOffset = r * width;
    const rPrev = r > 0 ? (r - 1) * width : rowOffset;
    const rNext = r < height - 1 ? (r + 1) * width : rowOffset;

    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c;
      const centerVal = elevationData[idx]!;

      if (isNoData(centerVal)) {
        if (slopeData) slopeData[idx] = Number.NaN;
        if (aspectData) aspectData[idx] = Number.NaN;
        if (hillshadeData) hillshadeData[idx] = Number.NaN;
        continue;
      }

      const zc = centerVal * zFactor;

      // Fast neighborhood extraction with edge clamp & NoData fallback
      const cLeft = c > 0 ? c - 1 : c;
      const cRight = c < width - 1 ? c + 1 : c;

      const getZ = (rowIdx: number, colIdx: number): number => {
        const val = elevationData[rowIdx + colIdx]!;
        return isNoData(val) ? zc : val * zFactor;
      };

      const ztl = getZ(rPrev, cLeft);
      const zt = getZ(rPrev, c);
      const ztr = getZ(rPrev, cRight);

      const zl = getZ(rowOffset, cLeft);
      const zr = getZ(rowOffset, cRight);

      const zbl = getZ(rNext, cLeft);
      const zb = getZ(rNext, c);
      const zbr = getZ(rNext, cRight);

      // Horn's finite-difference gradients
      const dzdx = (ztr + 2.0 * zr + zbr - (ztl + 2.0 * zl + zbl)) / eightDx;
      const dzdy = (ztl + 2.0 * zt + ztr - (zbl + 2.0 * zb + zbr)) / eightDy;

      const riseRun = Math.sqrt(dzdx * dzdx + dzdy * dzdy);

      // 1. Slope computation
      if (slopeData) {
        let slopeVal: number;
        if (slopeUnit === 'degrees') {
          slopeVal = Math.atan(riseRun) * radToDeg;
        } else {
          slopeVal = riseRun * 100.0;
        }
        slopeData[idx] = slopeVal;

        if (slopeVal < slopeMin) slopeMin = slopeVal;
        if (slopeVal > slopeMax) slopeMax = slopeVal;
        slopeSum += slopeVal;
        slopeCount++;
      }

      // 2. Aspect computation
      if (aspectData) {
        let aspectVal: number;
        if (dzdx === 0 && dzdy === 0) {
          aspectVal = -1; // flat
        } else {
          const aspectRad = Math.atan2(dzdy, -dzdx);
          let aspectDeg = 90.0 - aspectRad * radToDeg;
          if (aspectDeg < 0) aspectDeg += 360.0;
          if (aspectDeg >= 360.0) aspectDeg -= 360.0;
          aspectVal = aspectDeg;

          if (aspectVal < aspectMin) aspectMin = aspectVal;
          if (aspectVal > aspectMax) aspectMax = aspectVal;
          aspectSum += aspectVal;
          aspectCount++;
        }
        aspectData[idx] = aspectVal;
      }

      // 3. Hillshade computation
      if (hillshadeData) {
        const slopeRad = Math.atan(riseRun);
        let aspectRadMath = 0;
        if (dzdx !== 0 || dzdy !== 0) {
          aspectRadMath = Math.atan2(dzdy, -dzdx);
        }

        const cosIncidence =
          cosZenith * Math.cos(slopeRad) +
          sinZenith * Math.sin(slopeRad) * Math.cos(azimuthRad - aspectRadMath);

        const hillshadeVal = Math.max(0.0, Math.min(255.0, 255.0 * cosIncidence));
        hillshadeData[idx] = hillshadeVal;

        if (hillshadeVal < hillshadeMin) hillshadeMin = hillshadeVal;
        if (hillshadeVal > hillshadeMax) hillshadeMax = hillshadeVal;
        hillshadeSum += hillshadeVal;
        hillshadeCount++;
      }
    }
  }

  const result: ComputeDerivativesResult = {
    slopeData,
    slopeMin: slopeCount > 0 ? slopeMin : 0,
    slopeMax: slopeCount > 0 ? slopeMax : 0,
    slopeMean: slopeCount > 0 ? slopeSum / slopeCount : 0,
    aspectData,
    aspectMin: aspectCount > 0 ? aspectMin : 0,
    aspectMax: aspectCount > 0 ? aspectMax : 0,
    aspectMean: aspectCount > 0 ? aspectSum / aspectCount : 0,
    hillshadeData,
    hillshadeMin: hillshadeCount > 0 ? hillshadeMin : 0,
    hillshadeMax: hillshadeCount > 0 ? hillshadeMax : 0,
    hillshadeMean: hillshadeCount > 0 ? hillshadeSum / hillshadeCount : 0,
  };

  const transferables: ArrayBuffer[] = [];
  if (slopeData) transferables.push(slopeData.buffer);
  if (aspectData) transferables.push(aspectData.buffer);
  if (hillshadeData) transferables.push(hillshadeData.buffer);

  return { result, transferables };
}

// Set up worker listener when running inside Web Worker global scope
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.addEventListener('message', (event: MessageEvent<WorkerRequest<ComputeDerivativesPayload>>) => {
    const { id, type, payload } = event.data;
    if (type !== 'compute-derivatives') return;

    try {
      const { result, transferables } = executeDerivativesTask(payload, (progress, stage) => {
        const progressMsg: WorkerProgressResponse = {
          id,
          type: 'progress',
          stage,
          progress,
        };
        (self as unknown as Worker).postMessage(progressMsg);
      });

      const successMsg: WorkerSuccessResponse<ComputeDerivativesResult> = {
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
