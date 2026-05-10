import type { FontMatch, FontMatchResult } from '@pef/shared';
import type { FontIdProvider, FontIdProviderInput } from '../provider.js';
import { densityToWeight } from '../metrics.js';

export interface FontspringConfig {
  apiKey: string | undefined;
  apiUrl: string;
  fetchImpl?: typeof fetch;
}

interface FontspringApiMatch {
  family?: string;
  name?: string;
  score?: number;
  url?: string;
  preview?: string;
}

interface FontspringApiResponse {
  results?: FontspringApiMatch[];
}

/** Adapter for Fontspring's Matcherator API. Used as the secondary provider. */
export class FontspringProvider implements FontIdProvider {
  readonly name = 'fontspring' as const;
  constructor(private cfg: FontspringConfig) {}

  isAvailable(): boolean {
    return !!this.cfg.apiKey && this.cfg.apiKey.length > 0;
  }

  async identify(input: FontIdProviderInput): Promise<FontMatchResult> {
    if (!this.isAvailable()) throw new Error('Fontspring API key not configured');
    const f = this.cfg.fetchImpl ?? fetch;
    const start = Date.now();

    const form = new FormData();
    form.append(
      'image',
      new Blob([input.imageBytes as BlobPart], { type: input.contentType }),
      'crop.png',
    );

    const res = await f(this.cfg.apiUrl, {
      method: 'POST',
      headers: {
        'X-Fontspring-API-Key': this.cfg.apiKey ?? '',
        Accept: 'application/json',
      },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fontspring upstream ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as FontspringApiResponse;
    const matches = (json.results ?? []).slice(0, input.maxResults ?? 10).map<FontMatch>((m) => ({
      family: m.family ?? m.name ?? 'Unknown',
      score: typeof m.score === 'number' ? m.score : 0,
      source: 'fontspring',
      googleFontsUrl: m.url ?? undefined,
      sampleUrl: m.preview ?? undefined,
      fallbacks: ['system-ui', 'serif'],
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
      provider: 'fontspring',
      durationMs: Date.now() - start,
    };
  }
}
