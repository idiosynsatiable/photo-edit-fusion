import type { FontMatchResult } from '@pef/shared';

export interface FontIdProviderInput {
  /** raw image bytes (PNG buffer) of the cropped text region */
  imageBytes: Uint8Array;
  /** mime type, typically image/png */
  contentType: string;
  /** OCR'd sample text, used to format result */
  sampleText: string;
  /** glyph features measured from the binarized crop */
  features: import('./metrics.js').GlyphFeatures;
  /** maximum results to return */
  maxResults?: number;
}

export interface FontIdProvider {
  /** stable name */
  readonly name: 'whatthefont' | 'fontspring' | 'google-fonts-similarity';
  /** true when API key is set or no key required */
  isAvailable(): boolean;
  identify(input: FontIdProviderInput): Promise<FontMatchResult>;
}
