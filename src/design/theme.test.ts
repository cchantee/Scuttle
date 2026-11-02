import { describe, expect, it } from 'vitest';
import { colors } from './theme';
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(part => parseInt(part, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
describe('brand text contrast', () => {
  it.each([
    ['body on paper', colors.text, colors.paper], ['body on surface', colors.text, colors.surface],
    ['muted on paper', colors.muted, colors.paper], ['muted on subtle', colors.muted, colors.subtle],
    ['primary button', colors.onPrimary, colors.teal], ['selected controls', colors.onPrimary, colors.evergreen],
    ['hero heading', colors.paper, colors.evergreen], ['hero detail', colors.mutedOnDark, colors.evergreen],
    ['lime label', colors.evergreen, colors.lime], ['error', colors.danger, colors.dangerSurface],
    ['teal label', colors.teal, colors.paper],
  ])('%s exceeds 4.5:1 for normal text', (_label, foreground, background) => expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5));
});
