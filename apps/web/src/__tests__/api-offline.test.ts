import { afterEach, describe, expect, it, vi } from 'vitest';
import { getIntegrations, postAiCut } from '../lib/api.js';

describe('offline API fallbacks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('delegates AI Cut to the on-device fallback when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(postAiCut('data:image/png;base64,AA==')).resolves.toEqual({
      provider: 'local-onnx',
      delegateToClient: true,
    });
  });

  it('does not make integration status fatal when the optional server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getIntegrations()).resolves.toEqual([]);
  });
});
