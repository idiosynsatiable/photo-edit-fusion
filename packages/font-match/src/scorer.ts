import type { GlyphFeatures } from './metrics.js';
import { GOOGLE_FONTS, type GoogleFontEntry } from './google-fonts.js';

export interface ScoredFont {
  entry: GoogleFontEntry;
  score: number; // 0..1, higher = better match
}

/**
 * Rank Google Fonts entries against extracted glyph features. Returns the
 * top-N fonts by similarity. Used as the offline fallback when no font-ID
 * API key is configured, and as a sanity-check against API responses.
 */
export function rankFonts(features: GlyphFeatures, topN = 10): ScoredFont[] {
  if (features.glyphCount === 0) return [];
  const scored: ScoredFont[] = GOOGLE_FONTS.map((entry) => ({
    entry,
    score: similarity(features, entry),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

function similarity(f: GlyphFeatures, e: { density: number; aspect: number; italic: number }): number {
  const dDensity = (f.strokeDensity - e.density) / 0.3;
  const dAspect = (f.aspectRatio - e.aspect) / 1.0;
  const dItalic = (f.italicAngle - e.italic) / 0.3;
  const dist = Math.sqrt(dDensity * dDensity + dAspect * dAspect + dItalic * dItalic);
  // map distance to 0..1; lower distance = higher score
  return Math.max(0, 1 - dist);
}
