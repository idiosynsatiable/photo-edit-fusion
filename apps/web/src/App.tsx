import React, { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar.js';
import { ToolsRail } from './components/ToolsRail.js';
import { LayersPanel } from './components/LayersPanel.js';
import { PropertiesPanel } from './components/PropertiesPanel.js';
import { CanvasStage } from './components/CanvasStage.js';
import { StatusBar } from './components/StatusBar.js';
import { FontExtractModal } from './components/FontExtractModal.js';
import { AiCutModal } from './components/AiCutModal.js';
import { AiEditAssistant } from './components/AiEditAssistant.js';
import { SystemDiagnostics } from './components/SystemDiagnostics.js';
import { useEditorStore } from './store/editor-store.js';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts.js';

export function App(): React.JSX.Element {
  const [fontModalOpen, setFontModalOpen] = useState(false);
  const [aiCutModalOpen, setAiCutModalOpen] = useState(false);
  const [aiStudioOpen, setAiStudioOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const tool = useEditorStore((s) => s.activeTool);

  useKeyboardShortcuts();

  // Keep the working document on-device. This uses IndexedDB, not Railway,
  // so a closed tab or interrupted session does not erase the current project.
  useEffect(() => {
    if (!('indexedDB' in window)) return;
    let disposed = false;
    let db: IDBDatabase | null = null;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let persistNow: (() => void) | undefined;
    let visibilityHandler: (() => void) | undefined;
    const request = window.indexedDB.open('photo-edit-fusion-local', 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('documents')) database.createObjectStore('documents');
    };

    request.onsuccess = () => {
      db = request.result;
      const read = db.transaction('documents', 'readonly').objectStore('documents').get('autosave');
      read.onsuccess = () => {
        if (disposed) return;
        const current = useEditorStore.getState().doc;
        const shouldRestoreSavedDocument = Boolean(read.result) && current.layerOrder.length === 0 && current.name === 'Untitled';
        if (shouldRestoreSavedDocument) useEditorStore.getState().applyDoc(read.result);
        persistNow = () => {
          if (!db || disposed) return;
          if (saveTimer) clearTimeout(saveTimer);
          try {
            db.transaction('documents', 'readwrite').objectStore('documents').put(useEditorStore.getState().doc, 'autosave');
          } catch {
            // Manual Save Project export remains available if device storage is full.
          }
        };
        visibilityHandler = () => {
          if (document.visibilityState === 'hidden') persistNow?.();
        };
        window.addEventListener('pagehide', persistNow);
        document.addEventListener('visibilitychange', visibilityHandler);
        unsubscribe = useEditorStore.subscribe((state, previous) => {
          if (state.doc === previous.doc || !db) return;
          if (saveTimer) clearTimeout(saveTimer);
          const nextDocument = state.doc;
          saveTimer = setTimeout(() => {
            if (!db || disposed) return;
            try {
              db.transaction('documents', 'readwrite').objectStore('documents').put(nextDocument, 'autosave');
            } catch {
              // Manual Save Project export remains available if device storage is full.
            }
          }, 500);
        });
        // If the user edited before IndexedDB finished opening, keep and persist
        // that live document instead of losing it or restoring over it.
        if (!shouldRestoreSavedDocument) persistNow();
      };
    };

    return () => {
      disposed = true;
      if (saveTimer) clearTimeout(saveTimer);
      unsubscribe?.();
      if (persistNow) window.removeEventListener('pagehide', persistNow);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      db?.close();
    };
  }, []);

  useEffect(() => {
    if (tool === 'font-extract') setFontModalOpen(true);
    if (tool === 'ai-cut') setAiCutModalOpen(true);
  }, [tool]);

  return (
    <div className="h-screen min-h-0 flex flex-col overflow-hidden bg-ink-950 text-zinc-100">
      <Toolbar onOpenFontModal={() => setFontModalOpen(true)} onOpenAiCutModal={() => setAiCutModalOpen(true)} />
      <div className="min-h-0 flex-1 flex overflow-hidden">
        <ToolsRail />
        <CanvasStage />
        <div className="w-72 max-sm:w-40 shrink-0 border-l border-ink-700 flex flex-col">
          <LayersPanel />
          <PropertiesPanel />
        </div>
      </div>
      <StatusBar />
      <button className="fixed bottom-8 left-4 z-30 rounded-full border border-emerald-900 bg-ink-900 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-lg" onClick={() => setDiagnosticsOpen(true)}>Ω System Check</button>
      <SystemDiagnostics open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
      <button
        className="fixed bottom-8 right-4 z-30 rounded-full border border-cyan-800 bg-ink-900 px-4 py-2 text-xs font-semibold text-cyan-200 shadow-lg"
        onClick={() => setAiStudioOpen((open) => !open)}
        aria-expanded={aiStudioOpen}
      >
        {aiStudioOpen ? 'Close AI Studio' : 'Open AI Studio Ω'}
      </button>
      {aiStudioOpen && (
        <div className="fixed bottom-16 right-4 z-20 max-h-[70vh] w-[min(92vw,420px)] overflow-y-auto rounded-lg border border-ink-600 shadow-2xl">
          <AiEditAssistant />
        </div>
      )}
      <FontExtractModal open={fontModalOpen} onClose={() => setFontModalOpen(false)} />
      <AiCutModal open={aiCutModalOpen} onClose={() => setAiCutModalOpen(false)} />
    </div>
  );
}
