import { describe, expect, it } from 'vitest';
import { createSyntheticTerrain } from '@/lib/geospatial/synthetic-terrain';
import {
  executeDerivativesTask,
  executeHydrologyRoutingTask,
  executePriorityFloodTask,
  terrainWorkerClient,
} from '@/workers';

describe('Web Worker Computation Pipeline & Transferable Buffers', () => {
  it('executes derivative tasks in a single pass with progress callbacks and transferable buffers', () => {
    const grid = createSyntheticTerrain({
      width: 50,
      height: 50,
      type: 'pyramid',
      baseElevation: 100,
      peakElevation: 500,
    });

    const progressReports: number[] = [];
    const { result, transferables } = executeDerivativesTask(
      {
        elevationData: new Float32Array(grid.data),
        width: grid.width,
        height: grid.height,
        noDataValue: grid.noDataValue,
        pixelSizeX: grid.pixelSizeX,
        pixelSizeY: grid.pixelSizeY,
        crsUnit: grid.crs.unit,
        computeSlope: true,
        computeAspect: true,
        computeHillshade: true,
      },
      (p) => {
        progressReports.push(p);
      }
    );

    // Verify results
    expect(result.slopeData).toBeDefined();
    expect(result.aspectData).toBeDefined();
    expect(result.hillshadeData).toBeDefined();

    expect(result.slopeData?.length).toBe(2500);
    expect(result.slopeMax).toBeGreaterThan(0);
    expect(result.hillshadeMax).toBeGreaterThan(0);

    // Progress was emitted
    expect(progressReports.length).toBeGreaterThan(0);
    expect(progressReports[progressReports.length - 1]).toBe(1.0);

    // Verify zero-copy transferable buffers
    expect(transferables.length).toBe(3);
    expect(transferables[0]).toBe(result.slopeData?.buffer);
    expect(transferables[1]).toBe(result.aspectData?.buffer);
    expect(transferables[2]).toBe(result.hillshadeData?.buffer);
  });

  it('executes Priority-Flood depression filling task with transferable buffer and progress', () => {
    const grid = createSyntheticTerrain({
      width: 30,
      height: 30,
      type: 'depression', // depression has central depression
      baseElevation: 100,
      peakElevation: 600,
    });

    const progressReports: number[] = [];
    const { result, transferables } = executePriorityFloodTask(
      {
        elevationData: new Float32Array(grid.data),
        width: grid.width,
        height: grid.height,
        noDataValue: grid.noDataValue,
      },
      (p) => {
        progressReports.push(p);
      }
    );

    expect(result.filledData).toBeDefined();
    expect(result.filledData.length).toBe(900);
    expect(result.filledCellsCount).toBeGreaterThan(0); // Crater depression cells were raised
    expect(transferables.length).toBe(1);
    expect(transferables[0]).toBe(result.filledData.buffer);

    expect(progressReports.length).toBeGreaterThan(0);
  });

  it('executes Hydrology routing and flow accumulation task with transferables', () => {
    const grid = createSyntheticTerrain({
      width: 40,
      height: 40,
      type: 'plane', // Constant slope downwards
      baseElevation: 100,
      peakElevation: 400,
    });

    const progressReports: number[] = [];
    const { result, transferables } = executeHydrologyRoutingTask(
      {
        elevationData: new Float32Array(grid.data),
        width: grid.width,
        height: grid.height,
        noDataValue: grid.noDataValue,
        pixelSizeX: grid.pixelSizeX,
        pixelSizeY: grid.pixelSizeY,
        crsUnit: grid.crs.unit,
      },
      (p) => {
        progressReports.push(p);
      }
    );

    expect(result.flowDirData.length).toBe(1600);
    expect(result.accumData.length).toBe(1600);
    expect(result.logAccumData.length).toBe(1600);
    expect(result.maxAccum).toBeGreaterThan(1);
    expect(result.validCellCount).toBe(1600);

    expect(transferables.length).toBe(3);
    expect(transferables[0]).toBe(result.flowDirData.buffer);
    expect(transferables[1]).toBe(result.accumData.buffer);
    expect(transferables[2]).toBe(result.logAccumData.buffer);
  });

  it('TerrainWorkerClient executes tasks with fallback in Node.js environment', async () => {
    const grid = createSyntheticTerrain({
      width: 30,
      height: 30,
      type: 'mountain',
    });

    const derivResult = await terrainWorkerClient.computeDerivatives(grid);
    expect(derivResult.slopeData).toBeDefined();
    expect(derivResult.aspectData).toBeDefined();
    expect(derivResult.hillshadeData).toBeDefined();

    const floodGrid = await terrainWorkerClient.fillDepressions(grid);
    expect(floodGrid.width).toBe(30);
    expect(floodGrid.height).toBe(30);

    const hydroResult = await terrainWorkerClient.calculateHydrologyRouting(floodGrid);
    expect(hydroResult.flowDirData).toBeDefined();
    expect(hydroResult.maxAccum).toBeGreaterThan(0);
  });
});
