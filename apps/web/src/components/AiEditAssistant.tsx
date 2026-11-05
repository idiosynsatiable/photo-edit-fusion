import React, { useState } from 'react';
import type { EditPlan, SceneAnalysis } from '@pef/shared';
import { postAiAnalyze, postAiPlan } from '../lib/api.js';

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unsupported image data'));
    reader.readAsDataURL(file);
  });
}

export function AiEditAssistant(): React.JSX.Element {
  const [image, setImage] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null);
  const [instruction, setInstruction] = useState('');
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  async function scan() {
    if (!image) return;
    setBusy(true); setError(''); setPlan(null); setStage('Scanning the full image…');
    try {
      const url = await fileAsDataUrl(image);
      setDataUrl(url);
      const result = await postAiAnalyze(url, image.type as 'image/png' | 'image/jpeg' | 'image/webp');
      if ('error' in result) throw new Error(result.message ?? result.error);
      setAnalysis(result.analysis);
      setStage(`Scan complete: ${result.analysis.regions.length} regions identified`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image analysis failed');
      setStage('');
    } finally { setBusy(false); }
  }

  async function createPlan() {
    if (!analysis || !instruction.trim()) return;
    setBusy(true); setError(''); setStage('Building a reviewable edit plan…');
    try {
      const result = await postAiPlan(instruction, analysis, true, plan?.operations ?? []);
      if ('error' in result) throw new Error(result.message ?? result.error);
      setPlan(result.plan);
      setStage('Plan ready. Review it before any edits are executed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan generation failed');
      setStage('');
    } finally { setBusy(false); }
  }

  return (
    <section className="border-t border-ink-700 bg-ink-900 p-4 space-y-3" aria-label="AI editing assistant">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Photo Edit Fusion Ω · AI Studio</h2>
          <p className="text-xs text-zinc-400">Scan → describe → review plan</p>
        </div>
        <span className="rounded-full border border-ink-600 px-2 py-1 text-[10px] text-zinc-400">Gemini</span>
      </div>

      <label className="block text-xs text-zinc-300">
        Image to analyze
        <input
          className="mt-1 block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-ink-700 file:px-3 file:py-2 file:text-zinc-200"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setImage(next); setAnalysis(null); setPlan(null); setDataUrl(null); setError(''); setStage('');
          }}
        />
      </label>

      {dataUrl && <img src={dataUrl} alt="Selected image preview" className="max-h-36 max-w-full rounded border border-ink-700 object-contain" />}

      <button className="rounded bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40" disabled={!image || busy} onClick={() => void scan()}>
        {busy && !analysis ? 'Scanning…' : 'Scan entire image'}
      </button>

      {analysis && (
        <div className="rounded border border-ink-700 p-3 space-y-2">
          <p className="text-xs text-zinc-200">{analysis.summary}</p>
          <p className="text-[11px] text-zinc-400">{analysis.regions.length} regions · {analysis.imageWidth}×{analysis.imageHeight}</p>
          <div className="flex flex-wrap gap-1">
            {analysis.regions.slice(0, 18).map((region) => (
              <span key={region.id} className="rounded bg-ink-800 px-2 py-1 text-[10px] text-zinc-300">
                {region.kind}: {region.label} ({Math.round(region.confidence * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      <label className="block text-xs text-zinc-300">
        Describe the edit
        <textarea
          className="mt-1 min-h-20 w-full resize-y rounded border border-ink-700 bg-ink-950 p-2 text-xs text-zinc-100 placeholder:text-zinc-600"
          placeholder="Remove the sign behind me, keep my face unchanged, and rebuild the background naturally…"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
        />
      </label>
      <button className="rounded bg-cyan-800 px-3 py-2 text-xs font-medium text-white disabled:opacity-40" disabled={!analysis || !instruction.trim() || busy} onClick={() => void createPlan()}>
        {busy && analysis ? 'Planning…' : 'Generate edit plan'}
      </button>

      {stage && <p role="status" className="text-xs text-emerald-300">{stage}</p>}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}

      {plan && (
        <div className="rounded border border-cyan-900 bg-ink-950 p-3 space-y-2">
          <h3 className="text-xs font-semibold text-cyan-200">Review before execution</h3>
          <p className="text-[11px] text-zinc-400">{plan.rationale}</p>
          <ol className="list-decimal space-y-2 pl-4">
            {plan.operations.map((operation) => (
              <li key={operation.id} className="text-xs text-zinc-200">
                <span className="font-medium">{operation.title}</span>
                <p className="text-[11px] text-zinc-400">{operation.description}</p>
                {operation.requiresConfirmation && <span className="text-[10px] text-amber-300">Needs confirmation</span>}
              </li>
            ))}
          </ol>
          <p className="text-[10px] text-amber-300">Planning is connected. Applying generative operations to editable layers is a separate implementation gate and is not yet enabled.</p>
        </div>
      )}
    </section>
  );
}
