import type { BlendMode } from '@pef/shared';

/**
 * Reference Photoshop blend formulas. Each function takes base ("b") and source
 * ("s") components in [0,1] and returns the blended component.
 *
 * `blendFragmentForMode` returns a snippet of GLSL that defines:
 *   vec3 blendRGB(vec3 b, vec3 s) { ... }
 *
 * The complete fragment shader concatenates the snippet with main().
 */

export function blendFragmentForMode(mode: BlendMode): string {
  switch (mode) {
    case 'normal':
      return `vec3 blendRGB(vec3 b, vec3 s) { return s; }`;
    case 'dissolve':
      // dissolve uses random per-pixel; main() handles alpha-as-probability
      return `
        float rand2(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
        vec3 blendRGB(vec3 b, vec3 s) { return s; }`;
    case 'darken':
      return `vec3 blendRGB(vec3 b, vec3 s) { return min(b, s); }`;
    case 'multiply':
      return `vec3 blendRGB(vec3 b, vec3 s) { return b * s; }`;
    case 'color-burn':
      return `vec3 blendRGB(vec3 b, vec3 s) {
        return mix(vec3(0.0), 1.0 - min(vec3(1.0), (1.0 - b) / max(s, vec3(1e-5))), step(vec3(1e-5), s));
      }`;
    case 'linear-burn':
      return `vec3 blendRGB(vec3 b, vec3 s) { return max(b + s - 1.0, 0.0); }`;
    case 'darker-color': {
      // luminance-based per-pixel comparison
      return `
        float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        vec3 blendRGB(vec3 b, vec3 s) { return lum(s) < lum(b) ? s : b; }`;
    }
    case 'lighten':
      return `vec3 blendRGB(vec3 b, vec3 s) { return max(b, s); }`;
    case 'screen':
      return `vec3 blendRGB(vec3 b, vec3 s) { return 1.0 - (1.0 - b) * (1.0 - s); }`;
    case 'color-dodge':
      return `vec3 blendRGB(vec3 b, vec3 s) {
        return mix(vec3(1.0), min(vec3(1.0), b / max(1.0 - s, vec3(1e-5))), step(s, vec3(1.0 - 1e-5)));
      }`;
    case 'linear-dodge':
      return `vec3 blendRGB(vec3 b, vec3 s) { return min(b + s, 1.0); }`;
    case 'lighter-color':
      return `
        float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        vec3 blendRGB(vec3 b, vec3 s) { return lum(s) > lum(b) ? s : b; }`;
    case 'overlay':
      return `vec3 blendRGB(vec3 b, vec3 s) {
        return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));
      }`;
    case 'soft-light':
      // Photoshop / W3C formula
      return `vec3 blendRGB(vec3 b, vec3 s) {
        vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));
        return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
      }`;
    case 'hard-light':
      return `vec3 blendRGB(vec3 b, vec3 s) {
        return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, s));
      }`;
    case 'vivid-light':
      return `vec3 blendRGB(vec3 b, vec3 s) {
        vec3 burn = mix(vec3(0.0), 1.0 - (1.0 - b) / max(2.0 * s, vec3(1e-5)), step(vec3(1e-5), s));
        vec3 dodge = mix(vec3(1.0), b / max(1.0 - 2.0 * (s - 0.5), vec3(1e-5)), step(s, vec3(1.0 - 1e-5)));
        return mix(burn, dodge, step(0.5, s));
      }`;
    case 'linear-light':
      return `vec3 blendRGB(vec3 b, vec3 s) { return clamp(b + 2.0 * s - 1.0, 0.0, 1.0); }`;
    case 'pin-light':
      return `vec3 blendRGB(vec3 b, vec3 s) {
        vec3 lo = min(b, 2.0 * s);
        vec3 hi = max(b, 2.0 * s - 1.0);
        return mix(lo, hi, step(0.5, s));
      }`;
    case 'hard-mix':
      return `vec3 blendRGB(vec3 b, vec3 s) { return step(1.0, b + s); }`;
    case 'difference':
      return `vec3 blendRGB(vec3 b, vec3 s) { return abs(b - s); }`;
    case 'exclusion':
      return `vec3 blendRGB(vec3 b, vec3 s) { return b + s - 2.0 * b * s; }`;
    case 'subtract':
      return `vec3 blendRGB(vec3 b, vec3 s) { return max(b - s, 0.0); }`;
    case 'divide':
      return `vec3 blendRGB(vec3 b, vec3 s) { return min(b / max(s, vec3(1e-5)), 1.0); }`;
    case 'hue':
    case 'saturation':
    case 'color':
    case 'luminosity':
      return hslBlendShaderSnippet(mode);
  }
}

function hslBlendShaderSnippet(mode: 'hue' | 'saturation' | 'color' | 'luminosity'): string {
  const common = `
    float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
    float sat(vec3 c){
      float mx = max(c.r, max(c.g, c.b));
      float mn = min(c.r, min(c.g, c.b));
      return mx - mn;
    }
    vec3 clipColor(vec3 c){
      float l = lum(c);
      float n = min(c.r, min(c.g, c.b));
      float x = max(c.r, max(c.g, c.b));
      if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-5);
      if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-5);
      return c;
    }
    vec3 setLum(vec3 c, float l){
      float d = l - lum(c);
      return clipColor(c + d);
    }
    vec3 setSat(vec3 c, float s){
      float mx = max(c.r, max(c.g, c.b));
      float mn = min(c.r, min(c.g, c.b));
      vec3 r = vec3(0.0);
      if (mx > mn) r = (c - mn) * s / (mx - mn);
      return r;
    }`;
  switch (mode) {
    case 'hue':
      return `${common}
        vec3 blendRGB(vec3 b, vec3 s) { return setLum(setSat(s, sat(b)), lum(b)); }`;
    case 'saturation':
      return `${common}
        vec3 blendRGB(vec3 b, vec3 s) { return setLum(setSat(b, sat(s)), lum(b)); }`;
    case 'color':
      return `${common}
        vec3 blendRGB(vec3 b, vec3 s) { return setLum(s, lum(b)); }`;
    case 'luminosity':
      return `${common}
        vec3 blendRGB(vec3 b, vec3 s) { return setLum(b, lum(s)); }`;
  }
}

export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function buildFragmentShader(mode: BlendMode): string {
  const snippet = blendFragmentForMode(mode);
  const isDissolve = mode === 'dissolve';
  return `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_base;
uniform sampler2D u_src;
uniform float u_opacity;
out vec4 outColor;
${snippet}
void main() {
  vec4 b = texture(u_base, v_uv);
  vec4 s = texture(u_src, v_uv);
  ${
    isDissolve
      ? `
    float r = rand2(v_uv * 4096.0);
    float keep = step(r, s.a * u_opacity);
    outColor = mix(b, vec4(s.rgb, 1.0), keep);
    return;`
      : ''
  }
  vec3 blended = blendRGB(b.rgb, s.rgb);
  float a = s.a * u_opacity;
  outColor = vec4(b.rgb * (1.0 - a) + blended * a, max(b.a, a));
}`;
}
