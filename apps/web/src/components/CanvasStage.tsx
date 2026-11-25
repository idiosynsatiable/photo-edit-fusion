import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { hitTest, layerLocalSize } from '@pef/canvas-engine';
import { rasterizePolygon, magicWand } from '@pef/cut-tools';
import { renderDocument, loadBitmaps } from '../lib/render.js';
import { importImages } from '../lib/editor-files.js';
import { Icon } from './Icon.js';
import type { Layer, Vec2 } from '@pef/shared';

export function CanvasStage(): React.JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), overlayRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef(new Map<string, HTMLImageElement>());
  const s = useEditorStore(), { doc, zoom, activeTool, selectedLayerId } = s;
  const gesture = useRef<{ start: Vec2; layer?: Layer; resize?: boolean; points: Vec2[]; mask?: HTMLCanvasElement; last?: Vec2 } | null>(null);
  const pointers = useRef(new Map<number, Vec2>()), pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const [marquee, setMarquee] = useState<Vec2[]>([]), [draggingOver, setDraggingOver] = useState(false), [before, setBefore] = useState(false);
  const original = useRef(doc);
  useEffect(() => { original.current = doc; }, [doc.id]);
  useEffect(() => {
    const element = stageRef.current; if (!element) return;
    const fit = () => { const state = useEditorStore.getState(), rect = element.getBoundingClientRect(); state.setZoom(Math.min(1, Math.max(.01, (rect.width - 56) / state.doc.width), Math.max(.01, (rect.height - 80) / state.doc.height))); };
    fit(); const observer = new ResizeObserver(fit); observer.observe(element); return () => observer.disconnect();
  }, [doc.id, s.fitRequest]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const renderDoc = before ? original.current : doc, bitmaps = new Map<string, HTMLImageElement | HTMLCanvasElement>(cache.current);
      await loadBitmaps(renderDoc, bitmaps); if (cancelled) return;
      cache.current = new Map([...bitmaps.entries()].filter((entry): entry is [string, HTMLImageElement] => entry[1] instanceof HTMLImageElement));
      const c = canvasRef.current; if (!c) return;
      if (c.width !== doc.width) c.width = doc.width; if (c.height !== doc.height) c.height = doc.height;
      const ctx = c.getContext('2d'); if (ctx) renderDocument({ doc: { ...renderDoc, width: doc.width, height: doc.height }, ctx, bitmapCache: bitmaps });
    })().catch(() => s.setNotice('Could not render an image. Reopen it or undo your last change.'));
    return () => { cancelled = true; };
  }, [doc, before]);
  useEffect(() => {
    const c = overlayRef.current; if (!c) return; c.width = doc.width; c.height = doc.height;
    const ctx = c.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#d7fa86'; ctx.lineWidth = 1.5 / zoom;
    if (marquee.length > 1) { ctx.beginPath(); ctx.moveTo(marquee[0]!.x, marquee[0]!.y); for (const p of marquee.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.stroke(); }
    const layer = selectedLayerId ? doc.layers[selectedLayerId] : null;
    if (layer && !before && layer.visible && activeTool === 'move') {
      const { w, h } = layerLocalSize(layer), t = layer.transform;
      ctx.save(); ctx.translate(t.position.x, t.position.y); ctx.rotate(t.rotation); ctx.scale(t.scale.x, t.scale.y);
      ctx.lineWidth = 1.5 / zoom / Math.max(Math.abs(t.scale.x), .01); ctx.strokeRect(-w * t.anchor.x, -h * t.anchor.y, w, h);
      if (!layer.locked) { const size = 10 / zoom / Math.max(Math.abs(t.scale.x), .01); ctx.fillStyle = '#d7fa86'; ctx.fillRect(w * (1 - t.anchor.x) - size / 2, h * (1 - t.anchor.y) - size / 2, size, size); }
      ctx.restore();
    }
  }, [doc, selectedLayerId, marquee, zoom, activeTool, before]);
  function point(e: React.PointerEvent): Vec2 { const r = canvasRef.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * doc.width, y: (e.clientY - r.top) / r.height * doc.height }; }
  function local(p: Vec2, l: Layer): Vec2 { const t = l.transform, { w, h } = layerLocalSize(l), dx = p.x - t.position.x, dy = p.y - t.position.y; return { x: (Math.cos(t.rotation) * dx + Math.sin(t.rotation) * dy) / t.scale.x + w * t.anchor.x, y: (-Math.sin(t.rotation) * dx + Math.cos(t.rotation) * dy) / t.scale.y + h * t.anchor.y }; }
  function baseMask(layer: Layer): HTMLCanvasElement | null {
    if (layer.type !== 'image') return null;
    const c = document.createElement('canvas'); c.width = layer.sourceWidth; c.height = layer.sourceHeight; const ctx = c.getContext('2d'); if (!ctx) return null;
    const mask = layer.maskBitmapId ? cache.current.get(layer.maskBitmapId) : null;
    if (mask) ctx.drawImage(mask, 0, 0, c.width, c.height); else { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.globalCompositeOperation = 'source-over'; return c;
  }
  function saveMask(layer: Layer, c: HTMLCanvasElement, label: string): void { const id = crypto.randomUUID(), data = c.toDataURL('image/png'); s.commit(label, (d) => { if (!d.layers[layer.id]) return; d.bitmaps[id] = data; d.layers[layer.id]!.maskBitmapId = id; }); }
  function erase(p: Vec2): void {
    const g = gesture.current; if (!g?.layer || !g.mask) return; const ctx = g.mask.getContext('2d')!, q = local(p, g.layer), last = g.last ?? q;
    ctx.globalCompositeOperation = s.restoreMask ? 'source-over' : 'destination-out'; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s.brushSize / Math.abs(g.layer.transform.scale.x); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(q.x + .01, q.y); ctx.stroke(); g.last = q;
    const ctxPreview = canvasRef.current?.getContext('2d'), tempId = '__gesture_mask';
    if (ctxPreview) { const previewCache = new Map<string, HTMLImageElement | HTMLCanvasElement>(cache.current); previewCache.set(tempId, g.mask); renderDocument({ doc: { ...doc, layers: { ...doc.layers, [g.layer.id]: { ...g.layer, maskBitmapId: tempId } } }, ctx: ctxPreview, bitmapCache: previewCache }); }
  }
  function down(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0 || before) return;
    e.currentTarget.setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) { s.cancelGesture(); gesture.current = null; const pts = [...pointers.current.values()]; pinch.current = { distance: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y), zoom }; return; }
    const p = point(e), selected = selectedLayerId ? doc.layers[selectedLayerId] : null;
    if (activeTool === 'move') {
      let resizing = false;
      if (selected && !selected.locked) { const q = local(p, selected), size = layerLocalSize(selected); resizing = Math.hypot((q.x - size.w) * selected.transform.scale.x, (q.y - size.h) * selected.transform.scale.y) * zoom < 20; }
      const layer = resizing ? selected : hitTest(doc, p); s.selectLayer(layer?.id ?? null);
      if (layer && !layer.locked) { s.beginGesture(); gesture.current = { start: p, layer, resize: resizing, points: [] }; }
    } else if (activeTool === 'crop') gesture.current = { start: p, points: [p] };
    else if (['lasso', 'polygon', 'magic-wand', 'eraser'].includes(activeTool)) {
      if (!selected || selected.type !== 'image' || selected.locked) { s.setNotice('Select an unlocked image layer in Layers first.'); return; }
      if (activeTool === 'magic-wand') { wand(p, selected); return; }
      gesture.current = { start: p, layer: selected, points: [p] };
      if (activeTool === 'eraser') { s.beginGesture(); gesture.current.mask = baseMask(selected) ?? undefined; erase(p); }
    }
  }
  function move(e: React.PointerEvent<HTMLDivElement>): void {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size > 1) { const pts = [...pointers.current.values()]; s.setZoom(pinch.current.zoom * Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) / Math.max(1, pinch.current.distance)); return; }
    const g = gesture.current; if (!g) return; const p = point(e);
    if (activeTool === 'move' && g.layer) {
      const t = g.layer.transform;
      if (g.resize) { const a = Math.hypot(g.start.x - t.position.x, g.start.y - t.position.y), b = Math.hypot(p.x - t.position.x, p.y - t.position.y), k = Math.max(.02, b / Math.max(1, a)); s.previewLayer(g.layer.id, { transform: { ...t, scale: { x: t.scale.x * k, y: t.scale.y * k } } }); }
      else s.previewLayer(g.layer.id, { transform: { ...t, position: { x: t.position.x + p.x - g.start.x, y: t.position.y + p.y - g.start.y } } });
    } else if (activeTool === 'crop') { setMarquee([g.start, { x: p.x, y: g.start.y }, p, { x: g.start.x, y: p.y }]); g.points = [g.start, p]; }
    else if (activeTool === 'eraser') erase(p);
    else { g.points.push(p); setMarquee([...g.points]); }
  }
  function up(e: React.PointerEvent<HTMLDivElement>, cancel = false): void {
    pointers.current.delete(e.pointerId); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (pinch.current) { if (!pointers.current.size) pinch.current = null; return; }
    const g = gesture.current; gesture.current = null; setMarquee([]);
    if (!g) return;
    if (cancel) { s.cancelGesture(); const ctx = canvasRef.current?.getContext('2d'); if (ctx) renderDocument({ doc, ctx, bitmapCache: cache.current }); return; }
    if (activeTool === 'move') s.endGesture(g.resize ? 'Resize layer' : 'Move layer');
    else if (activeTool === 'crop' && g.points.length > 1) { const end = g.points[1]!, x = Math.round(Math.max(0, Math.min(g.start.x, end.x))), y = Math.round(Math.max(0, Math.min(g.start.y, end.y))), w = Math.round(Math.min(doc.width, Math.max(g.start.x, end.x)) - x), h = Math.round(Math.min(doc.height, Math.max(g.start.y, end.y)) - y); if (w > 2 && h > 2) s.cropCanvas(x, y, w, h); }
    else if (activeTool === 'eraser' && g.layer && g.mask) { s.cancelGesture(); saveMask(g.layer, g.mask, s.restoreMask ? 'Restore mask brush' : 'Erase mask'); }
    else if (g.layer && g.points.length > 2 && g.layer.type === 'image') {
      const c = baseMask(g.layer); if (!c) return; const ctx = c.getContext('2d')!, data = ctx.getImageData(0, 0, c.width, c.height), mask = rasterizePolygon(c.width, c.height, g.points.map((p) => local(p, g.layer!)));
      for (let i = 0; i < mask.data.length; i++) data.data[i * 4 + 3] = Math.round(data.data[i * 4 + 3]! * mask.data[i]! / 255);
      ctx.putImageData(data, 0, 0); saveMask(g.layer, c, 'Lasso cut');
    }
  }
  function wand(p: Vec2, layer: Layer): void {
    if (layer.type !== 'image') return; const img = cache.current.get(layer.bitmapId), c = baseMask(layer); if (!img || !c) return;
    const source = document.createElement('canvas'); source.width = c.width; source.height = c.height; const sourceCtx = source.getContext('2d')!; sourceCtx.drawImage(img, 0, 0);
    const q = local(p, layer); if (q.x < 0 || q.y < 0 || q.x >= c.width || q.y >= c.height) return;
    const mask = magicWand({ width: c.width, height: c.height, pixels: sourceCtx.getImageData(0, 0, c.width, c.height).data, seed: { x: Math.floor(q.x), y: Math.floor(q.y) }, tolerance: s.wandTolerance, contiguous: true });
    const ctx = c.getContext('2d')!, data = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < mask.data.length; i++) data.data[i * 4 + 3] = Math.round(data.data[i * 4 + 3]! * (255 - mask.data[i]!) / 255);
    ctx.putImageData(data, 0, 0); saveMask(layer, c, 'Magic wand cut');
  }
  return <main className={`canvas-stage ${draggingOver ? 'drag-over' : ''}`} ref={stageRef}
    onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }} onDragLeave={() => setDraggingOver(false)} onDrop={(e) => { e.preventDefault(); setDraggingOver(false); void importImages([...e.dataTransfer.files]); }}
    onWheel={(e) => { if (e.ctrlKey || e.metaKey) s.setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }}>
    <div className="canvas-area">
      <div className="artboard checker" style={{ width: doc.width * zoom, height: doc.height * zoom, touchAction: 'none', cursor: activeTool === 'move' ? 'default' : 'crosshair' }} onPointerDown={down} onPointerMove={move} onPointerUp={(e) => up(e)} onPointerCancel={(e) => up(e, true)}>
        <canvas aria-label="Photo editing canvas" ref={canvasRef} /><canvas ref={overlayRef} className="canvas-overlay" />
      </div>
      {!doc.layerOrder.length && <div className="empty-canvas"><Icon name="download" size={40} /><h1>Make something yours.</h1><p>Drop photos here or add your first image.</p><button className="primary" onClick={() => document.getElementById('open-image-input')?.click()}><Icon name="image" />Open Image</button></div>}
    </div>
    <div className="canvas-caption"><span>{doc.width} × {doc.height}</span><span>{doc.background[3] === 0 ? 'Transparent' : 'Color background'}</span>{doc.layerOrder.length > 0 && <button onPointerDown={() => setBefore(true)} onPointerUp={() => setBefore(false)} onPointerLeave={() => setBefore(false)} onKeyDown={(e) => { if (e.key === ' ') setBefore(true); }} onKeyUp={() => setBefore(false)}>Hold to compare</button>}</div>
  </main>;
}
