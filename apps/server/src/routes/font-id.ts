import type { FastifyInstance } from 'fastify';
import { FontIdentifyRequestSchema, integrationDisabled, type ApiError } from '@pef/shared';
import {
  WhatTheFontProvider,
  FontspringProvider,
  type FontIdProvider,
} from '@pef/font-match';

/**
 * POST /api/font-id
 * Body: { imageBase64, hints? }
 * Returns: FontMatchResult or ApiError
 *
 * Decision logic:
 *   - If hints.preferProvider is set, use that provider if available, else fall through.
 *   - Default order: WhatTheFont → Fontspring. Local visual fitting is browser-side.
 *   - Any provider failure falls through to the next.
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

    // Remote providers receive image bytes; visual fitting runs in the editor.
    const features = { strokeDensity: 0, italicAngle: 0, aspectRatio: 0, glyphCount: 0 };

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

    // Report configured-provider failures rather than inventing image-specific matches.
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
  if (prefer === 'fontspring') return [fs, wtf];
  if (prefer === 'whatthefont') return [wtf, fs];
  return [wtf, fs];
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

