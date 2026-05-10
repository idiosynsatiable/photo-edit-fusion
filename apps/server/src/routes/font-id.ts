import type { FastifyInstance } from 'fastify';
import { FontIdentifyRequestSchema, integrationDisabled, type ApiError } from '@pef/shared';
import {
  WhatTheFontProvider,
  FontspringProvider,
  LocalSimilarityProvider,
  binarizeOtsu,
  extractFeatures,
  type FontIdProvider,
} from '@pef/font-match';

/**
 * POST /api/font-id
 * Body: { imageBase64, hints? }
 * Returns: FontMatchResult or ApiError
 *
 * Decision logic:
 *   - If hints.preferProvider is set, use that provider if available, else fall through.
 *   - Default order: WhatTheFont → Fontspring → local-similarity.
 *   - Any provider failure falls through to the next.
 *   - Local similarity is always available, so the route never returns 503 for the
 *     "all integrations missing" case — it returns a structured 200 with provider:
 *     'google-fonts-similarity' so the UI can show a banner.
 */
export async function fontIdRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/font-id', async (req, reply) => {
    const parse = FontIdentifyRequestSchema.safeParse(req.body);
    if (!parse.success) {
      const err: ApiError = {
        error: 'validation_error',
        details: parse.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
      return reply.status(400).send(err);
    }
    const body = parse.data;
    const maxResults = body.hints?.maxResults ?? 10;

    // decode base64
    const buf = decodeBase64(body.imageBase64);
    if (!buf) {
      const err: ApiError = {
        error: 'validation_error',
        details: [{ path: 'imageBase64', message: 'invalid base64 payload' }],
      };
      return reply.status(400).send(err);
    }

    // We don't decode image dimensions server-side here — the client passes a pre-cropped
    // PNG, and we forward the bytes. Feature extraction is best-effort: if image-decoder
    // unavailable, extractor returns zero features and the local provider still ranks
    // by category defaults.
    const features = await safeExtractFeatures(buf);

    const providers: FontIdProvider[] = providerChain(app, body.hints?.preferProvider);

    let lastError: unknown = null;
    for (const p of providers) {
      if (!p.isAvailable()) continue;
      try {
        const result = await p.identify({
          imageBytes: buf,
          contentType: 'image/png',
          sampleText: '',
          features,
          maxResults,
        });
        return reply.status(200).send(result);
      } catch (err) {
        lastError = err;
        app.log.warn({ provider: p.name, err: String(err) }, 'font-id provider failed, falling through');
      }
    }

    // unreachable in practice (LocalSimilarityProvider.isAvailable() === true) but defensive
    if (lastError) {
      const err: ApiError = {
        error: 'upstream_error',
        integration: 'font-id',
        status: 502,
        message: String(lastError).slice(0, 300),
      };
      return reply.status(502).send(err);
    }
    return reply
      .status(503)
      .send(integrationDisabled('font-id', 'WHATTHEFONT_API_KEY/FONTSPRING_API_KEY'));
  });
}

function providerChain(app: FastifyInstance, prefer?: 'whatthefont' | 'fontspring' | 'auto'): FontIdProvider[] {
  const wtf = new WhatTheFontProvider({
    apiKey: app.config.WHATTHEFONT_API_KEY,
    apiUrl: app.config.WHATTHEFONT_API_URL,
  });
  const fs = new FontspringProvider({
    apiKey: app.config.FONTSPRING_API_KEY,
    apiUrl: app.config.FONTSPRING_API_URL,
  });
  const local = new LocalSimilarityProvider();
  if (prefer === 'fontspring') return [fs, wtf, local];
  if (prefer === 'whatthefont') return [wtf, fs, local];
  return [wtf, fs, local];
}

function decodeBase64(s: string): Uint8Array | null {
  try {
    // strip data URL prefix if present
    const i = s.indexOf(',');
    const payload = i !== -1 && s.slice(0, i).startsWith('data:') ? s.slice(i + 1) : s;
    return Uint8Array.from(Buffer.from(payload, 'base64'));
  } catch {
    return null;
  }
}

/**
 * Server-side feature extraction. Without a native image decoder we cannot
 * binarize the image bytes directly; for now this returns the zero-features
 * record so the local provider still produces a ranked list based on the
 * Google Fonts catalog priors. Browsers running the same logic via the
 * font-match package's binarizeOtsu/extractFeatures get the full pipeline.
 */
async function safeExtractFeatures(_buf: Uint8Array): Promise<{
  strokeDensity: number;
  italicAngle: number;
  aspectRatio: number;
  glyphCount: number;
}> {
  // Default priors approximate a regular sans-serif, used when the client
  // hasn't supplied features. The web client computes real features and can
  // ship them via a future hints field.
  return { strokeDensity: 0.13, italicAngle: 0, aspectRatio: 0.55, glyphCount: 5 };
}

// keep binarize import alive for tree-shaking
void binarizeOtsu;
void extractFeatures;
