import React, { useEffect, useRef, useState } from 'react';
import { postFontIdentify } from '../lib/api.js';
import { useEditorStore } from '../store/editor-store.js';
import { loadGoogleFontByUrl } from '../lib/font-loader.js';
import type { FontMatch } from '@pef/shared';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface CropRect { x: number; y: number; w: number; h: number }

export function FontExtractModal({ open, onClose }: Props): React.JSX.Element | null {
  const { doc, addText, setFontMatches, lastFontMatches, lastFontMatchProvider } = useEditorStore((s) => ({
    doc: s.doc,
    addText: s.addText,
    setFontMatches: s.setFontMatches,
    lastFontMatches: s.lastFontMatches,
    lastFontMatchProvider: s.lastFontMatchProvider,
  }));

  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [drag, setDrag] = useState<CropRect | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const src = document.querySelector<HTMLCanvasElement>('#pef-export-canvas');
    const dst = sourceCanvasRef.current;
    if (!src || !dst) return;
    const maxW = 720;
    const ratio = Math.min(1, maxW / src.width);
    dst.width = src.width * ratio;
    dst.height = src.height * ratio;
    const ctx = dst.getContext('2d');
    if (ctx) {
      ctx.drawImage(src, 0, 0, dst.width, dst.height);
    }
    setCrop(null);
    setError(null);
  }, [open]);

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>): void {
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({ x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 });
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>): void {
    if (!drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({ ...drag, w: e.clientX - r.left - drag.x, h: e.clientY - r.top - drag.y });
  }
  function onMouseUp(): void {
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
    renderPreview(c);
  }

  function renderPreview(c: CropRect): void {
    const src = sourceCanvasRef.current;
    const dst = previewRef.current;
    if (!src || !dst) return;
    dst.width = c.w;
    dst.height = c.h;
    const ctx = dst.getContext('2d');
    if (ctx) ctx.drawImage(src, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
  }

  async function identify(): Promise<void> {
    const dst = previewRef.current;
    if (!dst) return;
    setWorking(true);
    setError(null);
    try {
      const dataUrl = dst.toDataURL('image/png');
      const result = await postFontIdentify(dataUrl);
      if ('error' in result) {
        setError(`${result.error}: ${'reason' in result ? result.reason : ''}`);
        return;
      }
      setFontMatches(result.provider, result.matches);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  }

  async function clone(match: FontMatch): Promise<void> {
    if (match.googleFontsUrl) {
      try {
        await loadGoogleFontByUrl(match.googleFontsUrl);
      } catch {
        // font load failure is non-fatal — text falls back to system fonts
      }
    }
    addText('Sample text', {
      fontFamily: match.family,
      fontWeight: match.weight ?? 400,
      fontStyle: match.style ?? 'normal',
      fontSizePx: 64,
      webFontUrl: match.googleFontsUrl ?? null,
    });
    onClose();
  }

  if (!open) return null;
  void doc;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-ink-900 border border-ink-700 rounded-lg w-[1024px] max-w-[95vw] max-h-[92vh] overflow-y-auto p-5 scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Extract Font from Crop</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </header>
        <p className="text-sm text-zinc-400 mb-3">
          Drag a rectangle around a region of text. The selection is sent to the font-id service. When no API keys are set we fall
          back to local Google Fonts similarity.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Source</div>
            <div className="relative inline-block">
              <canvas
                ref={sourceCanvasRef}
                className="border border-ink-700"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
              />
              {drag && (
                <div
                  className="absolute pointer-events-none border-2 border-pink-500 bg-pink-500/10"
                  style={{
                    left: drag.w < 0 ? drag.x + drag.w : drag.x,
                    top: drag.h < 0 ? drag.y + drag.h : drag.y,
                    width: Math.abs(drag.w),
                    height: Math.abs(drag.h),
                  }}
                />
              )}
              {crop && !drag && (
                <div
                  className="absolute pointer-events-none border-2 border-pink-500"
                  style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                />
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Crop preview</div>
            <canvas ref={previewRef} className="border border-ink-700 max-w-full" />
            <button onClick={identify} disabled={!crop || working} className="mt-3 btn-accent">
              {working ? 'Identifying…' : 'Identify font'}
            </button>
            {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
          </div>
        </div>
        <div className="mt-4 border-t border-ink-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold">Top matches</h3>
            {lastFontMatchProvider && (
              <span className="text-xs text-zinc-500">via {lastFontMatchProvider}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {lastFontMatches.map((m, i) => (
              <div key={i} className="border border-ink-700 rounded p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.family}</div>
                  <div className="text-xs text-zinc-500">
                    score {(m.score * 100).toFixed(0)}% · weight {m.weight ?? 'auto'} · {m.style ?? 'normal'}
                  </div>
                </div>
                <button onClick={() => clone(m)} className="btn-accent text-xs">
                  Clone as text
                </button>
              </div>
            ))}
            {lastFontMatches.length === 0 && (
              <div className="text-sm text-zinc-500 col-span-2">No matches yet — crop a text region and click Identify.</div>
            )}
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
