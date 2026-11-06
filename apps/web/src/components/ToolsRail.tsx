import React from 'react';
import { useEditorStore, type ToolId } from '../store/editor-store.js';

interface ToolDef {
  id: ToolId;
  label: string;
  hint: string;
}

const TOOLS: ToolDef[] = [
  { id: 'move', label: 'V', hint: 'Move (V)' },
  { id: 'text', label: 'T', hint: 'Text (T)' },
  { id: 'lasso', label: '∿', hint: 'Lasso (L)' },
  { id: 'polygon', label: '⬠', hint: 'Polygon (P)' },
  { id: 'magic-wand', label: '✶', hint: 'Magic Wand (W)' },
  { id: 'ai-cut', label: '✂', hint: 'AI Cut' },
  { id: 'font-extract', label: 'F', hint: 'Font Extract (F)' },
];

export function ToolsRail(): React.JSX.Element {
  const tool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setActiveTool);
  const addText = useEditorStore((s) => s.addText);
  const addShape = useEditorStore((s) => s.addShape);

  return (
    <aside className="w-12 shrink-0 border-r border-ink-700 bg-ink-900 flex flex-col items-center py-2 gap-1">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          aria-label={t.hint}
          title={t.hint}
          onClick={() => {
            setTool(t.id);
            if (t.id === 'text') addText('Type something');
          }}
          className={`w-9 h-9 shrink-0 rounded-md flex items-center justify-center font-semibold ${
            tool === t.id ? 'bg-pink-500 text-white' : 'text-zinc-300 hover:bg-ink-700'
          }`}
        >
          {t.label}
        </button>
      ))}
      <div className="my-1 h-px w-7 bg-ink-700" />
      <button aria-label="Add rectangle shape" title="Add rectangle shape" onClick={() => addShape('rectangle')} className="w-9 h-9 shrink-0 rounded-md text-zinc-300 hover:bg-ink-700">▭</button>
      <button aria-label="Add ellipse shape" title="Add ellipse shape" onClick={() => addShape('ellipse')} className="w-9 h-9 shrink-0 rounded-md text-zinc-300 hover:bg-ink-700">◯</button>
    </aside>
  );
}
