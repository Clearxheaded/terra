import { describe, expect, it } from 'vitest';
import {
  benchmarkD8FlowAccumulation,
  benchmarkHornSlope,
  benchmarkPriorityFlood,
  formatBenchmarkMarkdownTable,
  type BenchmarkMetric,
} from './benchmarks/benchmark-suite';

describe('Terrain Algorithm Performance Benchmarks', () => {
  it('benchmarks Horn slope, Priority-Flood, and D8 flow accumulation with formatted Markdown report', () => {
    const allMetrics: BenchmarkMetric[] = [];

    // 1. Horn's Slope benchmarks
    const slopeMetrics = benchmarkHornSlope();
    expect(slopeMetrics).toHaveLength(3);
    for (const m of slopeMetrics) {
      expect(m.totalCells).toBeGreaterThan(0);
      expect(m.durationMs).toBeGreaterThan(0);
      expect(m.megaCellsPerSec).toBeGreaterThan(0);
    }
    allMetrics.push(...slopeMetrics);

    // 2. Priority-Flood benchmarks
    const floodMetrics = benchmarkPriorityFlood();
    expect(floodMetrics).toHaveLength(3);
    for (const m of floodMetrics) {
      expect(m.durationMs).toBeGreaterThan(0);
      expect(m.megaCellsPerSec).toBeGreaterThan(0);
    }
    allMetrics.push(...floodMetrics);

    // 3. D8 Flow Accumulation benchmarks
    const hydroMetrics = benchmarkD8FlowAccumulation();
    expect(hydroMetrics).toHaveLength(2);
    for (const m of hydroMetrics) {
      expect(m.durationMs).toBeGreaterThan(0);
      expect(m.megaCellsPerSec).toBeGreaterThan(0);
    }
    allMetrics.push(...hydroMetrics);

    // Generate markdown table and print to stdout
    const markdownTable = formatBenchmarkMarkdownTable(allMetrics);
    expect(markdownTable).toContain("Horn's Slope");
    expect(markdownTable).toContain('Priority-Flood Filling');
    expect(markdownTable).toContain('D8 Flow Accumulation');

    console.log('\n--- TERRA BENCHMARK RESULTS ---\n');
    console.log(markdownTable);
    console.log('\n-------------------------------\n');
  });
});
