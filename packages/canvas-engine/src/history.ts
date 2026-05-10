import { applyPatches, produceWithPatches, type Patch } from 'immer';
import type { Document } from '@pef/shared';

interface HistoryEntry {
  forward: Patch[];
  inverse: Patch[];
  label: string;
  timestamp: number;
}

/**
 * Patch-based undo/redo. Each commit records both forward and inverse patches
 * so memory cost is proportional to the diff, not the document.
 */
export class History {
  private state: Document;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private readonly maxEntries: number;

  constructor(initial: Document, maxEntries = 200) {
    this.state = initial;
    this.maxEntries = maxEntries;
  }

  current(): Document {
    return this.state;
  }

  /**
   * Apply `recipe` to the current state, push the resulting patches onto the
   * undo stack, and clear the redo stack.
   */
  commit(label: string, recipe: (draft: Document) => void): Document {
    const [next, forward, inverse] = produceWithPatches(this.state, recipe);
    if (forward.length === 0) return this.state;
    this.state = next as Document;
    this.undoStack.push({ forward, inverse, label, timestamp: Date.now() });
    if (this.undoStack.length > this.maxEntries) this.undoStack.shift();
    this.redoStack = [];
    return this.state;
  }

  /** Replace state directly without recording history (e.g. for "open file"). */
  reset(state: Document): void {
    this.state = state;
    this.undoStack = [];
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): Document {
    const entry = this.undoStack.pop();
    if (!entry) return this.state;
    this.state = applyPatches(this.state, entry.inverse) as Document;
    this.redoStack.push(entry);
    return this.state;
  }

  redo(): Document {
    const entry = this.redoStack.pop();
    if (!entry) return this.state;
    this.state = applyPatches(this.state, entry.forward) as Document;
    this.undoStack.push(entry);
    return this.state;
  }

  /** human-readable list for UI display */
  describe(): { undo: string[]; redo: string[] } {
    return {
      undo: this.undoStack.map((e) => e.label),
      redo: this.redoStack.map((e) => e.label),
    };
  }
}
