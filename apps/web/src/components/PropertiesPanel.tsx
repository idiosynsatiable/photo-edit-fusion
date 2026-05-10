import React from 'react';
import { BLEND_MODES, type BlendMode, type Layer } from '@pef/shared';
import { useEditorStore } from '../store/editor-store.js';

export function PropertiesPanel(): React.JSX.Element {
  const { doc, selectedLayerId, setBlend, setOpacity, patchLayer } = useEditorStore((s) => ({
    doc: s.doc,
    selectedLayerId: s.selectedLayerId,
    setBlend: s.setBlend,
    setOpacity: s.setOpacity,
    patchLayer: s.patchLayer,
  }));

  const layer: Layer | undefined = selectedLayerId ? doc.layers[selectedLayerId] : undefined;

  return (
    <div className="h-72 border-t border-ink-700 flex flex-col">
      <div className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 border-b border-ink-700">Properties</div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 text-sm space-y-3">
        {!layer && <div className="text-zinc-500">Select a layer to edit its properties.</div>}
        {layer && (
          <>
            <Field label="Name">
              <input
                value={layer.name}
                onChange={(e) => patchLayer(layer.id, { name: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Blend Mode">
              <select
                value={layer.blendMode}
                onChange={(e) => setBlend(layer.id, e.target.value as BlendMode)}
                className="input"
              >
                {BLEND_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Opacity ${(layer.opacity * 100).toFixed(0)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={layer.opacity}
                onChange={(e) => setOpacity(layer.id, Number(e.target.value))}
                className="w-full"
              />
            </Field>
            {layer.type === 'text' && (
              <>
                <Field label="Text">
                  <textarea
                    value={layer.text}
                    onChange={(e) => patchLayer(layer.id, { text: e.target.value })}
                    rows={3}
                    className="input"
                  />
                </Field>
                <Field label="Font family">
                  <input
                    value={layer.fontFamily}
                    onChange={(e) => patchLayer(layer.id, { fontFamily: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Size (px)">
                  <input
                    type="number"
                    min={4}
                    value={layer.fontSizePx}
                    onChange={(e) => patchLayer(layer.id, { fontSizePx: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
                <Field label="Weight">
                  <select
                    value={layer.fontWeight}
                    onChange={(e) => patchLayer(layer.id, { fontWeight: Number(e.target.value) })}
                    className="input"
                  >
                    {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Style">
                  <select
                    value={layer.fontStyle}
                    onChange={(e) => patchLayer(layer.id, { fontStyle: e.target.value as 'normal' | 'italic' })}
                    className="input"
                  >
                    <option value="normal">normal</option>
                    <option value="italic">italic</option>
                  </select>
                </Field>
                <Field label="Letter spacing (em)">
                  <input
                    type="number"
                    step={0.01}
                    value={layer.letterSpacingEm}
                    onChange={(e) => patchLayer(layer.id, { letterSpacingEm: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
              </>
            )}
            {layer.type === 'shape' && (
              <>
                <Field label="Width">
                  <input
                    type="number"
                    min={1}
                    value={layer.width}
                    onChange={(e) => patchLayer(layer.id, { width: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
                <Field label="Height">
                  <input
                    type="number"
                    min={1}
                    value={layer.height}
                    onChange={(e) => patchLayer(layer.id, { height: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
                <Field label="Corner radius">
                  <input
                    type="number"
                    min={0}
                    value={layer.cornerRadius}
                    onChange={(e) => patchLayer(layer.id, { cornerRadius: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
              </>
            )}
            <Field label={`X · ${layer.transform.position.x.toFixed(0)}`}>
              <input
                type="range"
                min={-doc.width}
                max={doc.width * 2}
                value={layer.transform.position.x}
                onChange={(e) =>
                  patchLayer(layer.id, {
                    transform: {
                      ...layer.transform,
                      position: { ...layer.transform.position, x: Number(e.target.value) },
                    },
                  })
                }
                className="w-full"
              />
            </Field>
            <Field label={`Y · ${layer.transform.position.y.toFixed(0)}`}>
              <input
                type="range"
                min={-doc.height}
                max={doc.height * 2}
                value={layer.transform.position.y}
                onChange={(e) =>
                  patchLayer(layer.id, {
                    transform: {
                      ...layer.transform,
                      position: { ...layer.transform.position, y: Number(e.target.value) },
                    },
                  })
                }
                className="w-full"
              />
            </Field>
            <Field label={`Rotation · ${((layer.transform.rotation * 180) / Math.PI).toFixed(1)}°`}>
              <input
                type="range"
                min={-Math.PI}
                max={Math.PI}
                step={0.001}
                value={layer.transform.rotation}
                onChange={(e) =>
                  patchLayer(layer.id, { transform: { ...layer.transform, rotation: Number(e.target.value) } })
                }
                className="w-full"
              />
            </Field>
          </>
        )}
      </div>
      <style>{`
        .input { background: #1a1a1f; border: 1px solid #26262d; border-radius: 4px; padding: 4px 6px; color: #e5e5e7; width: 100%; font-size: 13px; }
        .input:focus { outline: none; border-color: #ec4899; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
      {children}
    </label>
  );
}
