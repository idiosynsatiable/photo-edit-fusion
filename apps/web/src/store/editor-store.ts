import { create } from 'zustand';
import { measureInk } from '../lib/typography.js';
import {
  History,
  addImageLayer,
  addShapeLayer,
  addTextLayer,
  createDocument,
  deleteLayer,
  duplicateLayer,
  reorderLayer,
  setLayerLocked,
  setLayerVisibility,
  updateLayer,
} from '@pef/canvas-engine';
import type { BlendMode, Document, Layer, LayerId, TextLayer, FontMatch } from '@pef/shared';

export type ToolId =
  | 'move'
  | 'lasso'
  | 'polygon'
  | 'magic-wand'
  | 'ai-cut'
  | 'text'
  | 'font-extract'
  | 'crop'
  | 'adjust'
  | 'eraser';

interface EditorState {
  history: History;
  doc: Document;
  selectedLayerId: LayerId | null;
  activeTool: ToolId;
  zoom: number;
  fitRequest: number;
  brushSize: number;
  wandTolerance: number;
  restoreMask: boolean;
  setRestoreMask: (restore: boolean) => void;
  saveStatus: 'saving' | 'saved' | 'unavailable';
  gestureStart: Document | null;
  notice: string | null;
  setNotice: (message: string | null) => void;
  setSaveStatus: (status: 'saving' | 'saved' | 'unavailable') => void;
  fitCanvas: () => void;
  setBrushSize: (size: number) => void;
  setWandTolerance: (size: number) => void;
  beginGesture: () => void;
  previewLayer: (id: LayerId, patch: Partial<Layer>) => void;
  endGesture: (label: string) => void;
  cancelGesture: () => void;
  resizeCanvas: (width: number, height: number, scaleContent?: boolean) => void;
  cropCanvas: (x: number, y: number, width: number, height: number) => void;
  // selection mask in document space (RGBA imageData-like array, 0..255)
  selectionMaskBase64: string | null;
  // last font match result for the modal
  lastFontMatchProvider: string | null;
  lastFontMatches: FontMatch[];

  // actions
  setActiveTool: (t: ToolId) => void;
  setZoom: (z: number) => void;
  selectLayer: (id: LayerId | null) => void;
  applyDoc: (next: Document) => void;
  commit: (label: string, recipe: (d: Document) => void) => void;
  undo: () => void;
  redo: () => void;

  addImage: (input: { bitmapId: string; bitmapDataUrl: string; sourceWidth: number; sourceHeight: number; name?: string }) => void;
  addText: (text: string, opts?: Partial<Pick<TextLayer, 'fontFamily' | 'fontSizePx' | 'fontWeight' | 'fontStyle' | 'webFontUrl'>>) => void;
  addShape: (shape: 'rectangle' | 'ellipse' | 'polygon') => void;
  removeLayer: (id: LayerId) => void;
  duplicate: (id: LayerId) => void;
  reorder: (id: LayerId, idx: number) => void;
  setVisible: (id: LayerId, v: boolean) => void;
  setLocked: (id: LayerId, v: boolean) => void;
  setBlend: (id: LayerId, mode: BlendMode) => void;
  setOpacity: (id: LayerId, opacity: number) => void;
  patchLayer: <L extends Layer>(id: LayerId, patch: Partial<L>) => void;

  setSelectionMaskBase64: (mask: string | null) => void;
  setFontMatches: (provider: string, matches: FontMatch[]) => void;
  reset: () => void;
}

const initialDoc = createDocument({ name: 'Untitled', width: 1600, height: 1000 });
initialDoc.background = [0, 0, 0, 0];
const initialHistory = new History(initialDoc);

export const useEditorStore = create<EditorState>((set, get) => ({
  history: initialHistory,
  doc: initialDoc,
  selectedLayerId: null,
  activeTool: 'move',
  zoom: 1,
  fitRequest: 0,
  brushSize: 40,
  restoreMask: false,
  setRestoreMask: (restoreMask) => set({ restoreMask }),
  wandTolerance: 24,
  saveStatus: 'saving',
  gestureStart: null,
  notice: null,
  setNotice: (notice) => set({ notice }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  fitCanvas: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  setBrushSize: (brushSize) => set({ brushSize }),
  setWandTolerance: (wandTolerance) => set({ wandTolerance }),
  beginGesture: () => set({ gestureStart: get().doc }),
  previewLayer: (id, patch) => {
    const s = get(), layer = s.doc.layers[id];
    if (!layer || layer.locked) return;
    set({ doc: { ...s.doc, layers: { ...s.doc.layers, [id]: { ...layer, ...patch } as Layer } } });
  },
  endGesture: (label) => {
    const s = get(); if (!s.gestureStart) return;
    const next = s.doc; set({ doc: s.gestureStart, gestureStart: null });
    if (next !== s.gestureStart) get().commit(label, (d) => assignDoc(d, next));
  },
  cancelGesture: () => {
    if (get().gestureStart) set({ doc: get().gestureStart!, gestureStart: null });
  },
  resizeCanvas: (width, height, scaleContent = false) => {
    if (!validSize(width, height)) { get().setNotice('Use dimensions from 1–8192 px, up to 16 megapixels.'); return; }
    get().commit('Resize canvas', (d) => {
      if (scaleContent) for (const layer of Object.values(d.layers)) {
        layer.transform.position.x *= width / d.width; layer.transform.position.y *= height / d.height;
        layer.transform.scale.x *= width / d.width; layer.transform.scale.y *= height / d.height;
      }
      d.width = width; d.height = height;
    });
    get().fitCanvas();
  },
  cropCanvas: (x, y, width, height) => {
    if (!validSize(width, height)) return;
    get().commit('Crop canvas', (d) => {
      for (const layer of Object.values(d.layers)) {
        layer.transform.position.x -= x; layer.transform.position.y -= y;
      }
      d.width = width; d.height = height;
    });
    get().setActiveTool('move'); get().fitCanvas();
  },
  selectionMaskBase64: null,
  lastFontMatchProvider: null,
  lastFontMatches: [],

  setActiveTool: (t) => set({ activeTool: t }),
  setZoom: (z) => { if (Number.isFinite(z)) set({ zoom: Math.max(0.01, Math.min(16, z)) }); },
  selectLayer: (id) => set({ selectedLayerId: id }),

  applyDoc: (next) => {
    get().history.reset(next);
    set({ doc: next, selectedLayerId: null, selectionMaskBase64: null, gestureStart: null, fitRequest: get().fitRequest + 1 });
  },

  commit: (label, recipe) => {
    const history = get().gestureStart ? new History(get().doc) : get().history;
    const next = history.commit(label, (d) => { recipe(d); d.meta = { ...d.meta, modifiedAt: new Date().toISOString() }; });
    const selected = get().selectedLayerId;
    set({ doc: next, selectedLayerId: selected && next.layers[selected] ? selected : null });
  },

  undo: () => {
    const next = get().history.undo();
    set({ doc: next, selectedLayerId: get().selectedLayerId && next.layers[get().selectedLayerId!] ? get().selectedLayerId : null });
  },
  redo: () => {
    const next = get().history.redo();
    set({ doc: next, selectedLayerId: get().selectedLayerId && next.layers[get().selectedLayerId!] ? get().selectedLayerId : null });
  },

  addImage: (input) => {
    get().commit('Add image', (d) => {
      const next = addImageLayer(d, input);
      assignDoc(d, next);
      const layer = d.layers[d.layerOrder[d.layerOrder.length - 1]!]!;
      const scale = Math.min(1, d.width / input.sourceWidth, d.height / input.sourceHeight);
      layer.transform.scale = { x: scale, y: scale };
    });
    set({ selectedLayerId: get().doc.layerOrder.at(-1)! });
  },

  addText: (text, opts) => {
    get().commit('Add text', (d) => {
      const next = addTextLayer(d, { text, ...opts });
      assignDoc(d, next);
    });
    set({ selectedLayerId: get().doc.layerOrder.at(-1)! });
  },

  addShape: (shape) => {
    get().commit('Add shape', (d) => {
      const next = addShapeLayer(d, { shape, width: 200, height: 200 });
      assignDoc(d, next);
    });
    set({ selectedLayerId: get().doc.layerOrder.at(-1)! });
  },

  removeLayer: (id) =>
    get().commit('Delete layer', (d) => {
      const next = deleteLayer(d, id);
      assignDoc(d, next);
    }),

  duplicate: (id) => {
    get().commit('Duplicate layer', (d) => {
      const next = duplicateLayer(d, id);
      assignDoc(d, next);
    });
    const order = get().doc.layerOrder;
    set({ selectedLayerId: order[order.indexOf(id) + 1]! });
  },

  reorder: (id, idx) =>
    get().commit('Reorder layer', (d) => {
      const next = reorderLayer(d, id, idx);
      assignDoc(d, next);
    }),

  setVisible: (id, v) =>
    get().commit(v ? 'Show layer' : 'Hide layer', (d) => {
      const next = setLayerVisibility(d, id, v);
      assignDoc(d, next);
    }),

  setLocked: (id, v) =>
    get().commit(v ? 'Lock layer' : 'Unlock layer', (d) => {
      const next = setLayerLocked(d, id, v);
      assignDoc(d, next);
    }),

  setBlend: (id, mode) =>
    get().commit('Change blend mode', (d) => {
      const next = updateLayer<Layer>(d, id, { blendMode: mode } as Partial<Layer>);
      assignDoc(d, next);
    }),

  setOpacity: (id, opacity) =>
    get().commit('Change opacity', (d) => {
      const next = updateLayer<Layer>(d, id, { opacity } as Partial<Layer>);
      assignDoc(d, next);
    }),

  patchLayer: (id, patch) =>
    get().commit('Update layer', (d) => {
      const current = d.layers[id];
      if (current?.type === 'text' && ['text', 'fontFamily', 'fontWeight', 'fontStyle', 'letterSpacingEm', 'lineHeight'].some((key) => key in patch)) {
        const updated = { ...current, ...patch } as TextLayer;
        patch = { ...patch, inkMetrics: measureInk(updated) } as typeof patch;
      }
      const next = updateLayer(d, id, patch);
      assignDoc(d, next);
    }),

  setSelectionMaskBase64: (m) => set({ selectionMaskBase64: m }),

  setFontMatches: (provider, matches) => set({ lastFontMatchProvider: provider, lastFontMatches: matches }),

  reset: () => {
    const fresh = createDocument({ name: 'Untitled', width: 1600, height: 1000 });
    fresh.background = [0, 0, 0, 0];
    get().history.reset(fresh);
    set({
      doc: fresh,
      selectedLayerId: null,
      activeTool: 'move',
      zoom: 1,
      gestureStart: null,
      fitRequest: get().fitRequest + 1,
      selectionMaskBase64: null,
      lastFontMatchProvider: null,
      lastFontMatches: [],
    });
  },
}));

/**
 * Helper: copy fields from `source` onto `target` so an immer recipe writing to
 * the `commit` draft reflects a previously-immer-produced result. Used because
 * canvas-engine ops return new immutable docs; History.commit's recipe receives
 * a draft that we need to mirror.
 */
function assignDoc(target: Document, source: Document): void {
  target.id = source.id;
  target.name = source.name;
  target.width = source.width;
  target.height = source.height;
  target.layerOrder = source.layerOrder;
  target.layers = source.layers;
  target.bitmaps = source.bitmaps;
  target.background = source.background;
  target.fonts = source.fonts;
  target.meta = source.meta;
}

export function validSize(w: number, h: number): boolean { return Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w <= 8192 && h <= 8192 && w * h <= 16_000_000; }
