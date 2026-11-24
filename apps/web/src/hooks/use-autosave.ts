import { useEffect } from 'react';
import { fromProjectFile } from '@pef/canvas-engine';
import { useEditorStore } from '../store/editor-store.js';
export function useAutosave(): void {
  useEffect(() => {
    const state = useEditorStore.getState();
    if (!('indexedDB' in window)) { state.setSaveStatus('unavailable'); return; }
    let disposed = false, db: IDBDatabase | null = null, timer: ReturnType<typeof setTimeout> | undefined, unsubscribe: (() => void) | undefined;
    const startupDoc = state.doc, request = indexedDB.open('photo-edit-fusion-local', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('documents')) request.result.createObjectStore('documents'); };
    request.onerror = () => state.setSaveStatus('unavailable');
    function save(): void {
      if (!db || disposed) return; const s = useEditorStore.getState(); if (s.gestureStart) return;
      try {
        const doc = s.doc, tx = db.transaction('documents', 'readwrite'); tx.objectStore('documents').put(doc, 'autosave');
        s.setSaveStatus('saving');
        tx.oncomplete = () => { if (!disposed && useEditorStore.getState().doc === doc) s.setSaveStatus('saved'); };
        tx.onerror = () => s.setSaveStatus('unavailable');
      } catch { s.setSaveStatus('unavailable'); }
    }
    function visibility(): void { if (document.visibilityState === 'hidden') save(); }
    request.onsuccess = () => {
      if (disposed) { request.result.close(); return; } db = request.result;
      const read = db.transaction('documents', 'readonly').objectStore('documents').get('autosave');
      read.onerror = () => state.setSaveStatus('unavailable');
      read.onsuccess = () => {
        if (disposed) return;
        if (read.result && useEditorStore.getState().doc === startupDoc) {
          try { state.applyDoc(fromProjectFile(JSON.stringify({ formatVersion: 1, document: read.result }))); state.setSaveStatus('saved'); }
          catch { state.setNotice('Saved recovery could not be opened. You can still open a .pef.json project.'); }
        } else save();
        unsubscribe = useEditorStore.subscribe((s, prev) => {
          if (s.doc === prev.doc || s.gestureStart) return;
          s.setSaveStatus('saving'); if (timer) clearTimeout(timer); timer = setTimeout(save, 500);
        });
        window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', visibility);
      };
    };
    return () => { disposed = true; if (timer) clearTimeout(timer); unsubscribe?.(); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', visibility); db?.close(); };
  }, []);
}
