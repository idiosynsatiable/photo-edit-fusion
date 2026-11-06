import React, { useRef } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { createDocument, fromProjectFile, toProjectFile } from '@pef/canvas-engine';
import { downloadBlob, loadImage, readFileAsDataUrl } from '../lib/file-utils.js';

interface Props {
  onOpenFontModal: () => void;
  onOpenAiCutModal: () => void;
}

export function Toolbar({ onOpenFontModal, onOpenAiCutModal }: Props): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const addImage = useEditorStore((s) => s.addImage);
  const applyDoc = useEditorStore((s) => s.applyDoc);
  const doc = useEditorStore((s) => s.doc);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const history = useEditorStore((s) => s.history);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const nextDocument = createDocument({
      name: file.name.replace(/\.[^.]+$/, '') || 'Untitled',
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    nextDocument.background = [0, 0, 0, 0];
    applyDoc(nextDocument);
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

  function createBlankCanvas(): void {
    const nextDocument = createDocument({ name: 'Untitled', width: 1920, height: 1080 });
    nextDocument.background = [0, 0, 0, 0];
    applyDoc(nextDocument);
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
    <header className="h-12 min-h-12 shrink-0 border-b border-ink-700 bg-ink-900 flex flex-nowrap items-center overflow-x-auto px-3 gap-2 select-none">
      <div className="shrink-0 font-semibold tracking-wide text-zinc-200">Photo Edit Fusion</div>
      <div className="w-px h-6 bg-ink-700 mx-1 shrink-0" />
      <button onClick={createBlankCanvas} className="btn shrink-0">New Canvas</button>
      <button onClick={() => fileRef.current?.click()} className="btn shrink-0">Open Image</button>
      <button onClick={() => projectRef.current?.click()} className="btn shrink-0">Open Project</button>
      <button onClick={exportProject} className="btn shrink-0">Save Project</button>
      <button onClick={exportPng} className="btn shrink-0">Export PNG</button>
      <div className="w-px h-6 bg-ink-700 mx-1 shrink-0" />
      <button onClick={undo} disabled={!history.canUndo()} className="btn-ghost shrink-0">Undo</button>
      <button onClick={redo} disabled={!history.canRedo()} className="btn-ghost shrink-0">Redo</button>
      <div className="flex-1 min-w-2" />
      <button onClick={onOpenAiCutModal} className="btn-accent shrink-0">AI Cut</button>
      <button onClick={onOpenFontModal} className="btn-accent shrink-0">Extract Font</button>
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
