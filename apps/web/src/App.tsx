import React, { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar.js';
import { ToolsRail } from './components/ToolsRail.js';
import { LayersPanel, HistoryPanel } from './components/LayersPanel.js';
import { PropertiesPanel } from './components/PropertiesPanel.js';
import { CanvasStage } from './components/CanvasStage.js';
import { StatusBar } from './components/StatusBar.js';
import { FontExtractModal } from './components/FontExtractModal.js';
import { AiCutModal } from './components/AiCutModal.js';
import { AiEditAssistant } from './components/AiEditAssistant.js';
import { SystemDiagnostics } from './components/SystemDiagnostics.js';
import { Icon } from './components/Icon.js';
import { useEditorStore } from './store/editor-store.js';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts.js';
import { useAutosave } from './hooks/use-autosave.js';
import { importImages } from './lib/editor-files.js';
export function App(): React.JSX.Element {
  const [fontModalOpen, setFontModalOpen] = useState(false), [aiCutModalOpen, setAiCutModalOpen] = useState(false), [aiStudioOpen, setAiStudioOpen] = useState(false), [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [tab, setTab] = useState<'edit' | 'layers' | 'history'>('edit'), [inspectorOpen, setInspectorOpen] = useState(false);
  const tool = useEditorStore((s) => s.activeTool), notice = useEditorStore((s) => s.notice);
  useKeyboardShortcuts(); useAutosave();
  useEffect(() => {
    const paste = (e: ClipboardEvent) => { const target = e.target as HTMLElement; if (['INPUT', 'TEXTAREA'].includes(target?.tagName) || target?.isContentEditable) return; const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); void importImages(files); } };
    window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste);
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => useEditorStore.getState().setNotice(null), 9000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (tool === 'font-extract') setFontModalOpen(true); if (tool === 'ai-cut') setAiCutModalOpen(true); }, [tool]);
  return <div className="editor-app">
    <Toolbar />
    <div className="editor-body">
      <ToolsRail onEdit={(open = true) => { setTab('edit'); setInspectorOpen(open); }} />
      <CanvasStage />
      <aside className={`inspector ${inspectorOpen ? 'inspector-open' : ''}`}>
        <div className="inspector-tabs" role="tablist" aria-label="Inspector panels">{(['edit', 'layers', 'history'] as const).map((name) => <button key={name} role="tab" aria-selected={tab === name} onClick={() => { setTab(name); setInspectorOpen(true); }}>{name[0]!.toUpperCase() + name.slice(1)}</button>)}<button className="collapse-inspector" aria-label={inspectorOpen ? 'Collapse inspector' : 'Expand inspector'} onClick={() => setInspectorOpen((open) => !open)}><Icon name={inspectorOpen ? 'down' : 'up'} /></button></div>
        <div className="inspector-scroll" role="tabpanel">{tab === 'edit' ? <PropertiesPanel onCut={() => setAiCutModalOpen(true)} /> : tab === 'layers' ? <LayersPanel /> : <HistoryPanel />}</div>
        <div className="inspector-utilities"><button aria-label="Open AI Studio Ω" onClick={() => setAiStudioOpen(true)}><Icon name="spark" />AI Studio</button><button aria-label="Ω System Check" onClick={() => setDiagnosticsOpen(true)}><Icon name="check" />System Check</button></div>
      </aside>
    </div>
    <StatusBar />
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => useEditorStore.getState().setNotice(null)}><Icon name="close" /></button></div>}
    <SystemDiagnostics open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
    {aiStudioOpen && <div className="modal-backdrop" onClick={() => setAiStudioOpen(false)}><section className="editor-modal ai-modal" role="dialog" aria-modal="true" aria-label="AI Studio" onClick={(e) => e.stopPropagation()}><header><h2>AI Studio</h2><button aria-label="Close AI Studio" onClick={() => setAiStudioOpen(false)}><Icon name="close" /></button></header><AiEditAssistant /></section></div>}
    <FontExtractModal open={fontModalOpen} onClose={() => { setFontModalOpen(false); useEditorStore.getState().setActiveTool('move'); }} />
    <AiCutModal open={aiCutModalOpen} onClose={() => { setAiCutModalOpen(false); useEditorStore.getState().setActiveTool('move'); }} />
  </div>;
}
