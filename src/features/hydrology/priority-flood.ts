/**
 * Priority-Flood DEM depression pre-processing (Barnes, Lehman, Mulla, 2014).
 *
 * Automatically raises internal sinks and depressions to their minimum spillover
 * elevation, producing a hydrologically conditioned surface where all cells have
 * an uninterrupted downhill path to the raster boundaries or external outlets.
 *
 * Reference:
 * Barnes, R., Lehman, C., & Mulla, D. (2014). Priority-flood: An optimal depression-filling
 * and watershed-labeling algorithm for digital elevation models.
 * Computers & Geosciences, 62, 117-127.
 */

import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { D8_OFFSETS, type PriorityFloodOptions } from './types';

/**
 * High-performance binary min-heap for grid cell processing.
 * Backed by typed arrays to eliminate garbage collection overhead during millions of operations.
 */
export class CellMinHeap {
  private indices: Int32Array;
  private elevations: Float64Array;
  private size = 0;

  constructor(initialCapacity = 1024) {
    const cap = Math.max(16, initialCapacity);
    this.indices = new Int32Array(cap);
    this.elevations = new Float64Array(cap);
  }

  public push(idx: number, elev: number): void {
    if (this.size >= this.indices.length) {
      const newCap = this.indices.length * 2;
      const nextIdx = new Int32Array(newCap);
      const nextElev = new Float64Array(newCap);
      nextIdx.set(this.indices);
      nextElev.set(this.elevations);
      this.indices = nextIdx;
      this.elevations = nextElev;
    }

    let i = this.size++;
    this.indices[i] = idx;
    this.elevations[i] = elev;

    // Sift up
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.elevations[i]! < this.elevations[parent]!) {
        const tmpIdx = this.indices[i]!;
        const tmpElev = this.elevations[i]!;
        this.indices[i] = this.indices[parent]!;
        this.elevations[i] = this.elevations[parent]!;
        this.indices[parent] = tmpIdx;
        this.elevations[parent] = tmpElev;
        i = parent;
      } else {
        break;
      }
    }
  }

  public pop(): { idx: number; elev: number } | null {
    if (this.size === 0) return null;
    const resIdx = this.indices[0]!;
    const resElev = this.elevations[0]!;
    this.size--;

    if (this.size > 0) {
      this.indices[0] = this.indices[this.size]!;
      this.elevations[0] = this.elevations[this.size]!;

      // Sift down
      let i = 0;
      while (true) {
        let smallest = i;
        const left = (i << 1) + 1;
        const right = left + 1;

        if (left < this.size && this.elevations[left]! < this.elevations[smallest]!) {
          smallest = left;
        }
        if (right < this.size && this.elevations[right]! < this.elevations[smallest]!) {
          smallest = right;
        }

        if (smallest !== i) {
          const tmpIdx = this.indices[i]!;
          const tmpElev = this.elevations[i]!;
          this.indices[i] = this.indices[smallest]!;
          this.elevations[i] = this.elevations[smallest]!;
          this.indices[smallest] = tmpIdx;
          this.elevations[smallest] = tmpElev;
          i = smallest;
        } else {
          break;
        }
      }
    }

    return { idx: resIdx, elev: resElev };
  }

  public get length(): number {
    return this.size;
  }
}

/**
 * Fills depressions in an ElevationGrid using Barnes' Priority-Flood algorithm.
 *
 * @param grid Source digital elevation model.
 * @param options Sink filling options including epsilon gradient for flat resolution.
 * @returns A new ElevationGrid with depressions filled to their spill elevation.
 */
export function fillDepressions(
  grid: ElevationGrid,
  options: PriorityFloodOptions = {}
): ElevationGrid {
  const { epsilon = 1e-5 } = options;
  const width = grid.width;
  const height = grid.height;
  const totalCells = width * height;

  const filledData = new Float32Array(grid.data);
  const visited = new Uint8Array(totalCells);

  const initialHeapCap = Math.min(totalCells, Math.max(1024, (width + height) * 2));
  const heap = new CellMinHeap(initialHeapCap);

  // Mark all NoData cells as visited so they are never expanded into
  for (let idx = 0; idx < totalCells; idx++) {
    if (grid.isNoData(grid.data[idx]!)) {
      visited[idx] = 1;
    }
  }

  // 1. Initialize boundary cells: external grid perimeter
  for (let c = 0; c < width; c++) {
    // Top border (row 0)
    const topIdx = c;
    if (!visited[topIdx]) {
      visited[topIdx] = 1;
      heap.push(topIdx, filledData[topIdx]!);
    }
    // Bottom border (row height - 1)
    const bottomIdx = (height - 1) * width + c;
    if (!visited[bottomIdx]) {
      visited[bottomIdx] = 1;
      heap.push(bottomIdx, filledData[bottomIdx]!);
    }
  }

  for (let r = 1; r < height - 1; r++) {
    // Left border (col 0)
    const leftIdx = r * width;
    if (!visited[leftIdx]) {
      visited[leftIdx] = 1;
      heap.push(leftIdx, filledData[leftIdx]!);
    }
    // Right border (col width - 1)
    const rightIdx = r * width + (width - 1);
    if (!visited[rightIdx]) {
      visited[rightIdx] = 1;
      heap.push(rightIdx, filledData[rightIdx]!);
    }
  }

  // 2. Identify internal boundaries: valid cells adjacent to NoData cells
  for (let r = 1; r < height - 1; r++) {
    const rowOffset = r * width;
    for (let c = 1; c < width - 1; c++) {
      const idx = rowOffset + c;
      if (visited[idx]) continue;

      let touchesNoData = false;
      for (let i = 0; i < 8; i++) {
        const off = D8_OFFSETS[i]!;
        const nIdx = (r + off.dr) * width + (c + off.dc);
        if (grid.isNoData(grid.data[nIdx]!)) {
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
  while (heap.length > 0) {
    const top = heap.pop()!;
    const currIdx = top.idx;
    const spillElev = top.elev;
    const c = currIdx % width;
    const r = Math.floor(currIdx / width);

    for (let i = 0; i < 8; i++) {
      const off = D8_OFFSETS[i]!;
      const nc = c + off.dc;
      const nr = r + off.dr;

      if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;
      const nIdx = nr * width + nc;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;

      const neighborElev = filledData[nIdx]!;
      if (grid.isNoData(neighborElev)) continue;

      if (neighborElev <= spillElev) {
        // Depression or flat cell: raise to spillway elevation (+ epsilon for downstream drainage)
        const raisedElev = spillElev + epsilon;
        filledData[nIdx] = raisedElev;
        heap.push(nIdx, raisedElev);
      } else {
        // Natural higher terrain
        heap.push(nIdx, neighborElev);
      }
    }
  }

  return new ElevationGrid({
    width: grid.width,
    height: grid.height,
    data: filledData,
    noDataValue: grid.noDataValue,
    transform: grid.transform,
    crs: grid.crs,
    elevationUnit: grid.elevationUnit,
    datasetName: grid.datasetName ? `${grid.datasetName} (Conditioned)` : undefined,
  });
}
