import type { FastifyInstance } from 'fastify';
import { AiCutRequestSchema, integrationDisabled, type ApiError } from '@pef/shared';

interface AiCutResult {
  cutoutPngDataUrl: string;
  maskPngDataUrl: string;
  provider: 'local-onnx' | 'remove-bg';
  durationMs: number;
}

/**
 * POST /api/ai-cut
 *
 * The local-onnx provider runs in the browser via Web Worker (no server
 * dependency). The server-side provider is Remove.bg, used when REMOVE_BG_API_KEY
 * is set. If a request explicitly asks for local-onnx, we return a structured
 * 503 telling the client to perform the cut locally.
 */
export async function aiCutRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/ai-cut', async (req, reply) => {
    const parse = AiCutRequestSchema.safeParse(req.body);
    if (!parse.success) {
      const err: ApiError = {
        error: 'validation_error',
        details: parse.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
      return reply.status(400).send(err);
    }
    const body = parse.data;

    if (body.preferProvider === 'local-onnx') {
      // Tell client to handle locally. This is not an error per se but a
      // structured 200 with a sentinel provider so the client can dispatch
      // to its in-browser ONNX worker.
      return reply.status(200).send({ provider: 'local-onnx', delegateToClient: true });
    }

    if (!app.config.REMOVE_BG_API_KEY) {
      return reply.status(503).send(integrationDisabled('remove-bg', 'REMOVE_BG_API_KEY'));
    }

    const start = Date.now();
    try {
      const buf = decodeBase64(body.imageBase64);
      if (!buf) {
        const err: ApiError = {
          error: 'validation_error',
          details: [{ path: 'imageBase64', message: 'invalid base64 payload' }],
        };
        return reply.status(400).send(err);
      }
      const form = new FormData();
      form.append(
        'image_file',
        new Blob([new Uint8Array(buf)], { type: 'image/png' }),
        'input.png',
      );
      form.append('size', 'auto');
      form.append('format', 'png');

      const upstream = await fetch(app.config.REMOVE_BG_API_URL, {
        method: 'POST',
        headers: { 'X-Api-Key': app.config.REMOVE_BG_API_KEY },
        body: form,
      });
      if (!upstream.ok) {
        const text = await upstream.text();
        const err: ApiError = {
          error: 'upstream_error',
          integration: 'remove-bg',
          status: upstream.status,
          message: text.slice(0, 300),
        };
        return reply.status(502).send(err);
      }
      const arr = new Uint8Array(await upstream.arrayBuffer());
      const cutoutPngDataUrl = `data:image/png;base64,${Buffer.from(arr).toString('base64')}`;
      const result: AiCutResult = {
        cutoutPngDataUrl,
        // Remove.bg returns the matted cutout; the alpha channel IS the mask.
        // Clients can extract a grayscale mask from the alpha if needed.
        maskPngDataUrl: cutoutPngDataUrl,
        provider: 'remove-bg',
        durationMs: Date.now() - start,
      };
      return reply.status(200).send(result);
    } catch (err) {
      const apiErr: ApiError = {
        error: 'upstream_error',
        integration: 'remove-bg',
        status: 502,
        message: String(err).slice(0, 300),
      };
      return reply.status(502).send(apiErr);
    }
  });
}

function decodeBase64(s: string): Uint8Array | null {
  try {
    const i = s.indexOf(',');
    const payload = i !== -1 && s.slice(0, i).startsWith('data:') ? s.slice(i + 1) : s;
    return Uint8Array.from(Buffer.from(payload, 'base64'));
  } catch {
    return null;
  }
}
