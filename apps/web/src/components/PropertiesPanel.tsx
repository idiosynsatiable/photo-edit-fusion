import React, { useEffect, useState } from 'react';
import { BLEND_MODES, type BlendMode, type ImageAdjustments, type Layer } from '@pef/shared';
import { layerLocalSize } from '@pef/canvas-engine';
import { useEditorStore } from '../store/editor-store.js';
import { Icon } from './Icon.js';
export const NEUTRAL: ImageAdjustments = { brightness: 0, contrast: 0, saturation: 0, grayscale: 0, sepia: 0, blur: 0 };
const toHex = (c: number[]) => '#' + c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const rgba = (hex: string): [number, number, number, number] => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, 1];

export function PropertiesPanel({ onCut }: { onCut: () => void }): React.JSX.Element {
  const s = useEditorStore(), { doc, activeTool } = s;
  const layer = s.selectedLayerId ? doc.layers[s.selectedLayerId] : undefined;
  const [w, setW] = useState(doc.width), [h, setH] = useState(doc.height), [scaleContent, setScaleContent] = useState(false), [lockRatio, setLockRatio] = useState(true);
  useEffect(() => { setW(doc.width); setH(doc.height); }, [doc.width, doc.height]);
  function patch(p: Partial<Layer>): void { if (layer && !layer.locked) s.patchLayer(layer.id, p); }
  function resizeLayer(value: number, axis: 'x' | 'y'): void {
    if (!layer || !Number.isFinite(value) || value < 1 || value > 16384) return;
    const size = layerLocalSize(layer), dimension = axis === 'x' ? size.w : size.h;
    const k = value / Math.max(1, dimension), sign = Math.sign(layer.transform.scale[axis]), scale = { ...layer.transform.scale, [axis]: k * sign };
    if (lockRatio) { const other = axis === 'x' ? 'y' : 'x'; scale[other] = layer.transform.scale[other] * k / Math.abs(layer.transform.scale[axis]); }
    patch({ transform: { ...layer.transform, scale } });
  }
  return <div className="properties-content">
    <section><h2>Canvas</h2><div className="field-grid"><Field label="Width"><input aria-label="Canvas width" type="number" min={1} max={8192} value={w} onChange={(e) => setW(Number(e.target.value))} /></Field><Field label="Height"><input aria-label="Canvas height" type="number" min={1} max={8192} value={h} onChange={(e) => setH(Number(e.target.value))} /></Field></div>
      <label className="check-field"><input type="checkbox" checked={scaleContent} onChange={(e) => setScaleContent(e.target.checked)} />Scale content with canvas</label>
      <button className="wide" onClick={() => s.resizeCanvas(w, h, scaleContent)}><Icon name="crop" />Resize canvas</button>
      <h3>Quick sizes</h3><div className="button-row">{[['Square', 1080, 1080], ['Portrait', 1080, 1350], ['Story', 1080, 1920]].map(([name, width, height]) => <button key={name} onClick={() => s.resizeCanvas(Number(width), Number(height), scaleContent)}>{name}</button>)}</div>
      <h3>Background</h3><div className="swatches">{['transparent', '#ffffff', '#000000'].map((c) => <button key={c} aria-label={`${c} background`} title={`${c} background`} className={`${c === 'transparent' ? 'checker' : ''} ${(c === 'transparent' && doc.background[3] === 0) || toHex(doc.background) === c && doc.background[3] === 1 ? 'chosen' : ''}`} style={{ backgroundColor: c }} onClick={() => s.commit('Canvas background', (d) => { d.background = c === 'transparent' ? [0, 0, 0, 0] : rgba(c); })} />)}<input aria-label="Custom background color" type="color" value={toHex(doc.background)} onChange={(e) => s.commit('Canvas background', (d) => { d.background = rgba(e.target.value); })} /></div>
    </section>
    {activeTool === 'crop' && <section className="tool-help"><h3>Crop canvas</h3><p>Drag a rectangle on the canvas to crop. Layers stay editable. Undo restores the full canvas.</p></section>}
    {['lasso', 'polygon', 'magic-wand', 'eraser'].includes(activeTool) && <section><h3>{activeTool === 'eraser' ? 'Eraser' : 'Cutout tools'}</h3><p className="muted">{activeTool === 'eraser' ? 'Brush away parts of the selected image. Its original pixels stay intact.' : 'Lasso keeps the area you draw. Magic Wand removes connected background colors.'}</p><div className="button-row"><button onClick={() => s.setActiveTool('lasso')}>Lasso</button><button onClick={() => s.setActiveTool('magic-wand')}>Magic Wand</button><button onClick={onCut}>Auto Cut</button></div>
      {activeTool === 'magic-wand' && <Range label="Tolerance" min={1} max={100} value={s.wandTolerance} onChange={s.setWandTolerance} />}
      {activeTool === 'eraser' && <Range label="Brush size" min={4} max={300} value={s.brushSize} onChange={s.setBrushSize} />}
    </section>}
    {!layer && <section><h3>Get started</h3><p className="muted">Select a layer to see its editing controls.</p></section>}
    {layer && <section className="layer-properties"><h2>{layer.type === 'image' ? 'Image' : layer.type === 'text' ? 'Text' : 'Shape'} properties</h2>
      {layer.locked && <p className="muted">This layer is locked. Unlock it in Layers to edit.</p>}
      <fieldset disabled={layer.locked}>
      {layer.type === 'image' && <><h3>Adjustments</h3><p className="muted">Reversible. Original image preserved.</p>{(['brightness', 'contrast', 'saturation', 'grayscale', 'sepia', 'blur'] as const).map((key) => <Range key={key} label={key[0]!.toUpperCase() + key.slice(1)} min={['brightness', 'contrast', 'saturation'].includes(key) ? -100 : 0} max={key === 'blur' ? 20 : 100} value={Math.round((layer.adjustments ?? NEUTRAL)[key] * (key === 'blur' ? 1 : 100))} onChange={(v) => patch({ adjustments: { ...NEUTRAL, ...layer.adjustments, [key]: v / (key === 'blur' ? 1 : 100) } } as Partial<Layer>)} />)}
        <div className="button-row"><button onClick={() => patch({ adjustments: { ...NEUTRAL, grayscale: 1 } } as Partial<Layer>)}>Mono</button><button onClick={() => patch({ adjustments: { ...NEUTRAL, saturation: .3, contrast: .1 } } as Partial<Layer>)}>Vivid</button><button onClick={() => patch({ adjustments: { ...NEUTRAL, sepia: .65, contrast: -.1 } } as Partial<Layer>)}>Vintage</button></div>
        <button className="wide" onClick={() => patch({ adjustments: { ...NEUTRAL } } as Partial<Layer>)}>Reset adjustments</button>
        {layer.maskBitmapId && <button className="wide" onClick={() => patch({ maskBitmapId: null })}>Restore original mask</button>}
      </>}
      {layer.type === 'text' && <>
        <Field label="Text"><textarea rows={3} value={layer.text} onChange={(e) => patch({ text: e.target.value } as Partial<Layer>)} /></Field>
        <Field label="Font family"><select value={layer.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value } as Partial<Layer>)}>{[...new Set([layer.fontFamily, 'Arial', 'Georgia', 'Verdana', 'Courier New', 'Times New Roman', 'Inter'])].map((font) => <option key={font}>{font}</option>)}</select></Field>
        <div className="field-grid"><Field label="Font size"><input type="number" min={4} max={1000} value={layer.fontSizePx} onChange={(e) => patch({ fontSizePx: Math.max(4, Number(e.target.value)) } as Partial<Layer>)} /></Field><Field label="Text color"><input type="color" value={toHex(layer.color)} onChange={(e) => patch({ color: rgba(e.target.value) } as Partial<Layer>)} /></Field></div>
        <div className="button-row"><button aria-pressed={layer.fontWeight === 700} onClick={() => patch({ fontWeight: layer.fontWeight === 700 ? 400 : 700 } as Partial<Layer>)}>Bold</button><button aria-pressed={layer.fontStyle === 'italic'} onClick={() => patch({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' } as Partial<Layer>)}>Italic</button></div>
        <Field label="Alignment"><select value={layer.align} onChange={(e) => patch({ align: e.target.value } as Partial<Layer>)}><option>left</option><option>center</option><option>right</option></select></Field>
        <div className="field-grid"><Field label="Line spacing"><input type="number" min={.5} max={5} step={.1} value={layer.lineHeight} onChange={(e) => patch({ lineHeight: Math.max(.5, Number(e.target.value)) } as Partial<Layer>)} /></Field><Field label="Letter spacing (em)"><input type="number" min={-.2} max={2} step={.01} value={layer.letterSpacingEm} onChange={(e) => patch({ letterSpacingEm: Number(e.target.value) } as Partial<Layer>)} /></Field></div>
      </>}
      {layer.type === 'shape' && <><Field label="Shape"><select value={layer.shape} onChange={(e) => patch({ shape: e.target.value } as Partial<Layer>)}><option>rectangle</option><option>ellipse</option><option>polygon</option></select></Field><div className="field-grid"><Field label="Fill color"><input type="color" value={toHex(layer.fill)} onChange={(e) => patch({ fill: rgba(e.target.value) } as Partial<Layer>)} /></Field><Field label="Stroke color"><input type="color" value={toHex(layer.stroke)} onChange={(e) => patch({ stroke: rgba(e.target.value) } as Partial<Layer>)} /></Field></div><Field label="Stroke width"><input type="number" min={0} max={100} value={layer.strokeWidth} onChange={(e) => patch({ strokeWidth: Math.max(0, Number(e.target.value)) } as Partial<Layer>)} /></Field><Field label="Corner radius"><input type="number" min={0} value={layer.cornerRadius} onChange={(e) => patch({ cornerRadius: Math.max(0, Number(e.target.value)) } as Partial<Layer>)} /></Field>{layer.shape === 'polygon' && <Field label="Sides"><input type="number" min={3} max={64} value={layer.sides} onChange={(e) => patch({ sides: Math.min(64, Math.max(3, Number(e.target.value))) } as Partial<Layer>)} /></Field>}</>}
      <h3>Transform &amp; blend</h3>
      <Field label="Layer name"><input value={layer.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
      <div className="field-grid"><Field label="X position"><input type="number" value={Math.round(layer.transform.position.x)} onChange={(e) => patch({ transform: { ...layer.transform, position: { ...layer.transform.position, x: Number(e.target.value) } } })} /></Field><Field label="Y position"><input type="number" value={Math.round(layer.transform.position.y)} onChange={(e) => patch({ transform: { ...layer.transform, position: { ...layer.transform.position, y: Number(e.target.value) } } })} /></Field></div>
      {layer.type !== 'group' && <><div className="field-grid"><Field label="Layer width"><input type="number" min={1} max={16384} value={Math.round(layerLocalSize(layer).w * Math.abs(layer.transform.scale.x))} onChange={(e) => resizeLayer(Number(e.target.value), 'x')} /></Field><Field label="Layer height"><input type="number" min={1} max={16384} value={Math.round(layerLocalSize(layer).h * Math.abs(layer.transform.scale.y))} onChange={(e) => resizeLayer(Number(e.target.value), 'y')} /></Field></div><label className="check-field"><input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} />Keep aspect ratio</label></>}
      <Field label="Rotation (degrees)"><input type="number" min={-360} max={360} value={Math.round(layer.transform.rotation * 180 / Math.PI)} onChange={(e) => patch({ transform: { ...layer.transform, rotation: Number(e.target.value) * Math.PI / 180 } })} /></Field>
      <div className="button-row"><button onClick={() => patch({ transform: { ...layer.transform, rotation: layer.transform.rotation + Math.PI / 2 } })}>Rotate 90°</button><button onClick={() => patch({ transform: { ...layer.transform, scale: { ...layer.transform.scale, x: -layer.transform.scale.x } } })}>Flip H</button><button onClick={() => patch({ transform: { ...layer.transform, scale: { ...layer.transform.scale, y: -layer.transform.scale.y } } })}>Flip V</button></div>
      <button className="wide" onClick={() => patch({ transform: { ...layer.transform, position: { x: doc.width / 2, y: doc.height / 2 } } })}>Center on canvas</button>
      <Range label="Opacity" min={0} max={100} value={Math.round(layer.opacity * 100)} onChange={(v) => s.setOpacity(layer.id, v / 100)} />
      <Field label="Blend mode"><select value={layer.blendMode} onChange={(e) => s.setBlend(layer.id, e.target.value as BlendMode)}>{BLEND_MODES.map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
      </fieldset>
    </section>}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element { return <label className="field"><span>{label}</span>{children}</label>; }
function Range({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }): React.JSX.Element {
  const s = useEditorStore(), coalesce = label !== 'Tolerance' && label !== 'Brush size';
  return <label className="field range-field"><span>{label}<output>{value}</output></span><input aria-label={label} type="range" min={min} max={max} value={value} onPointerDown={() => { if (coalesce) s.beginGesture(); }} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={() => { if (coalesce) s.endGesture(`Change ${label.toLowerCase()}`); }} onPointerCancel={() => { if (coalesce) s.cancelGesture(); }} /></label>;
}
