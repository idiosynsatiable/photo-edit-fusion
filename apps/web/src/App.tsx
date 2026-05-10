import React, { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar.js';
import { ToolsRail } from './components/ToolsRail.js';
import { LayersPanel } from './components/LayersPanel.js';
import { PropertiesPanel } from './components/PropertiesPanel.js';
import { CanvasStage } from './components/CanvasStage.js';
import { StatusBar } from './components/StatusBar.js';
import { FontExtractModal } from './components/FontExtractModal.js';
import { AiCutModal } from './components/AiCutModal.js';
import { useEditorStore } from './store/editor-store.js';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts.js';

export function App(): React.JSX.Element {
  const [fontModalOpen, setFontModalOpen] = useState(false);
  const [aiCutModalOpen, setAiCutModalOpen] = useState(false);
  const tool = useEditorStore((s) => s.activeTool);

  useKeyboardShortcuts();

  useEffect(() => {
    if (tool === 'font-extract') setFontModalOpen(true);
    if (tool === 'ai-cut') setAiCutModalOpen(true);
  }, [tool]);

  return (
    <div className="h-screen flex flex-col bg-ink-950 text-zinc-100">
      <Toolbar onOpenFontModal={() => setFontModalOpen(true)} onOpenAiCutModal={() => setAiCutModalOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        <ToolsRail />
        <CanvasStage />
        <div className="w-72 border-l border-ink-700 flex flex-col">
          <LayersPanel />
          <PropertiesPanel />
        </div>
      </div>
      <StatusBar />
      <FontExtractModal open={fontModalOpen} onClose={() => setFontModalOpen(false)} />
      <AiCutModal open={aiCutModalOpen} onClose={() => setAiCutModalOpen(false)} />
    </div>
  );
}
