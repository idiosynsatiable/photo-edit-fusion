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
