import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../store/editor-store.js';

describe('editor store', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('starts with no layers and move tool active', () => {
    const s = useEditorStore.getState();
    expect(s.doc.layerOrder.length).toBe(0);
    expect(s.activeTool).toBe('move');
  });

  it('adds a text layer', () => {
    useEditorStore.getState().addText('Hello');
    const s = useEditorStore.getState();
    expect(s.doc.layerOrder.length).toBe(1);
    const id = s.doc.layerOrder[0]!;
    expect(s.doc.layers[id]!.type).toBe('text');
  });

  it('undoes addText', () => {
    useEditorStore.getState().addText('Hello');
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.layerOrder.length).toBe(0);
  });

  it('changes blend mode', () => {
    useEditorStore.getState().addText('Hi');
    const id = useEditorStore.getState().doc.layerOrder[0]!;
    useEditorStore.getState().setBlend(id, 'multiply');
    expect(useEditorStore.getState().doc.layers[id]!.blendMode).toBe('multiply');
  });
});

describe('revamp regression coverage', () => {
  beforeEach(() => useEditorStore.getState().reset());
  it('starts and resets with a transparent document', () => {
    expect(useEditorStore.getState().doc.background[3]).toBe(0);
  });
  it('coalesces 100 move previews into one undo step and cancels interrupted gestures', () => {
    const s = useEditorStore.getState(); s.addShape('rectangle');
    const id = useEditorStore.getState().selectedLayerId!, original = useEditorStore.getState().doc.layers[id]!.transform;
    s.beginGesture();
    for (let x = 1; x <= 100; x++) s.previewLayer(id, { transform: { ...original, position: { x, y: 42 } } });
    s.endGesture('Move layer');
    expect(useEditorStore.getState().history.describe().undo).toEqual(['Add shape', 'Move layer']);
    s.undo(); expect(useEditorStore.getState().doc.layers[id]!.transform).toEqual(original);
    s.redo(); expect(useEditorStore.getState().doc.layers[id]!.transform.position.x).toBe(100);
    s.beginGesture(); s.previewLayer(id, { opacity: .3 }); s.cancelGesture();
    expect(useEditorStore.getState().doc.layers[id]!.opacity).toBe(1);
  });
  it('coalesces adjustment slider commits and restores the original with one undo', () => {
    const s = useEditorStore.getState(); s.addShape('rectangle'); const id = useEditorStore.getState().selectedLayerId!;
    s.beginGesture(); for (let i = 1; i <= 30; i++) s.setOpacity(id, i / 100); s.endGesture('Change opacity');
    expect(useEditorStore.getState().history.describe().undo).toHaveLength(2);
    expect(useEditorStore.getState().doc.layers[id]!.opacity).toBe(.3); s.undo();
    expect(useEditorStore.getState().doc.layers[id]!.opacity).toBe(1);
  });
  it('crops without flattening layers and undo restores dimensions and positions', () => {
    const s = useEditorStore.getState(); s.addText('Editable'); const before = useEditorStore.getState().doc;
    s.cropCanvas(50, 100, 400, 300);
    const after = useEditorStore.getState().doc, id = before.layerOrder[0]!;
    expect(after.width).toBe(400); expect(after.layers[id]!.transform.position.y).toBe(before.layers[id]!.transform.position.y - 100);
    s.undo(); expect(useEditorStore.getState().doc).toEqual(before);
  });
  it('scales content only when requested and rejects unsafe canvas allocations', () => {
    const s = useEditorStore.getState(); s.addShape('ellipse'); const id = useEditorStore.getState().selectedLayerId!;
    s.resizeCanvas(800, 500, true); expect(useEditorStore.getState().doc.layers[id]!.transform.scale.x).toBe(.5);
    s.resizeCanvas(400, 250, false); expect(useEditorStore.getState().doc.layers[id]!.transform.scale.x).toBe(.5);
    s.resizeCanvas(8192, 8192); expect(useEditorStore.getState().doc.width).toBe(400);
    expect(useEditorStore.getState().notice).toContain('16 megapixels');
  });
  it('selects added/duplicated layers and clears stale selection on delete/open', () => {
    const s = useEditorStore.getState(); s.addText('A'); const first = useEditorStore.getState().selectedLayerId!;
    s.duplicate(first); const second = useEditorStore.getState().selectedLayerId!; expect(second).not.toBe(first);
    s.removeLayer(second); expect(useEditorStore.getState().selectedLayerId).toBeNull();
    s.selectLayer(first); s.applyDoc(useEditorStore.getState().doc); expect(useEditorStore.getState().selectedLayerId).toBeNull();
  });
});
