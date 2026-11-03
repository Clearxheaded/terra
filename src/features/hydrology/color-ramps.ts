/**
 * Color Ramps for Hydrological Visualizations.
 *
 * Implements perceptual color ramps for D8 flow directions (cyclic multi-hue),
 * flow accumulation (hypsometric log-scaled river gradient), and watershed masks.
 */

import {
  D8_E,
  D8_N,
  D8_NE,
  D8_NONE,
  D8_NW,
  D8_S,
  D8_SE,
  D8_SW,
  D8_W,
  type D8Direction,
} from './types';

/**
 * 8-directional cyclic palette mapping D8 directions to distinct hue stops.
 */
const D8_COLOR_MAP: Readonly<Record<D8Direction, readonly [number, number, number]>> = {
  [D8_NONE]: [0.2, 0.22, 0.26], // Slate grey for pits/outlets/flats
  [D8_E]: [0.0, 0.85, 0.9], // Cyan (East)
  [D8_SE]: [0.15, 0.45, 0.95], // Azure (Southeast)
  [D8_S]: [0.55, 0.2, 0.9], // Deep Indigo / Violet (South)
  [D8_SW]: [0.85, 0.15, 0.7], // Magenta (Southwest)
  [D8_W]: [0.95, 0.3, 0.15], // Orange-Red (West)
  [D8_NW]: [0.95, 0.7, 0.1], // Amber / Gold (Northwest)
  [D8_N]: [0.2, 0.85, 0.3], // Lime / Spring Green (North)
  [D8_NE]: [0.1, 0.85, 0.65], // Aquamarine (Northeast)
};

/**
 * Evaluates the RGB color for a given D8 flow direction code.
 */
export function evaluateD8FlowColor(direction: number): [number, number, number] {
  const code = direction as D8Direction;
  const col = D8_COLOR_MAP[code];
  if (col) {
    return [col[0], col[1], col[2]];
  }
  return [0.2, 0.22, 0.26];
}

/**
 * Evaluates the RGB color for log10-scaled flow accumulation.
 * Uses a hypsometric river gradient from dark navy to brilliant electric cyan-white.
 *
 * @param logVal log10(accum) value of current cell.
 * @param maxLog Maximum log10(accum) across the grid.
 */
export function evaluateFlowAccumulationColor(
  logVal: number,
  maxLog: number
): [number, number, number] {
  if (Number.isNaN(logVal) || maxLog <= 0) {
    return [0.08, 0.1, 0.22];
  }

  const t = Math.min(1.0, Math.max(0.0, logVal / maxLog));

  // 4-stop piecewise linear gradient
  if (t < 0.25) {
    // 0.0 -> 0.25: Deep Navy [0.08, 0.1, 0.22] -> Cobalt [0.12, 0.25, 0.6]
    const u = t / 0.25;
    return [
      0.08 + u * (0.12 - 0.08),
      0.1 + u * (0.25 - 0.1),
      0.22 + u * (0.6 - 0.22),
    ];
  }
  if (t < 0.5) {
    // 0.25 -> 0.5: Cobalt [0.12, 0.25, 0.6] -> Cerulean Blue [0.1, 0.5, 0.85]
    const u = (t - 0.25) / 0.25;
    return [
      0.12 + u * (0.1 - 0.12),
      0.25 + u * (0.5 - 0.25),
      0.6 + u * (0.85 - 0.6),
    ];
  }
  if (t < 0.75) {
    // 0.5 -> 0.75: Cerulean Blue [0.1, 0.5, 0.85] -> Bright Cyan [0.15, 0.85, 0.95]
    const u = (t - 0.5) / 0.25;
    return [
      0.1 + u * (0.15 - 0.1),
      0.5 + u * (0.85 - 0.5),
      0.85 + u * (0.95 - 0.85),
    ];
  }
  // 0.75 -> 1.0: Bright Cyan [0.15, 0.85, 0.95] -> Electric Cyan-White [0.95, 0.98, 1.0]
  const u = (t - 0.75) / 0.25;
  return [
    0.15 + u * (0.95 - 0.15),
    0.85 + u * (0.98 - 0.85),
    0.95 + u * (1.0 - 0.95),
  ];
}

