import type { ColorStop } from '@/features/terrain/color-ramps';
import { evaluateColorRamp } from '@/features/terrain/color-ramps';
import { FLAT_ASPECT_SENTINEL } from './aspect';

/**
 * Slope warning color ramp (0° to 60°+):
 * 0°: Emerald green (flat / gentle)
 * 12°: Lime / yellow-green (moderate)
 * 25°: Amber yellow (steep)
 * 38°: Bright orange (very steep)
 * 50°: Crimson red (dangerously steep)
 * 60°+: Maroon / dark red (cliff)
 */
export const SLOPE_RAMP: readonly ColorStop[] = [
  { stop: 0.0, r: 0.13, g: 0.77, b: 0.37 }, // #22c55e
  { stop: 0.2, r: 0.52, g: 0.8, b: 0.09 }, // #84cc16 (~12°)
  { stop: 0.42, r: 0.92, g: 0.7, b: 0.03 }, // #eab308 (~25°)
  { stop: 0.63, r: 0.98, g: 0.45, b: 0.09 }, // #f97316 (~38°)
  { stop: 0.83, r: 0.94, g: 0.27, b: 0.27 }, // #ef4444 (~50°)
  { stop: 1.0, r: 0.5, g: 0.11, b: 0.11 }, // #7f1d1d (60°+)
];

/**
 * Aspect cyclic multi-hue color ramp (0° to 360° compass azimuth):
 * 0° (N): Cool sky blue
 * 90° (E): Spring green
 * 180° (S): Warm crimson red
 * 270° (W): Royal violet
 * 360° (N): Cool sky blue (seamless cyclic closure)
 */
export const ASPECT_RAMP: readonly ColorStop[] = [
  { stop: 0.0, r: 0.22, g: 0.74, b: 0.97 }, // 0° North (Sky blue #38bdf8)
  { stop: 0.125, r: 0.18, g: 0.83, b: 0.75 }, // 45° NE (#2dd4bf)
  { stop: 0.25, r: 0.13, g: 0.77, b: 0.37 }, // 90° East (#22c55e)
  { stop: 0.375, r: 0.92, g: 0.7, b: 0.03 }, // 135° SE (#eab308)
  { stop: 0.5, r: 0.94, g: 0.27, b: 0.27 }, // 180° South (#ef4444)
  { stop: 0.625, r: 0.93, g: 0.28, b: 0.6 }, // 225° SW (#ec4899)
  { stop: 0.75, r: 0.66, g: 0.33, b: 0.97 }, // 270° West (#a855f7)
  { stop: 0.875, r: 0.39, g: 0.4, b: 0.95 }, // 315° NW (#6366f1)
  { stop: 1.0, r: 0.22, g: 0.74, b: 0.97 }, // 360° North (closure)
];

/**
 * Evaluates color for a given slope angle in degrees.
 * Clamps angles from 0° to 60° across the normalized color ramp.
 */
export function evaluateSlopeColor(slopeDegrees: number): [r: number, g: number, b: number] {
  if (Number.isNaN(slopeDegrees)) {
    return [0.15, 0.17, 0.2]; // NoData slate
  }
  const maxAngle = 60.0;
  const t = Math.max(0, Math.min(1, slopeDegrees / maxAngle));
  return evaluateColorRamp(t, SLOPE_RAMP);
}

/**
 * Evaluates color for a given aspect angle in degrees.
 * Handles flat terrain explicitly by returning a neutral slate grey.
 */
export function evaluateAspectColor(aspectDegrees: number): [r: number, g: number, b: number] {
  if (Number.isNaN(aspectDegrees)) {
    return [0.15, 0.17, 0.2]; // NoData slate
  }
  if (aspectDegrees === FLAT_ASPECT_SENTINEL || aspectDegrees < 0) {
    return [0.39, 0.45, 0.55]; // Neutral flat grey (#64748b)
  }
  const normalizedDeg = (aspectDegrees % 360 + 360) % 360;
  const t = normalizedDeg / 360.0;
  return evaluateColorRamp(t, ASPECT_RAMP);
}

/**
 * Evaluates color for hillshade grayscale illumination [0, 255].
 */
export function evaluateHillshadeColor(shadeValue: number): [r: number, g: number, b: number] {
  if (Number.isNaN(shadeValue)) {
    return [0.15, 0.17, 0.2]; // NoData slate
  }
  const intensity = Math.max(0, Math.min(1, shadeValue / 255.0));
  return [intensity, intensity, intensity];
}

