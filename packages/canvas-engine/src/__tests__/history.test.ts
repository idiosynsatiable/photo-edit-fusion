import { describe, it, expect } from 'vitest';
import { createDocument } from '../document.js';
import { addTextLayer } from '../layer-ops.js';
import { History } from '../history.js';

describe('History', () => {
  it('records and undoes a commit', () => {
    const doc = createDocument();
    const h = new History(doc);
    h.commit('add text', (d) => {
      const after = addTextLayer(d, { text: 'Hello' });
      // produceWithPatches expects mutation, so we mirror the result onto draft
      d.layers = after.layers;
      d.layerOrder = after.layerOrder;
    });
    expect(Object.keys(h.current().layers).length).toBe(1);
    h.undo();
    expect(Object.keys(h.current().layers).length).toBe(0);
    h.redo();
    expect(Object.keys(h.current().layers).length).toBe(1);
  });

  it('clears redo stack when a new commit happens', () => {
    const doc = createDocument();
    const h = new History(doc);
    h.commit('a', (d) => (d.name = 'A'));
    h.commit('b', (d) => (d.name = 'B'));
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.commit('c', (d) => (d.name = 'C'));
    expect(h.canRedo()).toBe(false);
    expect(h.current().name).toBe('C');
  });

  it('reset clears stacks', () => {
    const doc = createDocument();
    const h = new History(doc);
    h.commit('a', (d) => (d.name = 'A'));
    h.reset(createDocument({ name: 'fresh' }));
    expect(h.canUndo()).toBe(false);
    expect(h.current().name).toBe('fresh');
  });
});
