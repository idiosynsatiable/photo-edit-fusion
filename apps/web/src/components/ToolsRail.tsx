import React from 'react';
import { useEditorStore, type ToolId } from '../store/editor-store.js';
import { Icon } from './Icon.js';
const tools: { id: ToolId; name: string; icon: string; hint: string }[] = [
  { id: 'move', name: 'Move', icon: 'move', hint: 'Move (V)' },
  { id: 'crop', name: 'Crop', icon: 'crop', hint: 'Crop (C)' },
  { id: 'adjust', name: 'Adjust', icon: 'adjust', hint: 'Image adjustments' },
  { id: 'text', name: 'Text', icon: 'text', hint: 'Text (T)' },
  { id: 'lasso', name: 'Cutout', icon: 'cut', hint: 'Lasso (L)' },
  { id: 'eraser', name: 'Eraser', icon: 'eraser', hint: 'Eraser (E)' },
  { id: 'font-extract', name: 'Font', icon: 'font', hint: 'Font Extract (F)' },
];
export function ToolsRail({ onEdit }: { onEdit: (open?: boolean) => void }): React.JSX.Element {
  const s = useEditorStore();
  return <nav className="tools-rail" aria-label="Editing tools">
    {tools.map((t, i) => <React.Fragment key={t.id}>
      {i === 4 && <button className="tool" aria-label="Add rectangle shape" onClick={() => { s.addShape('rectangle'); s.setActiveTool('move'); onEdit(); }}><Icon name="shapes" size={23} /><span>Shapes</span></button>}
      <button className={`tool ${s.activeTool === t.id || (t.id === 'lasso' && ['magic-wand', 'polygon', 'ai-cut'].includes(s.activeTool)) ? 'active' : ''}`} aria-label={t.hint} title={t.hint} onClick={() => { s.setActiveTool(t.id); if (t.id === 'text') s.addText('Your text'); onEdit(t.id !== 'move'); }}><Icon name={t.icon} size={23} /><span>{t.name}</span></button>
    </React.Fragment>)}
  </nav>;
}
