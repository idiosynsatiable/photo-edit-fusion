import React from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { Icon } from './Icon.js';
export function LayersPanel(): React.JSX.Element {
  const s = useEditorStore();
  return <div className="layers-content"><div className="panel-heading"><h2>Layers</h2><span>{s.doc.layerOrder.length}</span></div>
    {!s.doc.layerOrder.length && <div className="panel-empty"><Icon name="shapes" size={32} /><p>Add an image, text or shape to get started.</p><button onClick={() => document.getElementById('add-image-input')?.click()}><Icon name="plus" />Add Images</button></div>}
    {[...s.doc.layerOrder].reverse().map((id) => { const l = s.doc.layers[id]!; return <div key={id} className={`layer-row ${s.selectedLayerId === id ? 'selected' : ''}`}>
      <button className="layer-select" onClick={() => s.selectLayer(id)} aria-label={`Select ${l.name}`}><span className="layer-thumb checker">{l.type === 'image' ? <img src={s.doc.bitmaps[l.bitmapId]} alt="" /> : <Icon name={l.type === 'text' ? 'text' : 'shapes'} />}</span><span><strong>{l.name}</strong><small>{l.type}{l.maskBitmapId ? ' · masked' : ''}</small></span></button>
      <button aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`} onClick={() => s.setVisible(id, !l.visible)}><Icon name={l.visible ? 'eye' : 'hidden'} size={16} /></button><button aria-label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`} onClick={() => s.setLocked(id, !l.locked)}><Icon name={l.locked ? 'lock' : 'unlock'} size={15} /></button>
    </div>; })}
    {s.selectedLayerId && <div className="layer-actions">{[
      { name: 'Bring forward', icon: 'up', run: () => s.reorder(s.selectedLayerId!, s.doc.layerOrder.indexOf(s.selectedLayerId!) + 1) },
      { name: 'Send backward', icon: 'down', run: () => s.reorder(s.selectedLayerId!, s.doc.layerOrder.indexOf(s.selectedLayerId!) - 1) },
      { name: 'Duplicate layer', icon: 'copy', run: () => s.duplicate(s.selectedLayerId!) },
      { name: 'Delete layer', icon: 'trash', run: () => s.removeLayer(s.selectedLayerId!) },
    ].map((a) => <button key={a.name} aria-label={a.name} title={a.name} onClick={a.run}><Icon name={a.icon} /></button>)}</div>}
    <div className="panel-add"><button onClick={() => document.getElementById('add-image-input')?.click()}><Icon name="plus" />Image</button><button onClick={() => s.addText('Your text')}><Icon name="text" />Text</button><button aria-label="Add ellipse shape" onClick={() => s.addShape('ellipse')}><Icon name="shapes" />Shape</button></div>
  </div>;
}
export function HistoryPanel(): React.JSX.Element {
  const s = useEditorStore(), history = s.history.describe();
  return <div className="history-content"><h2>History</h2><p className="muted">One step per canvas gesture. Up to 200 edits in this session.</p><div className="button-row"><button onClick={s.undo} disabled={!history.undo.length}><Icon name="undo" />Undo</button><button onClick={s.redo} disabled={!history.redo.length}><Icon name="redo" />Redo</button></div>
    {!history.undo.length && <p className="muted">Your edits will appear here.</p>}<ol>{[...history.undo].reverse().map((label, i) => <li key={i}><span>{history.undo.length - i}</span>{label}</li>)}</ol>
    {!!history.redo.length && <p className="muted">{history.redo.length} edit(s) available to redo.</p>}
  </div>;
}
