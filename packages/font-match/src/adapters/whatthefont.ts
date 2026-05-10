import type { FontMatch, FontMatchResult } from '@pef/shared';
import type { FontIdProvider, FontIdProviderInput } from '../provider.js';
import { densityToWeight } from '../metrics.js';

export interface WhatTheFontConfig {
  apiKey: string | undefined;
  apiUrl: string;
  /** for testability: override fetch */
  fetchImpl?: typeof fetch;
}

interface WhatTheFontApiMatch {
  font_id?: string;
  family_name?: string;
  weight?: string;
  style?: string;
  url?: string;
  preview_url?: string;
  confidence?: number;
}

interface WhatTheFontApiResponse {
  matches?: WhatTheFontApiMatch[];
}

/**
 * Adapter for the WhatTheFont (MyFonts) HTTP API. The exact response shape
 * varies; this adapter is defensive about missing fields and degrades to
 * sensible defaults rather than throwing.
 */
export class WhatTheFontProvider implements FontIdProvider {
  readonly name = 'whatthefont' as const;
  constructor(private cfg: WhatTheFontConfig) {}

  isAvailable(): boolean {
    return !!this.cfg.apiKey && this.cfg.apiKey.length > 0;
  }

  async identify(input: FontIdProviderInput): Promise<FontMatchResult> {
    if (!this.isAvailable()) throw new Error('WhatTheFont API key not configured');
    const f = this.cfg.fetchImpl ?? fetch;
    const start = Date.now();

    const form = new FormData();
    form.append(
      'image',
      new Blob([new Uint8Array(input.imageBytes)], { type: input.contentType }),
      'crop.png',
    );
    form.append('limit', String(input.maxResults ?? 10));

    const res = await f(this.cfg.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        Accept: 'application/json',
      },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WhatTheFont upstream ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as WhatTheFontApiResponse;
    const matches = (json.matches ?? []).map<FontMatch>((m) => ({
      family: m.family_name ?? 'Unknown',
      score: typeof m.confidence === 'number' ? m.confidence : 0,
      weight: parseWeight(m.weight),
      style: m.style?.toLowerCase().includes('italic') ? 'italic' : 'normal',
      source: 'whatthefont',
      googleFontsUrl: m.url ?? undefined,
      sampleUrl: m.preview_url ?? undefined,
      fallbacks: ['system-ui', 'sans-serif'],
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
      provider: 'whatthefont',
      durationMs: Date.now() - start,
    };
  }
}

function parseWeight(w: string | undefined): number | undefined {
  if (!w) return undefined;
  const n = Number(w);
  if (!Number.isNaN(n)) return Math.max(100, Math.min(900, Math.round(n / 100) * 100));
  const lower = w.toLowerCase();
  if (lower.includes('thin')) return 100;
  if (lower.includes('extralight') || lower.includes('extra-light')) return 200;
  if (lower.includes('light')) return 300;
  if (lower.includes('regular') || lower === 'normal' || lower === 'book') return 400;
  if (lower.includes('medium')) return 500;
  if (lower.includes('semi') || lower.includes('demi')) return 600;
  if (lower.includes('bold') && !lower.includes('extra')) return 700;
  if (lower.includes('extrabold') || lower.includes('extra-bold')) return 800;
  if (lower.includes('black') || lower.includes('heavy')) return 900;
  return undefined;
}
