import { nanoid } from 'nanoid';
import type { Document, Layer, LayerId } from '@pef/shared';

export const APP_VERSION = '1.0.0';

export function createId(): string {
  return nanoid(12);
}

export function createDocument(opts: {
  width?: number;
  height?: number;
  name?: string;
} = {}): Document {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name: opts.name ?? 'Untitled',
    width: opts.width ?? 1920,
    height: opts.height ?? 1080,
    layerOrder: [],
    layers: {},
    bitmaps: {},
    background: [1, 1, 1, 1],
    meta: { createdAt: now, modifiedAt: now, appVersion: APP_VERSION },
  };
}

export function getLayer(doc: Document, id: LayerId): Layer | undefined {
  return doc.layers[id];
}

/** Returns layers in render order (bottom-first). Filters out missing entries. */
export function orderedLayers(doc: Document): Layer[] {
  const out: Layer[] = [];
  for (const id of doc.layerOrder) {
    const l = doc.layers[id];
    if (l) out.push(l);
  }
  return out;
}

export function touchModified(doc: Document): void {
  doc.meta.modifiedAt = new Date().toISOString();
}
