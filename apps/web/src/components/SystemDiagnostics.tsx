import React, { useCallback, useEffect, useState } from 'react';

type Status = 'pass' | 'warn' | 'fail';
interface Check { name: string; status: Status; detail: string; action?: string }

export function SystemDiagnostics({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element | null {
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const onError = (event: ErrorEvent) => setRuntimeErrors((items) => [...items.slice(-9), event.message || 'Unhandled application error']);
    const onRejection = (event: PromiseRejectionEvent) => setRuntimeErrors((items) => [...items.slice(-9), String(event.reason ?? 'Unhandled promise rejection')]);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [open]);

  const runChecks = useCallback(async (): Promise<void> => {
    setRunning(true);
    const results: Check[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d');
    results.push(context ? { name: 'Canvas renderer', status: 'pass', detail: '2D canvas context is available.' } : { name: 'Canvas renderer', status: 'fail', detail: '2D canvas is unavailable.', action: 'Update Android System WebView or use a supported browser.' });
    try {
      if (!('indexedDB' in window)) throw new Error('IndexedDB is unavailable.');
      const request = indexedDB.open('photo-edit-fusion-local', 1);
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
        request.onblocked = () => reject(new Error('IndexedDB open was blocked by another tab.'));
      });
      results.push({ name: 'Local project storage', status: 'pass', detail: 'IndexedDB can be opened.' });
    } catch (error) {
      results.push({ name: 'Local project storage', status: 'fail', detail: error instanceof Error ? error.message : String(error), action: 'Close duplicate app tabs, check device storage, and retry.' });
    }

    for (const [name, path] of [
      ['OCR worker', '/tesseract/worker.min.js'],
      ['OCR WebAssembly core', '/tesseract/core/tesseract-core.wasm.js'],
      ['English OCR model', '/tesseract/lang/eng.traineddata.gz'],
    ] as const) {
      try {
        const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        results.push({ name, status: 'pass', detail: 'Bundled local asset is reachable.' });
      } catch (error) {
        results.push({ name, status: 'fail', detail: error instanceof Error ? error.message : String(error), action: 'Reinstall a complete APK built with the local OCR asset-bundling step.' });
      }
    }

    results.push({
      name: 'Network state',
      status: navigator.onLine ? 'pass' : 'pass',
      detail: navigator.onLine ? 'Network available. Core editing should not require it.' : 'Airplane/offline state detected. This is expected for offline testing.',
    });
    results.push({
      name: 'PWA offline cache',
      status: 'warn',
      detail: 'The service worker caches the app shell after a successful first load. Confirm offline reload after its controller becomes active.',
      action: 'For the installed Android APK, bundled assets are local. For PWA, open once online, wait for caching, then test offline.',
    });
    results.push({
      name: 'Cloud AI',
      status: 'warn',
      detail: 'Gemini/TITAN and remote font downloads are optional online capabilities, not part of the offline core.',
      action: 'Use local editing, local OCR, and local font ranking while offline.',
    });
    setChecks(results);
    setRunning(false);
  }, []);

  useEffect(() => {
    if (open && checks.length === 0) void runChecks();
  }, [open, checks.length, runChecks]);

  if (!open) return null;
  const failures = checks.filter((item) => item.status === 'fail').length;
  const warnings = checks.filter((item) => item.status === 'warn').length;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="System diagnostics">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 p-5 text-zinc-100">
        <header className="mb-4 flex items-center justify-between">
          <div><h2 className="text-lg font-semibold">Ω System Check</h2><p className="text-xs text-zinc-400">Offline readiness and local capability diagnostics</p></div>
          <button onClick={onClose} className="rounded px-3 py-1 text-zinc-300 hover:bg-ink-700">Close</button>
        </header>
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-emerald-950 px-2 py-1 text-emerald-300">{checks.length - failures - warnings} passed</span>
          <span className="rounded bg-red-950 px-2 py-1 text-red-300">{failures} failed</span>
          <span className="rounded bg-amber-950 px-2 py-1 text-amber-300">{warnings} advisory</span>
        </div>
        <div className="space-y-2">
          {checks.map((check) => (
            <article key={check.name} className="rounded border border-ink-700 bg-ink-950 p-3">
              <div className="flex items-center justify-between gap-3"><strong className="text-sm">{check.name}</strong><span className={check.status === 'pass' ? 'text-emerald-300' : check.status === 'fail' ? 'text-red-300' : 'text-amber-300'}>{check.status.toUpperCase()}</span></div>
              <p className="mt-1 text-xs text-zinc-300">{check.detail}</p>
              {check.action && <p className="mt-1 text-xs text-cyan-200">Next action: {check.action}</p>}
            </article>
          ))}
        </div>
        {runtimeErrors.length > 0 && <div className="mt-4 rounded border border-red-900 bg-red-950/40 p-3"><h3 className="text-sm font-semibold text-red-200">Recent runtime errors</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-100">{runtimeErrors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
        <footer className="mt-4 flex justify-end"><button disabled={running} onClick={() => void runChecks()} className="rounded bg-cyan-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{running ? 'Checking…' : 'Run checks again'}</button></footer>
      </section>
    </div>
  );
}
