import { describe, it, expect } from 'vitest';
import { LayerSchema, DocumentSchema, FontIdentifyRequestSchema } from '../schemas.js';

const baseTransform = {
  position: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  rotation: 0,
  anchor: { x: 0.5, y: 0.5 },
};

describe('schemas', () => {
  it('parses an image layer', () => {
    const r = LayerSchema.safeParse({
      id: 'l1',
      name: 'photo',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: baseTransform,
      parentId: null,
      maskBitmapId: null,
      type: 'image',
      bitmapId: 'b1',
      sourceWidth: 100,
      sourceHeight: 100,
    });
    expect(r.success).toBe(true);
  });

  it('rejects malformed text layer', () => {
    const r = LayerSchema.safeParse({
      id: 't1',
      name: 'text',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: baseTransform,
      parentId: null,
      maskBitmapId: null,
      type: 'text',
      text: 'hi',
      fontFamily: 'Inter',
      fontWeight: 1500, // out of range
      fontStyle: 'normal',
      fontSizePx: 24,
      letterSpacingEm: 0,
      lineHeight: 1.2,
      align: 'left',
      color: [0, 0, 0, 1],
      webFontUrl: null,
    });
    expect(r.success).toBe(false);
  });

  it('FontIdentifyRequestSchema requires non-trivial base64', () => {
    expect(FontIdentifyRequestSchema.safeParse({ imageBase64: 'a' }).success).toBe(false);
    expect(FontIdentifyRequestSchema.safeParse({ imageBase64: 'a'.repeat(40) }).success).toBe(true);
  });

  it('Document round-trips', () => {
    const doc = {
      id: 'doc1',
      name: 'Untitled',
      width: 800,
      height: 600,
      layerOrder: [],
      layers: {},
      bitmaps: {},
      background: [1, 1, 1, 1],
      meta: { createdAt: 'a', modifiedAt: 'b', appVersion: '1.0.0' },
    };
    const r = DocumentSchema.safeParse(doc);
    expect(r.success).toBe(true);
  });
});
