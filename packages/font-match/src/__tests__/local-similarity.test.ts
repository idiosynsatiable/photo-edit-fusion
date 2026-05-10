import { describe, it, expect } from 'vitest';
import { LocalSimilarityProvider } from '../adapters/local-similarity.js';

describe('LocalSimilarityProvider', () => {
  const p = new LocalSimilarityProvider();
  it('is always available', () => {
    expect(p.isAvailable()).toBe(true);
  });

  it('returns matches for valid features', async () => {
    const result = await p.identify({
      imageBytes: new Uint8Array(),
      contentType: 'image/png',
      sampleText: 'Hello',
      features: { strokeDensity: 0.13, italicAngle: 0, aspectRatio: 0.55, glyphCount: 5 },
    });
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.provider).toBe('google-fonts-similarity');
    expect(result.metrics.sampleText).toBe('Hello');
  });
});
