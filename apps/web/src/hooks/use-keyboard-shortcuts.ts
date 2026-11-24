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
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const s = useEditorStore.getState();
      if (mod && e.key === 'z' && !shift) {
        e.preventDefault();
        s.undo();
      } else if (mod && (e.key === 'y' || (e.key === 'z' && shift))) {
        e.preventDefault();
        s.redo();
      } else if (e.key === 'Escape') { s.cancelGesture(); s.selectLayer(null); s.setActiveTool('move');
      } else if (e.key === 'c') { s.setActiveTool('crop');
      } else if (e.key === 'e') { s.setActiveTool('eraser');
      } else if (e.key === 'v') {
        s.setActiveTool('move');
      } else if (e.key === 'l') {
        s.setActiveTool('lasso');
      } else if (e.key === 'p') {
        s.setActiveTool('polygon');
      } else if (e.key === 'w') {
        s.setActiveTool('magic-wand');
      } else if (e.key === 't') {
        s.setActiveTool('text'); s.addText('Your text');
      } else if (e.key === 'f') {
        s.setActiveTool('font-extract');
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && s.selectedLayerId) {
        const l = s.doc.layers[s.selectedLayerId]; if (!l || l.locked) return; e.preventDefault();
        s.patchLayer(l.id, { transform: { ...l.transform, position: { x: l.transform.position.x + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0) * (shift ? 10 : 1), y: l.transform.position.y + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0) * (shift ? 10 : 1) } } });
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
        s.fitCanvas();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
