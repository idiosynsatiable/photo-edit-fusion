import { useEffect } from 'react';
import { useEditorStore } from '../store/editor-store.js';

/**
 * Global keyboard shortcuts. Modifier keys honor the host platform — meta on
 * macOS, control elsewhere — by checking ctrlKey OR metaKey.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const mod = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const s = useEditorStore.getState();
      if (mod && e.key === 'z' && !shift) {
        e.preventDefault();
        s.undo();
      } else if (mod && (e.key === 'y' || (e.key === 'z' && shift))) {
        e.preventDefault();
        s.redo();
      } else if (e.key === 'v') {
        s.setActiveTool('move');
      } else if (e.key === 'l') {
        s.setActiveTool('lasso');
      } else if (e.key === 'p') {
        s.setActiveTool('polygon');
      } else if (e.key === 'w') {
        s.setActiveTool('magic-wand');
      } else if (e.key === 't') {
        s.setActiveTool('text');
      } else if (e.key === 'f') {
        s.setActiveTool('font-extract');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedLayerId) s.removeLayer(s.selectedLayerId);
      } else if (mod && e.key === 'd') {
        e.preventDefault();
        if (s.selectedLayerId) s.duplicate(s.selectedLayerId);
      } else if (e.key === '+') {
        s.setZoom(s.zoom * 1.2);
      } else if (e.key === '-') {
        s.setZoom(s.zoom / 1.2);
      } else if (e.key === '0') {
        s.setZoom(1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
