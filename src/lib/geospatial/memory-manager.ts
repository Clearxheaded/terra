import { ElevationGrid } from './elevation-grid';

export interface RasterMemoryEstimate {
  totalCells: number;
  /** Size of single Float32Array elevation grid in megabytes */
  rawElevationMb: number;
  /** Size of full terrain analysis set (slope, aspect, hillshade, flowDir, accum) */
  analysisLayersMb: number;
  /** Size of full 1:1 Three.js 3D mesh geometry buffers (positions, colors, normals, uvs, indices) */
  fullMeshMb: number;
  /** Size of LOD-downsampled 3D mesh geometry buffers */
  lodMeshMb: number;
  /** Total estimated working memory footprint in megabytes */
  totalWorkingMemoryMb: number;
  /** Recommended mesh level-of-detail stride to stay under GPU vertex budgets */
  recommendedLodStride: number;
  /** Whether the dataset exceeds standard browser main-thread safety budgets */
  isLargeDataset: boolean;
}

export const MAX_SAFE_CELLS = 4_194_304; // 2048 x 2048 cells (~4.2 million cells)
export const MAX_TARGET_VERTICES = 1_000_000; // 1.0 million vertices for smooth 60 FPS rendering

/**
 * Computes optimal Level-of-Detail (LOD) subsampling stride for 3D geometry.
 *
 * For a 2048x2048 DEM (4.2M cells), returns stride 3 (yielding ~465k vertices),
 * staying safely within GPU memory budgets while preserving visual fidelity.
 */
export function computeOptimalLodStride(
  width: number,
  height: number,
  maxVertices = MAX_TARGET_VERTICES
): number {
  const totalCells = width * height;
  if (totalCells <= maxVertices) {
    return 1;
  }
  return Math.ceil(Math.sqrt(totalCells / maxVertices));
}

/**
 * Estimates browser heap and GPU memory allocation requirements for a raster of given dimensions.
 */
export function estimateRasterMemoryUsage(
  width: number,
  height: number,
  maxVertices = MAX_TARGET_VERTICES
): RasterMemoryEstimate {
  const totalCells = width * height;
  const toMb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100;

  // Raw elevation grid: 4 bytes per cell (Float32Array)
  const rawElevationBytes = totalCells * 4;

  // Analysis layers:
  // - Slope: Float32 (4 bytes)
  // - Aspect: Float32 (4 bytes)
  // - Hillshade: Float32 (4 bytes)
  // - D8 Flow Direction: Uint8 (1 byte)
  // - Flow Accumulation: Float32 (4 bytes)
  // - Log Flow Accumulation: Float32 (4 bytes)
  // - Depression filling temp buffers: Float32 + Uint8 + Heap (~6 bytes)
  const analysisBytes = totalCells * (4 + 4 + 4 + 1 + 4 + 4 + 6);

  // Full 1:1 Three.js geometry:
  // - Position: 3 x Float32 = 12 bytes
  // - Color: 3 x Float32 = 12 bytes
  // - Normal: 3 x Float32 = 12 bytes
  // - UV: 2 x Float32 = 8 bytes
  // - Indices: 6 indices per quad * 4 bytes (Uint32) = 24 bytes
  // Total per vertex ~ 68 bytes
  const fullMeshBytes = totalCells * 68;

  const recommendedLodStride = computeOptimalLodStride(width, height, maxVertices);
  const lodMeshCells = Math.ceil(width / recommendedLodStride) * Math.ceil(height / recommendedLodStride);
  const lodMeshBytes = lodMeshCells * 68;

  const totalWorkingMemoryBytes = rawElevationBytes + analysisBytes + lodMeshBytes;

  return {
    totalCells,
    rawElevationMb: toMb(rawElevationBytes),
    analysisLayersMb: toMb(analysisBytes),
    fullMeshMb: toMb(fullMeshBytes),
    lodMeshMb: toMb(lodMeshBytes),
    totalWorkingMemoryMb: toMb(totalWorkingMemoryBytes),
    recommendedLodStride,
    isLargeDataset: totalCells > MAX_SAFE_CELLS,
  };
}

/**
 * Validates whether a raster can safely be processed in the browser.
 * Emits actionable warning messages when memory constraints are approached.
 */
export function checkRasterSafety(width: number, height: number): {
  safe: boolean;
  warnings: string[];
  estimate: RasterMemoryEstimate;
} {
  const estimate = estimateRasterMemoryUsage(width, height);
  const warnings: string[] = [];

  if (estimate.isLargeDataset) {
    warnings.push(
      `Large raster dataset detected: ${width} × ${height} (${(estimate.totalCells / 1e6).toFixed(1)}M cells, ~${estimate.totalWorkingMemoryMb} MB memory). Worker chunking and adaptive geometry LOD (stride ${estimate.recommendedLodStride}) will be engaged to prevent browser tab crashing.`
    );
  }

  if (estimate.totalWorkingMemoryMb > 600) {
    warnings.push(
      `Dataset memory footprint exceeds 600 MB. Hardware-accelerated WebGL may experience tab eviction on mobile or low-memory devices.`
    );
  }

  return {
    safe: estimate.totalWorkingMemoryMb < 1500, // 1.5 GB hard threshold for browser heap
    warnings,
    estimate,
  };
}

/**
 * Decimates an ElevationGrid by an integer stride factor, creating a structurally valid
 * lower-resolution grid with adjusted pixel dimensions, affine transform, and NoData retention.
 */
export function decimateGrid(grid: ElevationGrid, stride: number): ElevationGrid {
  if (stride <= 1) return grid;

  const originalWidth = grid.width;
  const originalHeight = grid.height;
  const newWidth = Math.ceil((originalWidth - 1) / stride) + 1;
  const newHeight = Math.ceil((originalHeight - 1) / stride) + 1;

  const decimatedData = new Float32Array(newWidth * newHeight);

  for (let r = 0; r < newHeight; r++) {
    const origRow = Math.min(r * stride, originalHeight - 1);
    const origRowOffset = origRow * originalWidth;
    const newRowOffset = r * newWidth;

    for (let c = 0; c < newWidth; c++) {
      const origCol = Math.min(c * stride, originalWidth - 1);
      decimatedData[newRowOffset + c] = grid.data[origRowOffset + origCol]!;
    }
  }

  // Update affine transform: scale pixel size by stride
  const newTransform: [number, number, number, number, number, number] = [
    grid.transform[0], // origin X stays the same
    grid.transform[1] * stride,
    grid.transform[2],
    grid.transform[3], // origin Y stays the same
    grid.transform[4],
    grid.transform[5] * stride,
  ];

  return new ElevationGrid({
    width: newWidth,
    height: newHeight,
    data: decimatedData,
    noDataValue: grid.noDataValue,
    transform: newTransform,
    crs: { ...grid.crs },
    elevationUnit: grid.elevationUnit,
    datasetName: grid.datasetName ? `${grid.datasetName} (LOD ${stride}x)` : undefined,
  });
}
