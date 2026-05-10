/**
 * Canonical list of supported blend modes. Order is the order shown in the UI.
 * Each mode has both a WebGL fragment-shader implementation (in @pef/filters)
 * and a Canvas2D globalCompositeOperation fallback.
 */

export const BLEND_MODES = [
  'normal',
  'dissolve',
  'darken',
  'multiply',
  'color-burn',
  'linear-burn',
  'darker-color',
  'lighten',
  'screen',
  'color-dodge',
  'linear-dodge',
  'lighter-color',
  'overlay',
  'soft-light',
  'hard-light',
  'vivid-light',
  'linear-light',
  'pin-light',
  'hard-mix',
  'difference',
  'exclusion',
  'subtract',
  'divide',
  'hue',
  'saturation',
  'color',
  'luminosity',
] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

/**
 * Map blend modes to the Canvas2D globalCompositeOperation that is the closest
 * native equivalent. Modes with no native equivalent map to 'source-over' and
 * MUST be rendered through the WebGL path.
 */
export const CANVAS2D_FALLBACK: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  dissolve: 'source-over',
  darken: 'darken',
  multiply: 'multiply',
  'color-burn': 'color-burn',
  'linear-burn': 'multiply',
  'darker-color': 'darken',
  lighten: 'lighten',
  screen: 'screen',
  'color-dodge': 'color-dodge',
  'linear-dodge': 'lighter',
  'lighter-color': 'lighten',
  overlay: 'overlay',
  'soft-light': 'soft-light',
  'hard-light': 'hard-light',
  'vivid-light': 'overlay',
  'linear-light': 'overlay',
  'pin-light': 'overlay',
  'hard-mix': 'overlay',
  difference: 'difference',
  exclusion: 'exclusion',
  subtract: 'difference',
  divide: 'source-over',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

export const WEBGL_REQUIRED: ReadonlySet<BlendMode> = new Set<BlendMode>([
  'dissolve',
  'linear-burn',
  'darker-color',
  'linear-dodge',
  'lighter-color',
  'vivid-light',
  'linear-light',
  'pin-light',
  'hard-mix',
  'subtract',
  'divide',
]);

export function isBlendMode(v: unknown): v is BlendMode {
  return typeof v === 'string' && (BLEND_MODES as readonly string[]).includes(v);
}
