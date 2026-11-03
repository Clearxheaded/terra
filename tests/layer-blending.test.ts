import { describe, expect, it } from 'vitest';
import { blendRgb } from '@/features/analysis/blending';

describe('blendRgb (Cartographic Multi-Layer Blending)', () => {
  it('returns pure base color when opacity is 0', () => {
    const base: [number, number, number] = [0.2, 0.4, 0.6];
    const overlay: [number, number, number] = [0.9, 0.8, 0.7];

    const result = blendRgb(base, overlay, 0, 'normal');
    expect(result[0]).toBeCloseTo(0.2, 5);
    expect(result[1]).toBeCloseTo(0.4, 5);
    expect(result[2]).toBeCloseTo(0.6, 5);
  });

  it('returns pure overlay color when opacity is 1 in normal mode', () => {
    const base: [number, number, number] = [0.2, 0.4, 0.6];
    const overlay: [number, number, number] = [0.9, 0.8, 0.7];

    const result = blendRgb(base, overlay, 1, 'normal');
    expect(result[0]).toBeCloseTo(0.9, 5);
    expect(result[1]).toBeCloseTo(0.8, 5);
    expect(result[2]).toBeCloseTo(0.7, 5);
  });

  it('performs linear alpha interpolation in normal mode at 50% opacity', () => {
    const base: [number, number, number] = [0.0, 0.5, 1.0];
    const overlay: [number, number, number] = [1.0, 0.5, 0.0];

    const result = blendRgb(base, overlay, 0.5, 'normal');
    expect(result[0]).toBeCloseTo(0.5, 4);
    expect(result[1]).toBeCloseTo(0.5, 4);
    expect(result[2]).toBeCloseTo(0.5, 4);
  });

  it('performs multiply blending (base * overlay) to modulate shading', () => {
    // E.g. Base elevation green [0.2, 0.8, 0.2], hillshade shadow 0.5 [0.5, 0.5, 0.5]
    const base: [number, number, number] = [0.2, 0.8, 0.2];
    const overlay: [number, number, number] = [0.5, 0.5, 0.5];

    // At 100% multiply: [0.1, 0.4, 0.1]
    const result100 = blendRgb(base, overlay, 1.0, 'multiply');
    expect(result100[0]).toBeCloseTo(0.1, 4);
    expect(result100[1]).toBeCloseTo(0.4, 4);
    expect(result100[2]).toBeCloseTo(0.1, 4);

    // At 50% multiply: base * 0.5 + multiplied * 0.5 = 0.2 * 0.5 + 0.1 * 0.5 = 0.15
    const result50 = blendRgb(base, overlay, 0.5, 'multiply');
    expect(result50[0]).toBeCloseTo(0.15, 4);
    expect(result50[1]).toBeCloseTo(0.6, 4);
    expect(result50[2]).toBeCloseTo(0.15, 4);
  });

  it('performs overlay mode blending with contrast enhancement', () => {
    // Test base < 0.5 (multiply branch: 2 * base * overlay)
    const darkBase: [number, number, number] = [0.25, 0.25, 0.25];
    const overlay: [number, number, number] = [0.5, 0.5, 0.5];
    // 2 * 0.25 * 0.5 = 0.25
    const darkResult = blendRgb(darkBase, overlay, 1.0, 'overlay');
    expect(darkResult[0]).toBeCloseTo(0.25, 4);

    // Test base >= 0.5 (screen branch: 1 - 2*(1-base)*(1-overlay))
    const lightBase: [number, number, number] = [0.75, 0.75, 0.75];
    // 1 - 2 * (1 - 0.75) * (1 - 0.5) = 1 - 2 * 0.25 * 0.5 = 1 - 0.25 = 0.75
    const lightResult = blendRgb(lightBase, overlay, 1.0, 'overlay');
    expect(lightResult[0]).toBeCloseTo(0.75, 4);
  });

  it('clamps out-of-range opacity values gracefully', () => {
    const base: [number, number, number] = [0.2, 0.4, 0.6];
    const overlay: [number, number, number] = [0.8, 0.8, 0.8];

    // Negative opacity clamped to 0
    const neg = blendRgb(base, overlay, -0.5, 'normal');
    expect(neg[0]).toBeCloseTo(0.2, 5);

    // Opacity > 1 clamped to 1
    const over = blendRgb(base, overlay, 1.5, 'normal');
    expect(over[0]).toBeCloseTo(0.8, 5);
  });
});

