import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { getIntegrations, type IntegrationStatus } from '../lib/api.js';

export function StatusBar(): React.JSX.Element {
  const { doc, zoom } = useEditorStore((s) => ({ doc: s.doc, zoom: s.zoom }));
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);

  useEffect(() => {
    let active = true;
    getIntegrations()
      .then((r) => {
        if (active) setIntegrations(r);
      })
      .catch(() => {
        // server may be unreachable in some environments — treat as unknown
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="h-7 border-t border-ink-700 bg-ink-900 px-3 flex items-center text-xs text-zinc-400 gap-4 select-none">
      <span>{doc.name}</span>
      <span>
        {doc.width} × {doc.height}
      </span>
      <span>{(zoom * 100).toFixed(0)}%</span>
      <div className="flex-1" />
      {integrations.map((i) => (
        <span key={i.name} className="flex items-center gap-1">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              i.enabled ? 'bg-emerald-400' : 'bg-zinc-600'
            }`}
            title={i.reason ?? 'enabled'}
          />
          {i.name}
        </span>
      ))}
    </div>
  );
}
