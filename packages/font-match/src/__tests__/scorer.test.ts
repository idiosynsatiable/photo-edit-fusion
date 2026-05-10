import { describe, it, expect } from 'vitest';
import { rankFonts } from '../scorer.js';

describe('rankFonts', () => {
  it('returns empty list when no glyphs measured', () => {
    expect(rankFonts({ strokeDensity: 0, italicAngle: 0, aspectRatio: 0, glyphCount: 0 })).toEqual([]);
  });

  it('returns at most topN entries', () => {
    const r = rankFonts({ strokeDensity: 0.13, italicAngle: 0, aspectRatio: 0.55, glyphCount: 4 }, 5);
    expect(r.length).toBe(5);
    expect(r[0]!.score).toBeGreaterThanOrEqual(r[1]!.score);
  });

  it('handwriting features rank handwriting category higher than mono', () => {
    const r = rankFonts({ strokeDensity: 0.16, italicAngle: 0.18, aspectRatio: 0.7, glyphCount: 8 });
    // Pacifico should be near the top
    const cats = r.slice(0, 5).map((s) => s.entry.category);
    expect(cats).toContain('handwriting');
  });
});
