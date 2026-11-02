import type {
  AffineTransform,
  CoordinateReferenceSystem,
  ElevationGridOptions,
  ElevationStats,
  ElevationUnit,
} from './types';

/**
 * Immutable data structure representing a regular 2D raster digital elevation model (DEM).
 *
 * Implements pixel indexing, coordinate transformations, NoData filtering,
 * and statistical analysis without any React or DOM dependencies.
 */
export class ElevationGrid {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
  readonly noDataValue: number | null;
  readonly transform: AffineTransform;
  readonly crs: CoordinateReferenceSystem;
  readonly elevationUnit: ElevationUnit;
  readonly datasetName: string;

  private _stats: ElevationStats | null = null;

  constructor(options: ElevationGridOptions) {
    const {
      width,
      height,
      data,
      noDataValue = null,
      transform = [0, 1, 0, 0, 0, -1],
      crs = { unit: 'meter' },
      elevationUnit = 'meter',
      datasetName = 'Untitled DEM',
    } = options;

    if (!Number.isInteger(width) || width <= 0) {
      throw new Error(`Invalid grid width: ${width}. Width must be a positive integer.`);
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new Error(`Invalid grid height: ${height}. Height must be a positive integer.`);
    }
    if (data.length !== width * height) {
      throw new Error(
        `Buffer length mismatch: expected ${width * height} cells (${width}x${height}), got ${data.length}.`
      );
    }

    this.width = width;
    this.height = height;
    this.data = data;
    this.noDataValue = noDataValue;
    this.transform = [...transform];
    this.crs = { ...crs };
    this.elevationUnit = elevationUnit;
    this.datasetName = datasetName;
  }

  /**
   * Horizontal pixel resolution (positive number).
   */
  get pixelSizeX(): number {
    return Math.abs(this.transform[1]);
  }

  /**
   * Vertical pixel resolution (positive number).
   */
  get pixelSizeY(): number {
    return Math.abs(this.transform[5]);
  }

  /**
   * Calculates the 1D buffer index for a given grid column and row.
   */
  getIndex(col: number, row: number): number {
    return row * this.width + col;
  }

  /**
   * Checks whether the specified coordinates fall within grid boundaries.
   */
  isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.width && row >= 0 && row < this.height;
  }

  /**
   * Checks whether an elevation value represents a NoData / missing measurement.
   */
  isNoData(value: number): boolean {
    if (Number.isNaN(value)) {
      return true;
    }
    if (this.noDataValue !== null) {
      // Allow minor floating point tolerance for sentinel values like -9999.0
      return Math.abs(value - this.noDataValue) < 1e-4;
    }
    return false;
  }

  /**
   * Returns the elevation at (col, row), or null if out of bounds or a NoData cell.
   */
  getElevation(col: number, row: number): number | null {
    if (!this.isInBounds(col, row)) {
      return null;
    }
    const val = this.data[this.getIndex(col, row)]!;
    return this.isNoData(val) ? null : val;
  }

  /**
   * Returns the raw array value at (col, row). Throws if out of bounds.
   */
  getRawElevation(col: number, row: number): number {
    if (!this.isInBounds(col, row)) {
      throw new RangeError(`Coordinates (${col}, ${row}) are out of grid bounds (${this.width}x${this.height}).`);
    }
    return this.data[this.getIndex(col, row)]!;
  }

  /**
   * Converts grid coordinates (col, row) to geographic / projected map coordinates (X, Y).
   *
   * By default maps to the pixel center when col and row are integers.
   */
  gridToGeo(col: number, row: number, centerPixel = false): [x: number, y: number] {
    const c = centerPixel ? col + 0.5 : col;
    const r = centerPixel ? row + 0.5 : row;
    const [originX, pixelWidth, xSkew, originY, ySkew, pixelHeight] = this.transform;
    const x = originX + c * pixelWidth + r * xSkew;
    const y = originY + c * ySkew + r * pixelHeight;
    return [x, y];
  }

  /**
   * Converts map coordinates (X, Y) to fractional grid coordinates [col, row].
   *
   * Solves the inverse affine system:
   *   dx = originX + col*pixelWidth + row*xSkew
   *   dy = originY + col*ySkew + row*pixelHeight
   */
  geoToGrid(x: number, y: number): [col: number, row: number] {
    const [originX, pixelWidth, xSkew, originY, ySkew, pixelHeight] = this.transform;
    const det = pixelWidth * pixelHeight - xSkew * ySkew;
    if (Math.abs(det) < 1e-12) {
      throw new Error('Singular or degenerate affine transform cannot be inverted.');
    }
    const dx = x - originX;
    const dy = y - originY;
    const col = (dx * pixelHeight - dy * xSkew) / det;
    const row = (dy * pixelWidth - dx * ySkew) / det;
    return [col, row];
  }

  /**
   * Computes elevation statistics (min, max, mean, count) excluding NoData cells.
   * Results are cached after first computation.
   */
  getStats(): ElevationStats {
    if (this._stats) {
      return this._stats;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let sum = 0;
    let validCount = 0;
    let noDataCount = 0;

    const len = this.data.length;
    for (let i = 0; i < len; i++) {
      const val = this.data[i]!;
      if (this.isNoData(val)) {
        noDataCount++;
      } else {
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
        validCount++;
      }
    }

    const mean = validCount > 0 ? sum / validCount : 0;
    const safeMin = validCount > 0 ? min : 0;
    const safeMax = validCount > 0 ? max : 0;

    this._stats = {
      min: safeMin,
      max: safeMax,
      mean,
      validCount,
      noDataCount,
    };

    return this._stats;
  }

  /**
   * Creates a downsampled copy of the grid for rendering efficiency when dealing
   * with very large rasters. Uses nearest-neighbor sampling.
   */
  resample(targetWidth: number, targetHeight: number): ElevationGrid {
    if (targetWidth === this.width && targetHeight === this.height) {
      return this;
    }
    if (targetWidth <= 0 || targetHeight <= 0) {
      throw new Error(`Target dimensions (${targetWidth}x${targetHeight}) must be positive integers.`);
    }

    const newData = new Float32Array(targetWidth * targetHeight);
    const scaleX = this.width / targetWidth;
    const scaleY = this.height / targetHeight;

    for (let r = 0; r < targetHeight; r++) {
      const srcRow = Math.min(Math.floor(r * scaleY), this.height - 1);
      const rowOffset = r * targetWidth;
      const srcRowOffset = srcRow * this.width;

      for (let c = 0; c < targetWidth; c++) {
        const srcCol = Math.min(Math.floor(c * scaleX), this.width - 1);
        newData[rowOffset + c] = this.data[srcRowOffset + srcCol]!;
      }
    }

    const [originX, pixelWidth, xSkew, originY, ySkew, pixelHeight] = this.transform;
    const newTransform: AffineTransform = [
      originX,
      pixelWidth * scaleX,
      xSkew * scaleX,
      originY,
      ySkew * scaleY,
      pixelHeight * scaleY,
    ];

    return new ElevationGrid({
      width: targetWidth,
      height: targetHeight,
      data: newData,
      noDataValue: this.noDataValue,
      transform: newTransform,
      crs: this.crs,
      elevationUnit: this.elevationUnit,
      datasetName: `${this.datasetName} (Resampled ${targetWidth}x${targetHeight})`,
    });
  }
}

