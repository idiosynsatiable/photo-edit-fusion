import { produce } from 'immer';
import type {
  Document,
  ImageLayer,
  Layer,
  LayerId,
  ShapeLayer,
  TextLayer,
} from '@pef/shared';
import { createId, touchModified } from './document.js';
import { identityTransform } from './transform.js';

interface AddImageInput {
  bitmapId: string;
  bitmapDataUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  name?: string;
}

export function addImageLayer(doc: Document, input: AddImageInput): Document {
  return produce(doc, (d) => {
    const id = createId();
    const layer: ImageLayer = {
      id,
      name: input.name ?? `Image ${Object.keys(d.layers).length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: {
        ...identityTransform(),
        position: { x: d.width / 2, y: d.height / 2 },
      },
      parentId: null,
      maskBitmapId: null,
      type: 'image',
      bitmapId: input.bitmapId,
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
    };
    d.layers[id] = layer;
    d.layerOrder.push(id);
    d.bitmaps[input.bitmapId] = input.bitmapDataUrl;
    touchModified(d);
  });
}

export interface AddTextInput {
  text: string;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  fontSizePx?: number;
  position?: { x: number; y: number };
  color?: [number, number, number, number];
  webFontUrl?: string | null;
}

export function addTextLayer(doc: Document, input: AddTextInput): Document {
  return produce(doc, (d) => {
    const id = createId();
    const layer: TextLayer = {
      id,
      name: `Text — ${input.text.slice(0, 24)}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: {
        ...identityTransform(),
        position: input.position ?? { x: d.width / 2, y: d.height / 2 },
      },
      parentId: null,
      maskBitmapId: null,
      type: 'text',
      text: input.text,
      fontFamily: input.fontFamily ?? 'Inter',
      fontWeight: input.fontWeight ?? 400,
      fontStyle: input.fontStyle ?? 'normal',
      fontSizePx: input.fontSizePx ?? 64,
      letterSpacingEm: 0,
      lineHeight: 1.2,
      align: 'left',
      color: input.color ?? [0, 0, 0, 1],
      webFontUrl: input.webFontUrl ?? null,
    };
    d.layers[id] = layer;
    d.layerOrder.push(id);
    touchModified(d);
  });
}

export interface AddShapeInput {
  shape: ShapeLayer['shape'];
  width: number;
  height: number;
  position?: { x: number; y: number };
  fill?: [number, number, number, number];
  stroke?: [number, number, number, number];
  strokeWidth?: number;
  cornerRadius?: number;
  sides?: number;
}

export function addShapeLayer(doc: Document, input: AddShapeInput): Document {
  return produce(doc, (d) => {
    const id = createId();
    const layer: ShapeLayer = {
      id,
      name: `${input.shape}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: {
        ...identityTransform(),
        position: input.position ?? { x: d.width / 2, y: d.height / 2 },
      },
      parentId: null,
      maskBitmapId: null,
      type: 'shape',
      shape: input.shape,
      width: input.width,
      height: input.height,
      fill: input.fill ?? [0.2, 0.4, 0.9, 1],
      stroke: input.stroke ?? [0, 0, 0, 0],
      strokeWidth: input.strokeWidth ?? 0,
      cornerRadius: input.cornerRadius ?? 0,
      sides: input.sides ?? 6,
    };
    d.layers[id] = layer;
    d.layerOrder.push(id);
    touchModified(d);
  });
}

export function deleteLayer(doc: Document, id: LayerId): Document {
  return produce(doc, (d) => {
    if (!d.layers[id]) return;
    delete d.layers[id];
    d.layerOrder = d.layerOrder.filter((lid) => lid !== id);
    touchModified(d);
  });
}

export function reorderLayer(doc: Document, id: LayerId, newIndex: number): Document {
  return produce(doc, (d) => {
    const idx = d.layerOrder.indexOf(id);
    if (idx === -1) return;
    d.layerOrder.splice(idx, 1);
    const clamped = Math.max(0, Math.min(newIndex, d.layerOrder.length));
    d.layerOrder.splice(clamped, 0, id);
    touchModified(d);
  });
}

export function updateLayer<L extends Layer>(
  doc: Document,
  id: LayerId,
  patch: Partial<L>,
): Document {
  return produce(doc, (d) => {
    const l = d.layers[id];
    if (!l) return;
    Object.assign(l, patch);
    touchModified(d);
  });
}

export function setLayerVisibility(doc: Document, id: LayerId, visible: boolean): Document {
  return updateLayer(doc, id, { visible });
}

export function setLayerLocked(doc: Document, id: LayerId, locked: boolean): Document {
  return updateLayer(doc, id, { locked });
}

export function duplicateLayer(doc: Document, id: LayerId): Document {
  return produce(doc, (d) => {
    const original = d.layers[id];
    if (!original) return;
    const copyId = createId();
    const copy: Layer = { ...original, id: copyId, name: `${original.name} copy` };
    d.layers[copyId] = copy;
    const idx = d.layerOrder.indexOf(id);
    d.layerOrder.splice(idx + 1, 0, copyId);
    touchModified(d);
  });
}
