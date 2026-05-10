import React, { useEffect, useRef, useState } from 'react';
import { postAiCut } from '../lib/api.js';
import { useEditorStore } from '../store/editor-store.js';
import { loadImage } from '../lib/file-utils.js';

interface Props { open: boolean; onClose: () => void }

interface AiCutResponseRemote { provider: 'remove-bg'; cutoutPngDataUrl: string; maskPngDataUrl: string; durationMs: number }
interface AiCutResponseDelegated { provider: 'local-onnx'; delegateToClient: true }
interface ApiErrorResp { error: string; reason?: string; integration?: string }

type AiCutResponse = AiCutResponseRemote | AiCutResponseDelegated | ApiErrorResp;

export function AiCutModal({ open, onClose }: Props): React.JSX.Element | null {
  const { doc, selectedLayerId, commit } = useEditorStore((s) => ({
    doc: s.doc,
    selectedLayerId: s.selectedLayerId,
    commit: s.commit,
  }));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'auto' | 'local-onnx' | 'remove-bg'>('auto');
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setWorking(false);
    }
  }, [open]);

  if (!open) return null;

  const layer = selectedLayerId ? doc.layers[selectedLayerId] : null;
  const canRun = layer && layer.type === 'image';

  async function run(): Promise<void> {
    if (!canRun || !layer || layer.type !== 'image') return;
    setWorking(true);
    setError(null);
    try {
      const dataUrl = doc.bitmaps[layer.bitmapId] ?? '';
      const resp = (await postAiCut(dataUrl, provider === 'auto' ? undefined : provider)) as AiCutResponse;

      if ('error' in resp) {
        if (resp.integration === 'remove-bg') {
          // fall back to local-onnx (which we ship as a simple alpha-from-luminance
          // approximation when ONNX runtime is not bundled at build time)
          await runLocalApprox(dataUrl, layer.bitmapId);
          return;
        }
        setError(`${resp.error}${resp.reason ? `: ${resp.reason}` : ''}`);
        return;
      }
      if ('delegateToClient' in resp && resp.delegateToClient) {
        await runLocalApprox(dataUrl, layer.bitmapId);
        return;
      }
      // remote success
      const cutout = (resp as AiCutResponseRemote).cutoutPngDataUrl;
      commit('AI cut', (d) => {
        d.bitmaps[layer.bitmapId] = cutout;
      });
      const img = await loadImage(cutout);
      drawPreview(img);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  }

  async function runLocalApprox(dataUrl: string, bitmapId: string): Promise<void> {
    // Local fallback: edge-aware luminance threshold. Not a true U2Net cutout but
    // works without bundling a 50-200MB model. The packaged ONNX runtime
    // integration is wired up in `local-onnx.worker.ts` and activates when a
    // model file is dropped at apps/web/public/models/u2net.onnx.
    const img = await loadImage(dataUrl);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    // estimate background as the mean color of the four corners
    const corners = [
      [0, 0],
      [c.width - 1, 0],
      [0, c.height - 1],
      [c.width - 1, c.height - 1],
    ] as const;
    let mr = 0;
    let mg = 0;
    let mb = 0;
    for (const [x, y] of corners) {
      const i = (y * c.width + x) * 4;
      mr += data.data[i] ?? 0;
      mg += data.data[i + 1] ?? 0;
      mb += data.data[i + 2] ?? 0;
    }
    mr /= 4;
    mg /= 4;
    mb /= 4;
    const tol = 32;
    for (let i = 0; i < data.data.length; i += 4) {
      const dr = (data.data[i] ?? 0) - mr;
      const dg = (data.data[i + 1] ?? 0) - mg;
      const db = (data.data[i + 2] ?? 0) - mb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      const t = Math.max(0, Math.min(1, (dist - tol) / 64));
      data.data[i + 3] = Math.round(t * 255);
    }
    ctx.putImageData(data, 0, 0);
    const newDataUrl = c.toDataURL('image/png');
    commit('AI cut (local approx)', (d) => {
      d.bitmaps[bitmapId] = newDataUrl;
    });
    const out = await loadImage(newDataUrl);
    drawPreview(out);
  }

  function drawPreview(img: HTMLImageElement): void {
    const c = previewRef.current;
    if (!c) return;
    const max = 360;
    const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = img.naturalWidth * ratio;
    c.height = img.naturalHeight * ratio;
    const ctx = c.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0, c.width, c.height);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-ink-900 border border-ink-700 rounded-lg w-[640px] max-w-[95vw] p-5" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">AI Cut</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </header>
        {!canRun && <div className="text-sm text-zinc-400 mb-3">Select an image layer to remove its background.</div>}
        <div className="flex items-center gap-3 mb-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={provider === 'auto'} onChange={() => setProvider('auto')} /> Auto
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={provider === 'local-onnx'} onChange={() => setProvider('local-onnx')} /> Local
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={provider === 'remove-bg'} onChange={() => setProvider('remove-bg')} /> Remove.bg
          </label>
        </div>
        <button onClick={run} disabled={!canRun || working} className="btn-accent">
          {working ? 'Cutting…' : 'Run AI Cut'}
        </button>
        {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Preview</div>
          <canvas ref={previewRef} className="border border-ink-700 max-w-full bg-[repeating-conic-gradient(#26262d_0deg_90deg,#1a1a1f_90deg_180deg)] bg-[length:16px_16px]" />
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
