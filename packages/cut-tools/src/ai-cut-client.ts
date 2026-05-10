import type { ApiError } from '@pef/shared';

export interface AiCutResult {
  /** PNG data URL of the cutout (foreground only, alpha matted) */
  cutoutPngDataUrl: string;
  /** raw alpha mask data URL (8-bit grayscale PNG) */
  maskPngDataUrl: string;
  provider: 'local-onnx' | 'remove-bg';
  durationMs: number;
}

export interface AiCutClient {
  cut(opts: { imageBase64: string; signal?: AbortSignal }): Promise<AiCutResult | ApiError>;
}

/**
 * Thin client over the server's /api/ai-cut route. The server decides which
 * provider is used (local-onnx by default, Remove.bg if a key is set).
 */
export function createHttpAiCutClient(baseUrl: string): AiCutClient {
  return {
    async cut(opts) {
      const res = await fetch(`${baseUrl}/api/ai-cut`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: opts.imageBase64 }),
        signal: opts.signal,
      });
      const json = (await res.json()) as AiCutResult | ApiError;
      return json;
    },
  };
}
