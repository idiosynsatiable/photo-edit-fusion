import { describe, it, expect } from 'vitest';
import { GOOGLE_FONTS, googleFontsCssUrl } from '../google-fonts.js';

describe('google-fonts catalog', () => {
  it('has at least 25 fonts', () => {
    expect(GOOGLE_FONTS.length).toBeGreaterThanOrEqual(25);
  });

  it('every font has weights and fallbacks', () => {
    for (const f of GOOGLE_FONTS) {
      expect(f.weights.length).toBeGreaterThan(0);
      expect(f.fallbacks.length).toBeGreaterThan(0);
    }
  });
});

describe('googleFontsCssUrl', () => {
  it('builds non-italic url', () => {
    const url = googleFontsCssUrl('Inter', [400, 700]);
    expect(url).toContain('Inter');
    expect(url).toContain('wght@400;700');
  });

  it('builds italic axis url', () => {
    const url = googleFontsCssUrl('Lora', [400], true);
    expect(url).toContain('ital,wght');
  });
});
