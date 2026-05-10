import { create } from 'zustand';
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
  | 'font-extract';

interface EditorState {
  history: History;
  doc: Document;
  selectedLayerId: LayerId | null;
  activeTool: ToolId;
  zoom: number;
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
const initialHistory = new History(initialDoc);

export const useEditorStore = create<EditorState>((set, get) => ({
  history: initialHistory,
  doc: initialDoc,
  selectedLayerId: null,
  activeTool: 'move',
  zoom: 1,
  selectionMaskBase64: null,
  lastFontMatchProvider: null,
  lastFontMatches: [],

  setActiveTool: (t) => set({ activeTool: t }),
  setZoom: (z) => set({ zoom: Math.max(0.05, Math.min(16, z)) }),
  selectLayer: (id) => set({ selectedLayerId: id }),

  applyDoc: (next) => {
    get().history.reset(next);
    set({ doc: next });
  },

  commit: (label, recipe) => {
    const next = get().history.commit(label, recipe);
    set({ doc: next });
  },

  undo: () => {
    const next = get().history.undo();
    set({ doc: next });
  },
  redo: () => {
    const next = get().history.redo();
    set({ doc: next });
  },

  addImage: (input) =>
    get().commit('Add image', (d) => {
      const next = addImageLayer(d, input);
      assignDoc(d, next);
    }),

  addText: (text, opts) =>
    get().commit('Add text', (d) => {
      const next = addTextLayer(d, { text, ...opts });
      assignDoc(d, next);
    }),

  addShape: (shape) =>
    get().commit('Add shape', (d) => {
      const next = addShapeLayer(d, { shape, width: 200, height: 200 });
      assignDoc(d, next);
    }),

  removeLayer: (id) =>
    get().commit('Delete layer', (d) => {
      const next = deleteLayer(d, id);
      assignDoc(d, next);
    }),

  duplicate: (id) =>
    get().commit('Duplicate layer', (d) => {
      const next = duplicateLayer(d, id);
      assignDoc(d, next);
    }),

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
      const next = updateLayer(d, id, patch);
      assignDoc(d, next);
    }),

  setSelectionMaskBase64: (m) => set({ selectionMaskBase64: m }),

  setFontMatches: (provider, matches) => set({ lastFontMatchProvider: provider, lastFontMatches: matches }),

  reset: () => {
    const fresh = createDocument({ name: 'Untitled', width: 1600, height: 1000 });
    get().history.reset(fresh);
    set({
      doc: fresh,
      selectedLayerId: null,
      activeTool: 'move',
      zoom: 1,
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
  target.meta = source.meta;
}
