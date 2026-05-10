import React, { useRef } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { fromProjectFile, toProjectFile } from '@pef/canvas-engine';
import { downloadBlob, loadImage, readFileAsDataUrl } from '../lib/file-utils.js';

interface Props {
  onOpenFontModal: () => void;
  onOpenAiCutModal: () => void;
}

export function Toolbar({ onOpenFontModal, onOpenAiCutModal }: Props): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const { addImage, applyDoc, doc, undo, redo, history } = useEditorStore((s) => ({
    addImage: s.addImage,
    applyDoc: s.applyDoc,
    doc: s.doc,
    undo: s.undo,
    redo: s.redo,
    history: s.history,
  }));

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    addImage({
      bitmapId: `b_${Date.now()}`,
      bitmapDataUrl: dataUrl,
      sourceWidth: img.naturalWidth,
      sourceHeight: img.naturalHeight,
      name: file.name,
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onPickProject(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const next = fromProjectFile(text);
    applyDoc(next);
    if (projectRef.current) projectRef.current.value = '';
  }

  function exportProject(): void {
    const json = toProjectFile(doc);
    downloadBlob(new Blob([json], { type: 'application/json' }), `${doc.name}.pef.json`);
  }

  function exportPng(): void {
    const canvas = document.getElementById('pef-export-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${doc.name}.png`);
    }, 'image/png');
  }

  return (
    <header className="h-12 border-b border-ink-700 bg-ink-900 flex items-center px-3 gap-2 select-none">
      <div className="font-semibold tracking-wide text-zinc-200">Photo Edit Fusion</div>
      <div className="w-px h-6 bg-ink-700 mx-1" />
      <button onClick={() => fileRef.current?.click()} className="btn">Open Image</button>
      <button onClick={() => projectRef.current?.click()} className="btn">Open Project</button>
      <button onClick={exportProject} className="btn">Save Project</button>
      <button onClick={exportPng} className="btn">Export PNG</button>
      <div className="w-px h-6 bg-ink-700 mx-1" />
      <button onClick={undo} disabled={!history.canUndo()} className="btn-ghost">Undo</button>
      <button onClick={redo} disabled={!history.canRedo()} className="btn-ghost">Redo</button>
      <div className="flex-1" />
      <button onClick={onOpenAiCutModal} className="btn-accent">AI Cut</button>
      <button onClick={onOpenFontModal} className="btn-accent">Extract Font</button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
      <input ref={projectRef} type="file" accept=".json,application/json" className="hidden" onChange={onPickProject} />
      <style>{`
        .btn { padding: 4px 10px; border-radius: 6px; background: #26262d; color: #e5e5e7; font-size: 13px; }
        .btn:hover { background: #34343d; }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-ghost { padding: 4px 10px; border-radius: 6px; color: #c8c8cf; font-size: 13px; }
        .btn-ghost:hover { background: #1f1f25; }
        .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-accent { padding: 4px 12px; border-radius: 6px; background: #ec4899; color: white; font-weight: 500; font-size: 13px; }
        .btn-accent:hover { background: #db2777; }
      `}</style>
    </header>
  );
}
