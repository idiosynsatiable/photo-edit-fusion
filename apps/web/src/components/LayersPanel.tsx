import React from 'react';
import { useEditorStore } from '../store/editor-store.js';

export function LayersPanel(): React.JSX.Element {
  const { doc, selectedLayerId, selectLayer, setVisible, setLocked, removeLayer, duplicate, reorder } = useEditorStore((s) => ({
    doc: s.doc,
    selectedLayerId: s.selectedLayerId,
    selectLayer: s.selectLayer,
    setVisible: s.setVisible,
    setLocked: s.setLocked,
    removeLayer: s.removeLayer,
    duplicate: s.duplicate,
    reorder: s.reorder,
  }));

  // top-down rendering = reverse of layerOrder so top layers appear first in the panel
  const orderedTopDown = [...doc.layerOrder].reverse();

  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-ink-700">
      <div className="px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 border-b border-ink-700">Layers</div>
      <div className="overflow-y-auto scrollbar-thin">
        {orderedTopDown.length === 0 && (
          <div className="px-3 py-6 text-sm text-zinc-500">Open an image, add text, or drop a shape to get started.</div>
        )}
        {orderedTopDown.map((id) => {
          const layer = doc.layers[id];
          if (!layer) return null;
          const selected = id === selectedLayerId;
          return (
            <div
              key={id}
              onClick={() => selectLayer(id)}
              className={`px-3 py-2 flex items-center gap-2 text-sm cursor-pointer ${
                selected ? 'bg-pink-500/20 border-l-2 border-pink-500' : 'hover:bg-ink-800'
              }`}
            >
              <button
                aria-label={layer.visible ? 'Hide' : 'Show'}
                title={layer.visible ? 'Hide' : 'Show'}
                onClick={(e) => {
                  e.stopPropagation();
                  setVisible(id, !layer.visible);
                }}
                className="w-5 text-zinc-300"
              >
                {layer.visible ? '◉' : '◌'}
              </button>
              <button
                aria-label={layer.locked ? 'Unlock' : 'Lock'}
                title={layer.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => {
                  e.stopPropagation();
                  setLocked(id, !layer.locked);
                }}
                className="w-5 text-zinc-400"
              >
                {layer.locked ? '🔒' : ' '}
              </button>
              <span className="flex-1 truncate">{layer.name}</span>
              <span className="text-[10px] text-zinc-500 uppercase">{layer.type}</span>
              <button
                aria-label="Duplicate"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicate(id);
                }}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ⎘
              </button>
              <button
                aria-label="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(id);
                }}
                className="text-zinc-400 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <div className="border-t border-ink-700 px-3 py-2 flex gap-2">
        <button
          className="text-xs text-zinc-300 hover:text-white"
          disabled={!selectedLayerId}
          onClick={() => {
            if (!selectedLayerId) return;
            const idx = doc.layerOrder.indexOf(selectedLayerId);
            reorder(selectedLayerId, idx + 1);
          }}
        >
          Bring forward
        </button>
        <button
          className="text-xs text-zinc-300 hover:text-white"
          disabled={!selectedLayerId}
          onClick={() => {
            if (!selectedLayerId) return;
            const idx = doc.layerOrder.indexOf(selectedLayerId);
            reorder(selectedLayerId, Math.max(0, idx - 1));
          }}
        >
          Send backward
        </button>
      </div>
    </div>
  );
}
