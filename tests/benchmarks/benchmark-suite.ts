import { calculateSlope } from '@/features/analysis/slope';
import { calculateFlowAccumulation } from '@/features/hydrology/flow-accumulation';
import { calculateFlowDirection } from '@/features/hydrology/flow-direction';
import { fillDepressions } from '@/features/hydrology/priority-flood';
import { createSyntheticTerrain } from '@/lib/geospatial/synthetic-terrain';

export interface BenchmarkMetric {
  algorithm: string;
  gridDimensions: string;
  totalCells: number;
  durationMs: number;
  megaCellsPerSec: number;
}

/**
 * Measures wall-clock execution time and throughput for a benchmark runner.
 */
export function measureThroughput(
  algorithm: string,
  width: number,
  height: number,
  fn: () => void,
  iterations = 1
): BenchmarkMetric {
  const totalCells = width * height;

  // 1. Warm-up execution
  fn();

  // 2. Timed run
  const tStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const tEnd = performance.now();

  const totalDuration = tEnd - tStart;
  const avgDurationMs = totalDuration / iterations;
  const cellsPerSec = (totalCells / (avgDurationMs / 1000));
  const megaCellsPerSec = Math.round((cellsPerSec / 1_000_000) * 100) / 100;

  return {
    algorithm,
    gridDimensions: `${width} × ${height}`,
    totalCells,
    durationMs: Math.round(avgDurationMs * 10) / 10,
    megaCellsPerSec,
  };
}

/**
 * Runs benchmarks for Horn's Slope on 512x512, 1024x1024, and 2048x2048 synthetic grids.
 */
export function benchmarkHornSlope(): BenchmarkMetric[] {
  const results: BenchmarkMetric[] = [];
  const sizes = [
    { w: 512, h: 512 },
    { w: 1024, h: 1024 },
    { w: 2048, h: 2048 },
  ];

  for (const size of sizes) {
    const grid = createSyntheticTerrain({
      width: size.w,
      height: size.h,
      type: 'mountain',
    });

    const metric = measureThroughput(
      "Horn's Slope",
      size.w,
      size.h,
      () => {
        calculateSlope(grid, 'degrees');
      },
      1
    );
    results.push(metric);
  }

  return results;
}

/**
 * Runs benchmarks for Priority-Flood depression filling on synthetic grids.
 */
export function benchmarkPriorityFlood(): BenchmarkMetric[] {
  const results: BenchmarkMetric[] = [];
  const sizes = [
    { w: 256, h: 256 },
    { w: 512, h: 512 },
    { w: 1024, h: 1024 },
  ];

  for (const size of sizes) {
    const grid = createSyntheticTerrain({
      width: size.w,
      height: size.h,
      type: 'depression', // Creates internal sink depressions
    });

    const metric = measureThroughput(
      'Priority-Flood Filling',
      size.w,
      size.h,
      () => {
        fillDepressions(grid);
      },
      1
    );
    results.push(metric);
  }

  return results;
}

/**
 * Runs benchmarks for D8 Flow Accumulation via topological sorting.
 */
export function benchmarkD8FlowAccumulation(): BenchmarkMetric[] {
  const results: BenchmarkMetric[] = [];
  const sizes = [
    { w: 512, h: 512 },
    { w: 1024, h: 1024 },
  ];

  for (const size of sizes) {
    const grid = createSyntheticTerrain({
      width: size.w,
      height: size.h,
      type: 'mountain',
    });

    const flowDir = calculateFlowDirection(grid);

    const metric = measureThroughput(
      'D8 Flow Accumulation',
      size.w,
      size.h,
      () => {
        calculateFlowAccumulation(grid, flowDir.data);
      },
      1
    );
    results.push(metric);
  }

  return results;
}

/**
 * Formats an array of benchmark metrics into a Markdown table.
 */
export function formatBenchmarkMarkdownTable(metrics: BenchmarkMetric[]): string {
  const header = '| Algorithm | Grid Dimensions | Total Cells | Latency (ms) | Throughput (Mcells/s) |\n| :--- | :---: | :---: | :---: | :---: |';
  const rows = metrics.map((m) => {
    return `| ${m.algorithm} | ${m.gridDimensions} | ${m.totalCells.toLocaleString()} | ${m.durationMs.toFixed(1)} ms | **${m.megaCellsPerSec.toFixed(2)} Mcells/s** |`;
  });

  return [header, ...rows].join('\n');
}
