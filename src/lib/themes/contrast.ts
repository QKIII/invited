/**
 * Pure TypeScript WCAG 2.1 contrast and color accessibility utilities.
 */

const RGB_SHORT_HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4})$/i;
const RGB_LONG_HEX_RE = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Normalizes a hex color string (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with or without `#`)
 * to lowercase 6-digit `#rrggbb`. Returns `null` if invalid.
 */
export function normalizeHex(input: string | undefined | null): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

  const shortMatch = RGB_SHORT_HEX_RE.exec(withHash);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].slice(0, 3).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const longMatch = RGB_LONG_HEX_RE.exec(withHash);
  if (longMatch) {
    return `#${longMatch[1].slice(0, 6)}`.toLowerCase();
  }

  return null;
}

export function isValidHex(input: string | undefined | null): boolean {
  return normalizeHex(input) !== null;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
  );
}

function srgbToLinear(channel8Bit: number): number {
  const srgb = Math.max(0, Math.min(255, channel8Bit)) / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/**
 * Computes WCAG 2.1 relative luminance in `[0, 1]` for a hex color.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * Computes WCAG 2.1 contrast ratio in `[1, 21]` between two hex colors.
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Picks `#0b0f19` or `#ffffff` foreground achieving optimal WCAG contrast (>= 4.5 for non-midtone backgrounds)
 * on top of `bgHex`.
 */
export function pickAccessibleForeground(bgHex: string): '#0b0f19' | '#ffffff' {
  const darkText = '#0b0f19';
  const lightText = '#ffffff';
  const darkRatio = contrastRatio(bgHex, darkText);
  const lightRatio = contrastRatio(bgHex, lightText);

  if (lightRatio >= 4.5 && darkRatio < 4.5) {
    return lightText;
  }
  if (darkRatio >= 4.5 && lightRatio < 4.5) {
    return darkText;
  }
  return lightRatio >= darkRatio ? lightText : darkText;
}

/**
 * Linearly blends two hex colors (`t = 0` -> `hexA`, `t = 1` -> `hexB`).
 */
export function mixHex(hexA: string, hexB: string, t: number): string {
  const weight = Math.max(0, Math.min(1, t));
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex({
    r: a.r + (b.r - a.r) * weight,
    g: a.g + (b.g - a.g) * weight,
    b: a.b + (b.b - a.b) * weight,
  });
}

/**
 * Adjusts `accentHex` toward white (on dark surfaces) or `#0b0f19` (on light surfaces)
 * until it reaches at least `minRatio` contrast against `surfaceHex`.
 */
export function ensureReadableAccentOnSurface(
  accentHex: string,
  surfaceHex: string,
  minRatio = 3,
): string {
  const normalizedAccent = normalizeHex(accentHex) ?? '#6366f1';
  const normalizedSurface = normalizeHex(surfaceHex) ?? '#0b0f19';

  if (contrastRatio(normalizedAccent, normalizedSurface) >= minRatio) {
    return normalizedAccent;
  }

  const surfaceLum = relativeLuminance(normalizedSurface);
  const target = surfaceLum < 0.35 ? '#ffffff' : '#0b0f19';

  // Binary search the minimal mix factor toward target that satisfies minRatio.
  let low = 0;
  let high = 1;
  let best = target;

  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    const candidate = mixHex(normalizedAccent, target, mid);
    if (contrastRatio(candidate, normalizedSurface) >= minRatio) {
      best = candidate;
      high = mid;
    } else {
      low = mid;
    }
  }

  return contrastRatio(best, normalizedSurface) >= minRatio ? best : target;
}
