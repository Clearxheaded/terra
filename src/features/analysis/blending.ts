/**
 * Layer blending algorithms for cartographic multi-layer visualization.
 */

export type BlendMode = 'normal' | 'multiply' | 'overlay';

export type BaseLayerType = 'elevation' | 'hillshade';

export type OverlayLayerType =
  | 'none'
  | 'slope'
  | 'aspect'
  | 'hillshade'
  | 'd8-flow'
  | 'flow-accumulation';

/**
 * Mathematically blends an overlay RGB color over a base RGB color
 * according to the selected blend mode and opacity factor.
 *
 * @param base Base RGB components in [0, 1]
 * @param overlay Overlay RGB components in [0, 1]
 * @param opacity Blending opacity in [0, 1]
 * @param mode Blend mode: 'normal', 'multiply', or 'overlay'
 */
export function blendRgb(
  base: [r: number, g: number, b: number],
  overlay: [r: number, g: number, b: number],
  opacity: number,
  mode: BlendMode = 'normal'
): [r: number, g: number, b: number] {
  const alpha = Math.max(0, Math.min(1, opacity));
  if (alpha <= 0) {
    return [base[0], base[1], base[2]];
  }

  let rBlended = overlay[0];
  let gBlended = overlay[1];
  let bBlended = overlay[2];

  if (mode === 'multiply') {
    rBlended = base[0] * overlay[0];
    gBlended = base[1] * overlay[1];
    bBlended = base[2] * overlay[2];
  } else if (mode === 'overlay') {
    rBlended =
      base[0] < 0.5
        ? 2 * base[0] * overlay[0]
        : 1 - 2 * (1 - base[0]) * (1 - overlay[0]);
    gBlended =
      base[1] < 0.5
        ? 2 * base[1] * overlay[1]
        : 1 - 2 * (1 - base[1]) * (1 - overlay[1]);
    bBlended =
      base[2] < 0.5
        ? 2 * base[2] * overlay[2]
        : 1 - 2 * (1 - base[2]) * (1 - overlay[2]);
  }

  // Linear interpolation with opacity
  const r = Math.max(0, Math.min(1, base[0] * (1 - alpha) + rBlended * alpha));
  const g = Math.max(0, Math.min(1, base[1] * (1 - alpha) + gBlended * alpha));
  const b = Math.max(0, Math.min(1, base[2] * (1 - alpha) + bBlended * alpha));

  return [r, g, b];
}

