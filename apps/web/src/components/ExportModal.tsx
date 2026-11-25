import React, { useState } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { exportImage } from '../lib/editor-files.js';
import { layerWorldBounds } from '@pef/canvas-engine';
import { Icon } from './Icon.js';

export function ExportModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const doc = useEditorStore((s) => s.doc), selectedId = useEditorStore((s) => s.selectedLayerId);
  const [onlyLayer, setOnlyLayer] = useState(false);
  const layer = selectedId ? doc.layers[selectedId] : null, bounds = layer ? layerWorldBounds(layer) : null;
  const source = onlyLayer && layer && bounds ? { ...doc, width: Math.max(1, Math.ceil(bounds.maxX) - Math.floor(bounds.minX)), height: Math.max(1, Math.ceil(bounds.maxY) - Math.floor(bounds.minY)), background: [0, 0, 0, 0] as [number, number, number, number], layerOrder: [layer.id], layers: { [layer.id]: { ...layer, visible: true, transform: { ...layer.transform, position: { x: layer.transform.position.x - Math.floor(bounds.minX), y: layer.transform.position.y - Math.floor(bounds.minY) } } } } } : doc;
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [width, setWidth] = useState(doc.width), [quality, setQuality] = useState(.92), [background, setBackground] = useState('transparent');
  const [ppi, setPpi] = useState(300), [unit, setUnit] = useState<'in' | 'cm'>('in');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const height = Math.max(1, Math.round(width * source.height / source.width));
  async function run(): Promise<void> {
    setBusy(true); setError('');
    try { await exportImage(source, { format, width, height, quality, background, ppi }); useEditorStore.getState().setNotice('Your image is ready. Check Downloads or your device share sheet.'); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Export failed.'); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onClick={onClose}><section className="editor-modal" role="dialog" aria-modal="true" aria-label="Export image" onClick={(e) => e.stopPropagation()}>
    <header><h2>Export image</h2><button aria-label="Close export" onClick={onClose}><Icon name="close" /></button></header>
    <p className="muted">Save a finished image. Save Project keeps your layers editable.</p>
    {layer && <label className="check-field"><input type="checkbox" checked={onlyLayer} onChange={(e) => { setOnlyLayer(e.target.checked); setWidth(e.target.checked && bounds ? Math.max(1, Math.ceil(bounds.maxX) - Math.floor(bounds.minX)) : doc.width); }} />Export selected layer as a sticker</label>}
    <label className="field">Format<select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="png">PNG · transparent, lossless</option><option value="jpeg">JPEG · smaller photo files</option><option value="webp">WebP · compact with transparency</option></select></label>
    <div className="field-grid"><label className="field">Width (px)<input aria-label="Width (px)" type="number" min={1} max={8192} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label><label className="field">Height (px)<input aria-label="Height (px)" readOnly value={height} /></label></div>
    <p className="muted">Aspect ratio preserved · {((width * height) / 1e6).toFixed(1)} megapixels</p>
    <h3>Print size</h3><div className="field-grid"><label className="field">Resolution (PPI)<input aria-label="Resolution (PPI)" type="number" min={1} max={1200} value={ppi} onChange={(e) => setPpi(Number(e.target.value))} /></label><label className="field">Units<select aria-label="Print units" value={unit} onChange={(e) => setUnit(e.target.value as 'in' | 'cm')}><option value="in">Inches</option><option value="cm">Centimeters</option></select></label></div>
    <div className="field-grid"><label className="field">Print width ({unit})<input aria-label="Print width" type="number" min={.01} step={.01} value={Number((width / Math.max(1,ppi) * (unit === 'cm' ? 2.54 : 1)).toFixed(2))} onChange={(e) => setWidth(Math.max(1,Math.round(Number(e.target.value) / (unit === 'cm' ? 2.54 : 1) * ppi)))} /></label><label className="field">Print height ({unit})<input aria-label="Print height" readOnly value={(height / Math.max(1,ppi) * (unit === 'cm' ? 2.54 : 1)).toFixed(2)} /></label></div>
    <p className="muted">{format === 'webp' ? 'WebP uses pixel dimensions; choose PNG or JPEG to embed print density.' : 'Print density is embedded in the file. Your printer may still apply its own scaling.'} Changing PPI alone does not add detail.</p>
    {(ppi < 240 || width > source.width || Object.values(source.layers).some((l) => l.type === 'image' && l.visible && Math.min(ppi / Math.max(.001,Math.abs(l.transform.scale.x) * width / source.width),ppi / Math.max(.001,Math.abs(l.transform.scale.y) * height / source.height)) < 240)) && <p role="status" className="error">Print detail warning: some imagery is below 240 effective PPI or will be enlarged. Inspect fine edges at 100% before printing. A higher PPI label cannot restore missing detail.</p>}
    {format !== 'png' && <label className="field">Quality · {Math.round(quality * 100)}%<input type="range" min={.1} max={1} step={.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></label>}
    <label className="field">Background<select aria-label="Background" value={background} onChange={(e) => setBackground(e.target.value)}><option value="transparent">{format === 'jpeg' ? 'White (JPEG has no transparency)' : 'Preserve transparency'}</option><option value="#ffffff">White</option><option value="#000000">Black</option></select></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary wide" disabled={busy} onClick={() => void run()}><Icon name="export" />{busy ? 'Exporting…' : `Export ${format.toUpperCase()}`}</button>
  </section></div>;
}
