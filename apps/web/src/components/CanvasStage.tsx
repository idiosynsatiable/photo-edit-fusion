import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { hitTest } from '@pef/canvas-engine';
import { rasterizePolygon, magicWand, applyMaskToImage } from '@pef/cut-tools';
import { renderDocument, loadBitmaps } from '../lib/render.js';

interface Vec2 { x: number; y: number }

export function CanvasStage(): React.JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const bitmapsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const { doc, zoom, setZoom, activeTool, selectedLayerId, selectLayer, patchLayer, commit } = useEditorStore((s) => ({
    doc: s.doc,
    zoom: s.zoom,
    setZoom: s.setZoom,
    activeTool: s.activeTool,
    selectedLayerId: s.selectedLayerId,
    selectLayer: s.selectLayer,
    patchLayer: s.patchLayer,
    commit: s.commit,
  }));

  const [lassoPoints, setLassoPoints] = useState<Vec2[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [dragOffset, setDragOffset] = useState<Vec2 | null>(null);

  // Render whenever doc changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadBitmaps(doc, bitmapsRef.current);
      if (cancelled) return;
      const c = canvasRef.current;
      const ec = exportCanvasRef.current;
      if (c && ec) {
        c.width = doc.width;
        c.height = doc.height;
        ec.width = doc.width;
        ec.height = doc.height;
        const ctx = c.getContext('2d');
        const ectx = ec.getContext('2d');
        if (ctx) renderDocument({ doc, ctx, bitmapCache: bitmapsRef.current });
        if (ectx) renderDocument({ doc, ctx: ectx, bitmapCache: bitmapsRef.current });
      }
      drawOverlay();
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // Redraw overlay (selection/marquee) when overlay-relevant state changes
  useEffect(drawOverlay, [lassoPoints, selectedLayerId, doc]);

  function drawOverlay(): void {
    const c = overlayRef.current;
    if (!c) return;
    c.width = doc.width;
    c.height = doc.height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    if (lassoPoints.length > 1) {
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const p0 = lassoPoints[0]!;
      ctx.moveTo(p0.x, p0.y);
      for (const p of lassoPoints.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    if (selectedLayerId) {
      const layer = doc.layers[selectedLayerId];
      if (layer && layer.type !== 'group') {
        const w = 'sourceWidth' in layer ? layer.sourceWidth : layer.type === 'text' ? layer.fontSizePx * Math.max(1, layer.text.length * 0.55) : 'width' in layer ? layer.width : 0;
        const h = 'sourceHeight' in layer ? layer.sourceHeight : layer.type === 'text' ? layer.fontSizePx * layer.lineHeight : 'height' in layer ? layer.height : 0;
        ctx.save();
        ctx.translate(layer.transform.position.x, layer.transform.position.y);
        ctx.rotate(layer.transform.rotation);
        ctx.scale(layer.transform.scale.x, layer.transform.scale.y);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.strokeRect(-w * layer.transform.anchor.x, -h * layer.transform.anchor.y, w, h);
        ctx.restore();
      }
    }
  }

  function eventToDoc(e: React.PointerEvent<HTMLDivElement>): Vec2 {
    const target = canvasRef.current;
    if (!target) return { x: 0, y: 0 };
    const rect = target.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * doc.width,
      y: ((e.clientY - rect.top) / rect.height) * doc.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return;
    const p = eventToDoc(e);
    if (activeTool === 'move') {
      const hit = hitTest(doc, p);
      if (hit && hit.type !== 'group') {
        selectLayer(hit.id);
        setDragOffset({ x: p.x - hit.transform.position.x, y: p.y - hit.transform.position.y });
      } else {
        selectLayer(null);
      }
    } else if (activeTool === 'lasso' || activeTool === 'polygon') {
      setDrawing(true);
      setLassoPoints([p]);
    } else if (activeTool === 'magic-wand') {
      runMagicWand(p);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const p = eventToDoc(e);
    if (activeTool === 'move' && selectedLayerId && dragOffset) {
      const layer = doc.layers[selectedLayerId];
      if (layer) {
        patchLayer(selectedLayerId, {
          transform: { ...layer.transform, position: { x: p.x - dragOffset.x, y: p.y - dragOffset.y } },
        });
      }
    } else if (drawing && (activeTool === 'lasso' || activeTool === 'polygon')) {
      setLassoPoints((pts) => [...pts, p]);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    if (drawing) {
      setDrawing(false);
      if (lassoPoints.length >= 3 && selectedLayerId) {
        applyLassoCut();
      }
    }
    setDragOffset(null);
    void e;
  }

  function applyLassoCut(): void {
    if (!selectedLayerId) return;
    const layer = doc.layers[selectedLayerId];
    if (!layer || layer.type !== 'image') return;
    const img = bitmapsRef.current.get(layer.bitmapId);
    if (!img) return;

    // Build a temp canvas at source dimensions, paint the image, then mask
    const tmp = document.createElement('canvas');
    tmp.width = layer.sourceWidth;
    tmp.height = layer.sourceHeight;
    const tctx = tmp.getContext('2d');
    if (!tctx) return;
    tctx.drawImage(img, 0, 0);
    const imgData = tctx.getImageData(0, 0, tmp.width, tmp.height);

    // map polygon points from doc-space into layer-local space
    const t = layer.transform;
    const ax = layer.sourceWidth * t.anchor.x;
    const ay = layer.sourceHeight * t.anchor.y;
    const cos = Math.cos(-t.rotation);
    const sin = Math.sin(-t.rotation);
    const localPoints = lassoPoints.map((p) => {
      const dx = p.x - t.position.x;
      const dy = p.y - t.position.y;
      const rx = (cos * dx - sin * dy) / t.scale.x;
      const ry = (sin * dx + cos * dy) / t.scale.y;
      return { x: rx + ax, y: ry + ay };
    });

    const mask = rasterizePolygon(layer.sourceWidth, layer.sourceHeight, localPoints);
    applyMaskToImage(imgData, mask);
    tctx.putImageData(imgData, 0, 0);

    const newDataUrl = tmp.toDataURL('image/png');
    commit('Lasso cut', (d) => {
      d.bitmaps[layer.bitmapId] = newDataUrl;
      d.meta.modifiedAt = new Date().toISOString();
    });
    setLassoPoints([]);
    bitmapsRef.current.delete(layer.bitmapId);
  }

  function runMagicWand(p: Vec2): void {
    if (!selectedLayerId) return;
    const layer = doc.layers[selectedLayerId];
    if (!layer || layer.type !== 'image') return;
    const img = bitmapsRef.current.get(layer.bitmapId);
    if (!img) return;
    const tmp = document.createElement('canvas');
    tmp.width = layer.sourceWidth;
    tmp.height = layer.sourceHeight;
    const tctx = tmp.getContext('2d');
    if (!tctx) return;
    tctx.drawImage(img, 0, 0);
    const imgData = tctx.getImageData(0, 0, tmp.width, tmp.height);

    const t = layer.transform;
    const ax = layer.sourceWidth * t.anchor.x;
    const ay = layer.sourceHeight * t.anchor.y;
    const cos = Math.cos(-t.rotation);
    const sin = Math.sin(-t.rotation);
    const dx = p.x - t.position.x;
    const dy = p.y - t.position.y;
    const lx = Math.round((cos * dx - sin * dy) / t.scale.x + ax);
    const ly = Math.round((sin * dx + cos * dy) / t.scale.y + ay);

    const mask = magicWand({
      width: tmp.width,
      height: tmp.height,
      pixels: imgData.data,
      seed: { x: lx, y: ly },
      tolerance: 24,
      contiguous: true,
    });
    // invert: removing the wand selection (background-style erase)
    for (let i = 0; i < mask.data.length; i++) mask.data[i] = 255 - (mask.data[i] ?? 0);
    applyMaskToImage(imgData, mask);
    tctx.putImageData(imgData, 0, 0);
    const newDataUrl = tmp.toDataURL('image/png');
    commit('Magic wand cut', (d) => {
      d.bitmaps[layer.bitmapId] = newDataUrl;
      d.meta.modifiedAt = new Date().toISOString();
    });
    bitmapsRef.current.delete(layer.bitmapId);
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }

  return (
    <div ref={stageRef} className="flex-1 overflow-auto bg-[#0e0e12] p-8 flex items-center justify-center" onWheel={onWheel}>
      <div
        className="relative shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
        style={{
          width: doc.width * zoom,
          height: doc.height * zoom,
          transformOrigin: 'top left',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <canvas
          ref={overlayRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      </div>
      <canvas ref={exportCanvasRef} id="pef-export-canvas" style={{ display: 'none' }} />
    </div>
  );
}
