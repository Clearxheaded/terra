/**
 * Topographic and hypsometric color ramps for elevation visualization.
 */

export interface ColorStop {
  stop: number; // 0.0 to 1.0
  r: number; // 0.0 to 1.0
  g: number;
  b: number;
}

/**
 * Standard topographic color ramp:
 * Low: Deep forest green
 * Mid-low: Lush green / pasture
 * Mid: Ochre / valley yellow
 * Mid-high: Mountain brown / terracotta
 * High: Slate rock grey
 * Peak: Alpine snow white
 */
export const TOPOGRAPHIC_RAMP: readonly ColorStop[] = [
  { stop: 0.0, r: 0.18, g: 0.35, b: 0.22 }, // Forest green
  { stop: 0.15, r: 0.35, g: 0.55, b: 0.25 }, // Lush green
  { stop: 0.35, r: 0.72, g: 0.75, b: 0.35 }, // Yellow-green
  { stop: 0.55, r: 0.85, g: 0.72, b: 0.45 }, // Ochre
  { stop: 0.75, r: 0.65, g: 0.48, b: 0.35 }, // Terracotta / brown
  { stop: 0.9, r: 0.6, g: 0.62, b: 0.65 }, // Slate rock grey
  { stop: 1.0, r: 0.96, g: 0.97, b: 1.0 }, // Snow white
];

/**
 * Evaluates a color ramp at normalized position t (0.0 to 1.0).
 * Interpolates linearly between adjacent color stops.
 */
export function evaluateColorRamp(
  t: number,
  ramp: readonly ColorStop[] = TOPOGRAPHIC_RAMP
): [r: number, g: number, b: number] {
  const clamped = Math.max(0, Math.min(1, Number.isNaN(t) ? 0 : t));

  if (clamped <= ramp[0]!.stop) {
    const first = ramp[0]!;
    return [first.r, first.g, first.b];
  }
  if (clamped >= ramp[ramp.length - 1]!.stop) {
    const last = ramp[ramp.length - 1]!;
    return [last.r, last.g, last.b];
  }

  for (let i = 0; i < ramp.length - 1; i++) {
    const curr = ramp[i]!;
    const next = ramp[i + 1]!;
    if (clamped >= curr.stop && clamped <= next.stop) {
      const span = next.stop - curr.stop;
      const factor = span > 0 ? (clamped - curr.stop) / span : 0;
      return [
        curr.r + factor * (next.r - curr.r),
        curr.g + factor * (next.g - curr.g),
        curr.b + factor * (next.b - curr.b),
      ];
    }
  }

  return [0.5, 0.5, 0.5];
}

