import { describe, it, expect } from 'vitest';
import { BLEND_MODES } from '@pef/shared';
import { buildFragmentShader } from '../blend-shaders.js';

describe('blend-shaders', () => {
  it('produces a fragment shader for every blend mode', () => {
    for (const m of BLEND_MODES) {
      const src = buildFragmentShader(m);
      expect(src).toContain('#version 300 es');
      expect(src).toContain('void main()');
      expect(src).toContain('blendRGB');
    }
  });
});
