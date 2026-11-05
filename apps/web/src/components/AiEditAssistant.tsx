import React, { useState } from 'react';
import type { EditPlan, SceneAnalysis } from '@pef/shared';
import { postAiAnalyze, postAiPlan, postAiExecute } from '../lib/api.js';
import { useEditorStore } from '../store/editor-store.js';
import { createDocument } from '@pef/canvas-engine';

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unsupported image data'));
    reader.readAsDataURL(file);
  });
}

function createRegionMaskDataUrl(width: number, height: number, plan: EditPlan, analysis: SceneAnalysis): string | null {
  const targetIds = new Set(plan.operations.flatMap((operation) => operation.targetRegionIds));
  const targets = analysis.regions.filter((region) => targetIds.has(region.id));
  if (!targets.length) return null;

  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const context = mask.getContext('2d');
  if (!context) return null;

  const padX = Math.max(8, Math.round(width * 0.018));
  const padY = Math.max(8, Math.round(height * 0.018));
  context.fillStyle = '#fff';
  for (const region of targets) {
    const x = Math.max(0, Math.floor(region.bounds.x * width) - padX);
    const y = Math.max(0, Math.floor(region.bounds.y * height) - padY);
    const right = Math.min(width, Math.ceil((region.bounds.x + region.bounds.width) * width) + padX);
    const bottom = Math.min(height, Math.ceil((region.bounds.y + region.bounds.height) * height) + padY);
    context.fillRect(x, y, Math.max(0, right - x), Math.max(0, bottom - y));
  }

  const protectedIds = new Set([
    ...analysis.regions.filter((region) => region.protected).map((region) => region.id),
    ...plan.identityProtection.protectedRegionIds,
  ]);
  context.globalCompositeOperation = 'destination-out';
  for (const region of analysis.regions.filter((item) => protectedIds.has(item.id))) {
    const x = Math.max(0, Math.floor(region.bounds.x * width) - padX);
    const y = Math.max(0, Math.floor(region.bounds.y * height) - padY);
    const right = Math.min(width, Math.ceil((region.bounds.x + region.bounds.width) * width) + padX);
    const bottom = Math.min(height, Math.ceil((region.bounds.y + region.bounds.height) * height) + padY);
    context.fillRect(x, y, Math.max(0, right - x), Math.max(0, bottom - y));
  }
  context.globalCompositeOperation = 'source-over';

  const feathered = document.createElement('canvas');
  feathered.width = width;
  feathered.height = height;
  const featherContext = feathered.getContext('2d');
  if (!featherContext) return mask.toDataURL('image/png');
  featherContext.filter = `blur(${Math.max(2, Math.round(Math.min(width, height) * 0.006))}px)`;
  featherContext.drawImage(mask, 0, 0);
  featherContext.filter = 'none';
  return feathered.toDataURL('image/png');
}

export function AiEditAssistant(): React.JSX.Element {
  const [image, setImage] = useState<File | null>(null);
  const [generatedLayerIds, setGeneratedLayerIds] = useState<string[]>([]);
  const [originalLayerId, setOriginalLayerId] = useState<string | null>(null);
  const [activeMimeType, setActiveMimeType] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [showEdited, setShowEdited] = useState(true);
  const addImage = useEditorStore((state) => state.addImage);
  const applyDoc = useEditorStore((state) => state.applyDoc);
  const setVisible = useEditorStore((state) => state.setVisible);
  const commit = useEditorStore((state) => state.commit);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null);
  const [instruction, setInstruction] = useState('');
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [providerConsent, setProviderConsent] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  async function scan() {
    if (!image) return;
    setBusy(true); setError(''); setPlan(null); setStage('Scanning the full image…');
    try {
      const url = await fileAsDataUrl(image);
      setDataUrl(url);
      if (!originalLayerId) {
        const sourceImage = new Image();
        await new Promise<void>((resolve, reject) => {
          sourceImage.onload = () => resolve();
          sourceImage.onerror = () => reject(new Error('Source image could not be decoded'));
          sourceImage.src = url;
        });
        const currentDocument = useEditorStore.getState().doc;
        if (currentDocument.layerOrder.length === 0 && currentDocument.name === 'Untitled') {
          const nextDocument = createDocument({
            name: image.name.replace(/\.[^.]+$/, '') || 'Untitled',
            width: sourceImage.naturalWidth,
            height: sourceImage.naturalHeight,
          });
          nextDocument.background = [0, 0, 0, 0];
          applyDoc(nextDocument);
        }
        const sourceBitmapId = 'source_' + crypto.randomUUID();
        addImage({ bitmapId: sourceBitmapId, bitmapDataUrl: url, sourceWidth: sourceImage.naturalWidth, sourceHeight: sourceImage.naturalHeight, name: image.name });
        const latest = useEditorStore.getState().doc;
        const sourceId = [...latest.layerOrder].reverse().find((id) => latest.layers[id]?.type === 'image' && latest.layers[id]?.name === image.name);
        if (sourceId) setOriginalLayerId(sourceId);
      }
      const result = await postAiAnalyze(url, image.type as 'image/png' | 'image/jpeg' | 'image/webp');
      if ('error' in result) throw new Error(result.error);
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
      if ('error' in result) throw new Error(result.error);
      setPlan(result.plan);
      setStage('Plan ready. Review it before any edits are executed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan generation failed');
      setStage('');
    } finally { setBusy(false); }
  }


  async function executePlan() {
    if (!image || !dataUrl || !analysis || !plan) return;
    setBusy(true); setError(''); setStage('Applying approved generative edits…');
    try {
      const result = await postAiExecute(
        dataUrl,
        activeMimeType,
        instruction,
        plan,
        analysis,
      );
      if ('error' in result) throw new Error(result.error);
      setStage('Decoding the generated image…');
      const outputUrl = 'data:' + result.mimeType + ';base64,' + result.imageBase64;
      const outputImage = new Image();
      await new Promise<void>((resolve, reject) => {
        outputImage.onload = () => resolve();
        outputImage.onerror = () => reject(new Error('Generated image could not be decoded'));
        outputImage.src = outputUrl;
      });
      setStage('Preparing a reversible region mask…');
      const maskDataUrl = createRegionMaskDataUrl(outputImage.naturalWidth, outputImage.naturalHeight, plan, analysis);
      setStage('Adding the result as a separate editable layer…');
      for (const previousId of generatedLayerIds) setVisible(previousId, false);
      const bitmapId = 'ai_' + crypto.randomUUID();
      addImage({
        bitmapId,
        bitmapDataUrl: outputUrl,
        sourceWidth: outputImage.naturalWidth,
        sourceHeight: outputImage.naturalHeight,
        name: 'AI Edited Result',
      });
      const latest = useEditorStore.getState().doc;
      const layerId = [...latest.layerOrder].reverse().find((id) => latest.layers[id]?.type === 'image' && latest.layers[id]?.name === 'AI Edited Result');
      if (layerId && maskDataUrl) {
        const maskBitmapId = 'mask_' + crypto.randomUUID();
        commit('Attach AI edit mask', (document) => {
          document.bitmaps[maskBitmapId] = maskDataUrl;
          const layer = document.layers[layerId];
          if (layer?.type === 'image') layer.maskBitmapId = maskBitmapId;
        });
      }
      if (layerId) setGeneratedLayerIds((current) => [...current, layerId]);
      setDataUrl(outputUrl);
      setActiveMimeType(result.mimeType as 'image/png' | 'image/jpeg' | 'image/webp');
      if (originalLayerId) setVisible(originalLayerId, true);
      setShowEdited(true);
      setStage('Edit complete. The latest result is now the active source for follow-up instructions. Earlier results remain in the layer history.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image edit failed');
      setStage('');
    } finally { setBusy(false); }
  }

  function compare(showEditedResult: boolean) {
    if (!generatedLayerIds.length) return;
    if (originalLayerId) setVisible(originalLayerId, true);
    const latestId = generatedLayerIds[generatedLayerIds.length - 1];
    for (const id of generatedLayerIds) setVisible(id, showEditedResult && id === latestId);
    setShowEdited(showEditedResult);
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
            setImage(next); setAnalysis(null); setPlan(null); setDataUrl(null); setGeneratedLayerIds([]); setOriginalLayerId(null); setActiveMimeType((next?.type || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp'); setProviderConsent(false); setError(''); setStage('');
          }}
        />
      </label>

      {dataUrl && <img src={dataUrl} alt="Selected image preview" className="max-h-36 max-w-full rounded border border-ink-700 object-contain" />}

      <label className="flex items-start gap-2 text-[11px] text-zinc-400"><input type="checkbox" checked={providerConsent} onChange={(event) => setProviderConsent(event.target.checked)} className="mt-0.5" /><span>I consent to sending this image and my editing instructions to Google Gemini for AI processing. I understand processing is performed by the provider under its terms.</span></label>
      <button className="rounded bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40" disabled={!image || !providerConsent || busy} onClick={() => void scan()}>
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

      {generatedLayerIds.length > 0 && <div className="flex gap-2"><button className="rounded border border-ink-600 px-2 py-1 text-xs" onClick={() => compare(false)} disabled={!showEdited}>Show original</button><button className="rounded border border-ink-600 px-2 py-1 text-xs" onClick={() => compare(true)} disabled={showEdited}>Show latest edit</button></div>}
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
          <button className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={busy || !dataUrl || !image || !providerConsent} onClick={() => void executePlan()}>Approve & apply edits</button>
          <p className="text-[10px] text-zinc-400">Applying creates a separate result layer. The original image is retained for comparison and undo.</p>
        </div>
      )}
    </section>
  );
}
