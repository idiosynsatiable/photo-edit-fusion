import React, { useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { createDocument, fromProjectFile, toProjectFile } from '@pef/canvas-engine';
import { downloadBlob } from '../lib/file-utils.js';
import { importImages } from '../lib/editor-files.js';
import { ExportModal } from './ExportModal.js';
import { Icon } from './Icon.js';

export function Toolbar(): React.JSX.Element {
  const imageRef = useRef<HTMLInputElement>(null), addRef = useRef<HTMLInputElement>(null), cameraRef = useRef<HTMLInputElement>(null), projectRef = useRef<HTMLInputElement>(null);
  const s = useEditorStore();
  const [exportOpen, setExportOpen] = useState(false);
  function canReplace(): boolean { return !s.doc.layerOrder.length || window.confirm('Start a new project? Save Project first to keep a separate editable copy. Your current autosave will be replaced.'); }
  async function pick(e: React.ChangeEvent<HTMLInputElement>, replace: boolean): Promise<void> {
    const files = [...(e.target.files ?? [])]; e.target.value = ''; if (!files.length || (replace && !canReplace())) return; await importImages(files, replace);
  }
  async function openProject(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file || !canReplace()) return;
    try { if (file.size > 100 * 1024 * 1024) throw new Error('Project files must be smaller than 100 MB.'); s.applyDoc(fromProjectFile(await file.text())); }
    catch { s.setNotice('Could not open this project. Choose a valid .pef.json file saved by Photo Edit Fusion.'); }
  }
  async function save(): Promise<void> { try { await downloadBlob(new Blob([toProjectFile(s.doc)], { type: 'application/json' }), `${s.doc.name || 'Untitled'}.pef.json`); s.setNotice('Editable project saved. Use Open Project to continue later.'); } catch { s.setNotice('Could not save project. Check available device storage.'); } }
  return <>
    <header className="app-header"><div className="brand"><span className="brand-mark" /><div><strong>Photo Edit Fusion</strong><span>Your everyday creative studio</span></div></div>
      <input className="project-name" aria-label="Project name" value={s.doc.name} maxLength={80} onChange={(e) => s.commit('Rename project', (d) => { d.name = e.target.value; })} />
      <div className="header-actions"><button onClick={() => projectRef.current?.click()}><Icon name="folder" /><span>Open Project</span></button><button onClick={() => void save()}><Icon name="save" /><span>Save Project</span></button><button className="primary" onClick={() => setExportOpen(true)}><Icon name="export" /><span>Export</span></button></div>
    </header>
    <nav className="file-toolbar" aria-label="File and view controls"><div className="file-actions">
      <button onClick={() => { if (!canReplace()) return; const next = createDocument({ name: 'Untitled', width: 1600, height: 1000 }); next.background = [0, 0, 0, 0]; s.applyDoc(next); }}><Icon name="plus" />New Canvas</button>
      <button onClick={() => imageRef.current?.click()}><Icon name="image" />Open Image</button><button onClick={() => addRef.current?.click()}><Icon name="copy" />Add Images</button><button onClick={() => cameraRef.current?.click()}><Icon name="camera" />Take Photo</button>
    </div><div className="undo-actions"><button aria-label="Undo" title="Undo (Ctrl+Z)" onClick={s.undo} disabled={!s.history.canUndo()}><Icon name="undo" /></button><button aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={s.redo} disabled={!s.history.canRedo()}><Icon name="redo" /></button></div>
    <div className="zoom-actions"><button aria-label="Zoom out" onClick={() => s.setZoom(s.zoom / 1.25)}><Icon name="minus" /></button><button onClick={s.fitCanvas} title="Fit canvas to workspace">Fit</button><span>{Math.round(s.zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => s.setZoom(s.zoom * 1.25)}><Icon name="plus" /></button></div></nav>
    <input id="open-image-input" ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e, true)} />
    <input id="add-image-input" ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e, false)} />
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e, false)} />
    <input ref={projectRef} type="file" accept=".json,application/json" hidden onChange={(e) => void openProject(e)} />
    {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
  </>;
}
