import type { FontMatch, FontMatchResult } from '@pef/shared';
import type { FontIdProvider, FontIdProviderInput } from '../provider.js';
import { rankFonts } from '../scorer.js';
import { densityToWeight } from '../metrics.js';
import { googleFontsCssUrl } from '../google-fonts.js';

/**
 * Offline fallback provider: ranks Google Fonts catalog by feature similarity.
 * Always available — no API key required.
 */
export class LocalSimilarityProvider implements FontIdProvider {
  readonly name = 'google-fonts-similarity' as const;

  isAvailable(): boolean {
    return true;
  }

  async identify(input: FontIdProviderInput): Promise<FontMatchResult> {
    const start = Date.now();
    const ranked = rankFonts(input.features, input.maxResults ?? 10);
    const matches: FontMatch[] = ranked.map((r) => ({
      family: r.entry.family,
      score: r.score,
      weight: densityToWeight(input.features.strokeDensity),
      style: input.features.italicAngle > 0.08 ? 'italic' : 'normal',
      source: 'google-fonts-similarity',
      googleFontsUrl: googleFontsCssUrl(
        r.entry.family,
        r.entry.weights.includes(700) ? [400, 700] : r.entry.weights.slice(0, 2),
      ),
      fallbacks: r.entry.fallbacks,
    }));
    return {
      matches,
      metrics: {
        estimatedWeight: densityToWeight(input.features.strokeDensity),
        estimatedItalic: Math.abs(input.features.italicAngle) > 0.08,
        estimatedSizePx: 0,
        estimatedTrackingEm: 0,
        medianGlyphAspect: input.features.aspectRatio,
        sampleText: input.sampleText,
      },
      provider: 'google-fonts-similarity',
      durationMs: Date.now() - start,
    };
  }
}
