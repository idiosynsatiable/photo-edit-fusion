import React, { useEffect, useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import { postFontIdentify } from '../lib/api.js';
import { useEditorStore } from '../store/editor-store.js';
import { loadGoogleFontByUrl } from '../lib/font-loader.js';
import type { FontMatch } from '@pef/shared';

interface Props { open: boolean; onClose: () => void }
interface CropRect { x: number; y: number; w: number; h: number }

export function FontExtractModal({ open, onClose }: Props): React.JSX.Element | null {
  const addText = useEditorStore((s) => s.addText);
  const lastFontMatches = useEditorStore((s) => s.lastFontMatches);
  const lastFontMatchProvider = useEditorStore((s) => s.lastFontMatchProvider);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [drag, setDrag] = useState<CropRect | null>(null);
  const [working, setWorking] = useState(false);
  const [ocrWorking, setOcrWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');

  useEffect(() => {
    if (!open) return;
    const src = document.querySelector<HTMLCanvasElement>('#pef-export-canvas');
    const dst = sourceCanvasRef.current;
    if (!src || !dst) return;
    const maxW = 720;
    const ratio = Math.min(1, maxW / src.width);
    dst.width = Math.max(1, Math.round(src.width * ratio));
    dst.height = Math.max(1, Math.round(src.height * ratio));
    const ctx = dst.getContext('2d');
    if (ctx) ctx.drawImage(src, 0, 0, dst.width, dst.height);
    setCrop(null);
    setExtractedText('');
    setError(null);
  }, [open]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const sx = e.currentTarget.width / r.width;
    const sy = e.currentTarget.height / r.height;
    setDrag({ x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    const sx = e.currentTarget.width / r.width;
    const sy = e.currentTarget.height / r.height;
    setDrag({ ...drag, w: (e.clientX - r.left) * sx - drag.x, h: (e.clientY - r.top) * sy - drag.y });
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drag) return;
    const c: CropRect = {
      x: drag.w < 0 ? drag.x + drag.w : drag.x,
      y: drag.h < 0 ? drag.y + drag.h : drag.y,
      w: Math.abs(drag.w),
      h: Math.abs(drag.h),
    };
    setDrag(null);
    if (c.w < 8 || c.h < 8) return;
    setCrop(c);
    setExtractedText('');
    renderPreview(c);
  }

  function renderPreview(c: CropRect): void {
    const src = sourceCanvasRef.current;
    const dst = previewRef.current;
    if (!src || !dst) return;
    dst.width = Math.max(1, Math.round(c.w));
    dst.height = Math.max(1, Math.round(c.h));
    const ctx = dst.getContext('2d');
    if (ctx) ctx.drawImage(src, c.x, c.y, c.w, c.h, 0, 0, dst.width, dst.height);
  }

  async function extractText(): Promise<void> {
    const canvas = previewRef.current;
    if (!canvas) return;
    setOcrWorking(true);
    setError(null);
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      worker = await createWorker('eng');
      const result = await worker.recognize(canvas);
      setExtractedText(result.data.text.trim());
      if (!result.data.text.trim()) setError('No readable text found. Try a tighter crop with larger, sharper lettering.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Text extraction failed.');
    } finally {
      if (worker) await worker.terminate();
      setOcrWorking(false);
    }
  }

  async function identify(): Promise<void> {
    const dst = previewRef.current;
    if (!dst) return;
    setWorking(true);
    setError(null);
    try {
      const result = await postFontIdentify(dst.toDataURL('image/png'));
      if ('error' in result) {
        setError(`${result.error}: ${'reason' in result ? result.reason : ''}`);
        return;
      }
      useEditorStore.getState().setFontMatches(result.provider, result.matches);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }

  async function clone(match: FontMatch): Promise<void> {
    if (match.googleFontsUrl) {
      try { await loadGoogleFontByUrl(match.googleFontsUrl); } catch { /* optional font download */ }
    }
    addText(extractedText.trim() || 'Sample text', {
      fontFamily: match.family,
      fontWeight: match.weight ?? 400,
      fontStyle: match.style ?? 'normal',
      fontSizePx: Math.max(18, Math.min(96, Math.round((crop?.h ?? 64) * 0.85))),
      webFontUrl: match.googleFontsUrl ?? null,
    });
    onClose();
  }

  function addExtractedText(): void {
    if (!extractedText.trim()) return;
    addText(extractedText.trim(), {
      fontFamily: 'Arial',
      fontWeight: 400,
      fontStyle: 'normal',
      fontSizePx: Math.max(18, Math.min(96, Math.round((crop?.h ?? 64) * 0.85))),
      webFontUrl: null,
    });
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div className="bg-ink-900 border border-ink-700 rounded-lg w-[1024px] max-w-[95vw] max-h-[92vh] overflow-y-auto p-5 scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Ω Text & Font Extraction</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </header>
        <p className="text-sm text-zinc-400 mb-3">Select a text region. Extract its wording on-device, identify likely fonts, then add editable text layers. Font matching uses the configured font service or local fallback.</p>
        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Source image · drag around text</div>
            <div className="relative inline-block max-w-full overflow-auto">
              <canvas ref={sourceCanvasRef} className="max-w-full border border-ink-700" style={{ touchAction: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
              {drag && <div className="absolute pointer-events-none border-2 border-pink-500 bg-pink-500/10" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} />}
              {crop && !drag && <div className="absolute pointer-events-none border-2 border-pink-500" style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }} />}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Selected region</div>
            <canvas ref={previewRef} className="max-w-full border border-ink-700" />
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => void extractText()} disabled={!crop || ocrWorking} className="btn-accent">{ocrWorking ? 'Reading text…' : 'Extract text on device'}</button>
              <button onClick={() => void identify()} disabled={!crop || working} className="btn-accent">{working ? 'Identifying…' : 'Identify font'}</button>
            </div>
            <label className="block text-xs text-zinc-400 mt-3 mb-1" htmlFor="pef-extracted-text">Recognized text · editable</label>
            <textarea id="pef-extracted-text" value={extractedText} onChange={(e) => setExtractedText(e.target.value)} rows={4} className="w-full rounded border border-ink-700 bg-ink-950 p-2 text-sm text-white" placeholder="Extracted wording appears here. You can correct it before adding a text layer." />
            <button onClick={addExtractedText} disabled={!extractedText.trim()} className="mt-2 rounded bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Add as editable text layer</button>
          </div>
        </div>
        {error && <div role="alert" className="text-red-400 text-xs mt-3">{error}</div>}
        <div className="mt-4 border-t border-ink-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold">Font matches</h3>
            {lastFontMatchProvider && <span className="text-xs text-zinc-500">via {lastFontMatchProvider}</span>}
          </div>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2">
            {lastFontMatches.map((m, i) => (
              <div key={i} className="border border-ink-700 rounded p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0"><div className="font-medium truncate">{m.family}</div><div className="text-xs text-zinc-500">score {(m.score * 100).toFixed(0)}% · weight {m.weight ?? 'auto'} · {m.style ?? 'normal'}</div></div>
                <button onClick={() => void clone(m)} className="btn-accent text-xs">Create matching text</button>
              </div>
            ))}
            {lastFontMatches.length === 0 && <div className="text-sm text-zinc-500 col-span-2">No matches yet. Crop a text region and identify its font.</div>}
          </div>
        </div>
        <style>{`
          .btn-accent { padding: 6px 14px; border-radius: 6px; background: #ec4899; color: white; font-weight: 500; font-size: 13px; }
          .btn-accent:hover { background: #db2777; }
          .btn-accent:disabled { opacity: 0.4; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}
