/**
 * Curated subset of the Google Fonts catalog with measured features. Real font
 * identification needs an API; this database is the offline fallback used when
 * no API key is configured. Feature values are normalized into the same space
 * as `extractFeatures()` (strokeDensity 0..0.3, aspectRatio 0..2, italicAngle
 * radians) so direct distance comparisons are meaningful.
 */

export interface GoogleFontEntry {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  /** representative regular-weight stroke density */
  density: number;
  /** representative regular-weight aspect ratio of glyph bbox */
  aspect: number;
  /** italic angle in radians (0 if upright by default) */
  italic: number;
  /** weights available */
  weights: number[];
  /** suggested CSS fallback stack */
  fallbacks: string[];
}

export const GOOGLE_FONTS: GoogleFontEntry[] = [
  { family: 'Inter', category: 'sans-serif', density: 0.13, aspect: 0.55, italic: 0, weights: [100,200,300,400,500,600,700,800,900], fallbacks: ['system-ui','-apple-system','Segoe UI','sans-serif'] },
  { family: 'Roboto', category: 'sans-serif', density: 0.135, aspect: 0.54, italic: 0, weights: [100,300,400,500,700,900], fallbacks: ['system-ui','sans-serif'] },
  { family: 'Open Sans', category: 'sans-serif', density: 0.14, aspect: 0.55, italic: 0, weights: [300,400,500,600,700,800], fallbacks: ['Helvetica','Arial','sans-serif'] },
  { family: 'Lato', category: 'sans-serif', density: 0.13, aspect: 0.56, italic: 0, weights: [100,300,400,700,900], fallbacks: ['Helvetica','Arial','sans-serif'] },
  { family: 'Montserrat', category: 'sans-serif', density: 0.155, aspect: 0.6, italic: 0, weights: [100,200,300,400,500,600,700,800,900], fallbacks: ['Helvetica','Arial','sans-serif'] },
  { family: 'Poppins', category: 'sans-serif', density: 0.14, aspect: 0.6, italic: 0, weights: [100,200,300,400,500,600,700,800,900], fallbacks: ['Helvetica','Arial','sans-serif'] },
  { family: 'Raleway', category: 'sans-serif', density: 0.115, aspect: 0.6, italic: 0, weights: [100,200,300,400,500,600,700,800,900], fallbacks: ['Helvetica','Arial','sans-serif'] },
  { family: 'Nunito', category: 'sans-serif', density: 0.145, aspect: 0.55, italic: 0, weights: [200,300,400,500,600,700,800,900], fallbacks: ['Helvetica','Arial','sans-serif'] },
  { family: 'Source Sans 3', category: 'sans-serif', density: 0.12, aspect: 0.55, italic: 0, weights: [200,300,400,500,600,700,800,900], fallbacks: ['Helvetica','Arial','sans-serif'] },
  { family: 'Work Sans', category: 'sans-serif', density: 0.13, aspect: 0.56, italic: 0, weights: [100,200,300,400,500,600,700,800,900], fallbacks: ['Helvetica','Arial','sans-serif'] },
  { family: 'Oswald', category: 'sans-serif', density: 0.16, aspect: 0.42, italic: 0, weights: [200,300,400,500,600,700], fallbacks: ['Impact','sans-serif'] },
  { family: 'Bebas Neue', category: 'display', density: 0.18, aspect: 0.4, italic: 0, weights: [400], fallbacks: ['Impact','sans-serif'] },
  { family: 'Anton', category: 'sans-serif', density: 0.21, aspect: 0.4, italic: 0, weights: [400], fallbacks: ['Impact','sans-serif'] },
  { family: 'Merriweather', category: 'serif', density: 0.18, aspect: 0.6, italic: 0, weights: [300,400,700,900], fallbacks: ['Georgia','serif'] },
  { family: 'Playfair Display', category: 'serif', density: 0.16, aspect: 0.55, italic: 0, weights: [400,500,600,700,800,900], fallbacks: ['Georgia','serif'] },
  { family: 'Lora', category: 'serif', density: 0.14, aspect: 0.55, italic: 0, weights: [400,500,600,700], fallbacks: ['Georgia','serif'] },
  { family: 'PT Serif', category: 'serif', density: 0.15, aspect: 0.55, italic: 0, weights: [400,700], fallbacks: ['Georgia','serif'] },
  { family: 'Source Serif 4', category: 'serif', density: 0.15, aspect: 0.55, italic: 0, weights: [200,300,400,500,600,700,800,900], fallbacks: ['Georgia','serif'] },
  { family: 'EB Garamond', category: 'serif', density: 0.13, aspect: 0.5, italic: 0, weights: [400,500,600,700,800], fallbacks: ['Georgia','serif'] },
  { family: 'Libre Baskerville', category: 'serif', density: 0.16, aspect: 0.55, italic: 0, weights: [400,700], fallbacks: ['Georgia','serif'] },
  { family: 'JetBrains Mono', category: 'monospace', density: 0.14, aspect: 0.55, italic: 0, weights: [100,200,300,400,500,600,700,800], fallbacks: ['Menlo','Consolas','monospace'] },
  { family: 'Fira Code', category: 'monospace', density: 0.14, aspect: 0.55, italic: 0, weights: [300,400,500,600,700], fallbacks: ['Menlo','Consolas','monospace'] },
  { family: 'IBM Plex Mono', category: 'monospace', density: 0.14, aspect: 0.55, italic: 0, weights: [100,200,300,400,500,600,700], fallbacks: ['Menlo','Consolas','monospace'] },
  { family: 'Pacifico', category: 'handwriting', density: 0.16, aspect: 0.7, italic: 0.18, weights: [400], fallbacks: ['cursive'] },
  { family: 'Dancing Script', category: 'handwriting', density: 0.13, aspect: 0.55, italic: 0.16, weights: [400,500,600,700], fallbacks: ['cursive'] },
  { family: 'Caveat', category: 'handwriting', density: 0.12, aspect: 0.5, italic: 0.05, weights: [400,500,600,700], fallbacks: ['cursive'] },
  { family: 'Permanent Marker', category: 'handwriting', density: 0.18, aspect: 0.55, italic: 0.05, weights: [400], fallbacks: ['cursive'] },
];

export function googleFontsCssUrl(family: string, weights: number[] = [400, 700], italic = false): string {
  const f = family.replace(/\s/g, '+');
  if (italic) {
    const axes = weights.map((w) => `0,${w}`).concat(weights.map((w) => `1,${w}`)).join(';');
    return `https://fonts.googleapis.com/css2?family=${f}:ital,wght@${axes}&display=swap`;
  }
  const wghts = weights.join(';');
  return `https://fonts.googleapis.com/css2?family=${f}:wght@${wghts}&display=swap`;
}
