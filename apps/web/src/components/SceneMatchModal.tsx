import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { loadBitmaps, renderDocument } from '../lib/render.js';
import { matchScene, type Correction } from '../lib/scene-match.js';
import { Icon } from './Icon.js';
export function SceneMatchModal({onClose}:{onClose:()=>void}): React.JSX.Element {
  const snapshot=useRef(useEditorStore.getState().doc),layerId=useRef(useEditorStore.getState().selectedLayerId);
  const canvas=useRef<HTMLCanvasElement>(null),[effect,setEffect]=useState<Correction|null>(null),[strength,setStrength]=useState(65),[feather,setFeather]=useState(2),[before,setBefore]=useState(false),[error,setError]=useState('');
  const doc=snapshot.current,layer=layerId.current?doc.layers[layerId.current]:null;
  useEffect(()=>{let cancelled=false;if(layer?.type==='image')void matchScene(doc,layer).then((v)=>{if(!cancelled)setEffect(v);}).catch((e:unknown)=>{if(!cancelled)setError(e instanceof Error?e.message:String(e));});return()=>{cancelled=true;};},[]);
  useEffect(()=>{
    let cancelled=false;
    void(async()=>{if(!layer||!canvas.current)return;const cache=new Map<string,HTMLImageElement>();await loadBitmaps(doc,cache);if(cancelled)return;
      const c=canvas.current;if(!c)return;const ratio=Math.min(1,900/Math.max(doc.width,doc.height));c.width=Math.max(1,Math.round(doc.width*ratio));c.height=Math.max(1,Math.round(doc.height*ratio));
      const ctx=c.getContext('2d')!;ctx.scale(ratio,ratio);const preview=before||!effect?doc:{...doc,layers:{...doc.layers,[layer.id]:{...layer,harmonization:{...effect,strength:strength/100},featherPx:feather}}};
      renderDocument({doc:preview,ctx,bitmapCache:cache});
    })().catch((e:unknown)=>setError(String(e)));return()=>{cancelled=true;};
  },[effect,strength,feather,before]);
  function apply():void{if(!layer||!effect)return;const state=useEditorStore.getState();if(state.doc!==doc||state.doc.layers[layer.id]?.locked){setError('The project changed. Close this preview and match the scene again.');return;}
    state.commit('Match photo to scene',(draft)=>{const target=draft.layers[layer.id];if(target?.type==='image'){target.harmonization={...effect,strength:strength/100};target.featherPx=feather;}});onClose();
  }
  return <div className="modal-backdrop" onClick={onClose}><section className="editor-modal" role="dialog" aria-modal="true" aria-label="Match scene" onClick={(e)=>e.stopPropagation()}>
    <header><div><span className="eyebrow">PHOTO COMPOSITING</span><h2>Bring the colors together.</h2></div><button aria-label="Close scene matching" onClick={onClose}><Icon name="close"/></button></header>
    <p className="muted">Matches this image’s color and tone to visible layers underneath its position. Use a cutout mask first for portraits and objects.</p>
    <canvas className="scene-preview" ref={canvas} aria-label="Scene matching preview"/>
    <label className="field">Match strength · {strength}%<input aria-label="Match strength" type="range" min={0} max={100} value={strength} onChange={(e)=>setStrength(Number(e.target.value))}/></label>
    <label className="field">Edge feather · {feather} source px<input aria-label="Scene edge feather" type="range" min={0} max={30} value={feather} onChange={(e)=>setFeather(Number(e.target.value))}/></label>
    <label className="check-field"><input type="checkbox" checked={before} onChange={(e)=>setBefore(e.target.checked)}/>Show before</label>
    <p className="muted">Original pixels and masks are preserved. Fine-tune lighting and perspective after matching; this does not reconstruct shadows or guarantee an invisible edit.</p>
    {!effect&&!error&&<p role="status">Analyzing scene colors…</p>}{error&&<p role="alert" className="error">{error}</p>}
    <button className="primary wide" disabled={!effect||!!error} onClick={apply}>Apply scene match</button>
  </section></div>;
}
