import { describe, it, expect } from 'vitest';
import { createDocument } from '../document.js';
import { addTextLayer } from '../layer-ops.js';
import { fromProjectFile, toProjectFile, isProjectFile } from '../serialize.js';

describe('serialize', () => {
  it('round-trips a document', () => {
    const d1 = addTextLayer(createDocument({ name: 'Test' }), { text: 'hi' });
    const json = toProjectFile(d1);
    const d2 = fromProjectFile(json);
    expect(d2.name).toBe('Test');
    expect(Object.keys(d2.layers).length).toBe(1);
  });

  it('isProjectFile rejects garbage', () => {
    expect(isProjectFile('{}')).toBe(false);
    expect(isProjectFile('not json')).toBe(false);
  });
});
