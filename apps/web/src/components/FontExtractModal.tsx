import React, { useEffect, useRef, useState } from 'react';
import { createWorker, PSM } from 'tesseract.js';
import { addTextLayer } from '@pef/canvas-engine';
import type { TextLayer } from '@pef/shared';
import { useEditorStore } from '../store/editor-store.js';
import { loadBitmaps, renderDocument } from '../lib/render.js';
import { matchingCandidates, paintText, ensureProjectFonts } from '../lib/typography.js';
import { fitVisualFont, sampleInk, type InkSample, type VisualMatch } from '../lib/visual-font-match.js';
import { readFileAsDataUrl } from '../lib/file-utils.js';
import { Icon } from './Icon.js';
interface Rect { x: number; y: number; w: number; h: number }
interface Line { text: string; confidence: number; rect: Rect }
export function FontExtractModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element | null {
  const source = useRef<HTMLCanvasElement>(null), preview = useRef<HTMLCanvasElement>(null), worker = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null);
  const operation = useRef<AbortController | null>(null), session = useRef(0), start = useRef<{x:number;y:number} | null>(null);
  const [crop,setCrop] = useState<Rect | null>(null), [lines,setLines] = useState<Line[]>([]), [text,setText] = useState('');
  const [matches,setMatches] = useState<VisualMatch[]>([]), [sample,setSample] = useState<InkSample | null>(null), [chosen,setChosen] = useState(0);
  const [busy,setBusy] = useState(''), [error,setError] = useState(''), [ready,setReady] = useState(false), [confidence,setConfidence] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const id = ++session.current;
    setCrop(null); setLines([]); setText(''); setMatches([]); setSample(null); setError(''); setReady(false); setConfidence(null); setBusy('');
    void (async () => {
      const doc = useEditorStore.getState().doc, cache = new Map<string,HTMLImageElement>(); await loadBitmaps(doc,cache);
      if (session.current !== id || !source.current) return;
      source.current.width = doc.width; source.current.height = doc.height;
      renderDocument({doc,ctx:source.current.getContext('2d')!,bitmapCache:cache}); setReady(true);
    })().catch((e: unknown) => { if (session.current === id) setError(String(e)); });
    return () => { ++session.current; operation.current?.abort(); void worker.current?.terminate(); worker.current = null; };
  },[open]);
  function cancel(): void { operation.current?.abort(); operation.current = null; void worker.current?.terminate(); worker.current = null; setBusy(''); }
  function select(rect: Rect, wording = '', certainty: number | null = null): void { setCrop(rect); setText(wording); setConfidence(certainty); setMatches([]); setSample(null); setError(''); }
  function point(e: React.PointerEvent<HTMLCanvasElement>): {x:number;y:number} {
    const c=e.currentTarget,r=c.getBoundingClientRect(); return {x:Math.max(0,Math.min(c.width,(e.clientX-r.left)/r.width*c.width)),y:Math.max(0,Math.min(c.height,(e.clientY-r.top)/r.height*c.height))};
  }
  function rectFrom(p:{x:number;y:number},q:{x:number;y:number}): Rect { return {x:Math.floor(Math.min(p.x,q.x)),y:Math.floor(Math.min(p.y,q.y)),w:Math.max(1,Math.ceil(Math.abs(q.x-p.x))),h:Math.max(1,Math.ceil(Math.abs(q.y-p.y)))}; }
  function region(rect: Rect): HTMLCanvasElement { const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(rect.w)); c.height=Math.max(1,Math.round(rect.h)); c.getContext('2d')!.drawImage(source.current!,rect.x,rect.y,rect.w,rect.h,0,0,c.width,c.height); return c; }
  async function recognize(all: boolean): Promise<void> {
    const src=source.current; if (!src || (!all && !crop)) return;
    const token=session.current,controller=new AbortController(); operation.current=controller; setError(''); setBusy(all?'Scanning image…':'Reading selected line…');
    let active: Awaited<ReturnType<typeof createWorker>> | null=null;
    try {
      const rect=all?{x:0,y:0,w:src.width,h:src.height}:crop!,input=region(rect),scale=Math.min(1,Math.sqrt(4_000_000/(input.width*input.height)));
      const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(input.width*scale)); c.height=Math.max(1,Math.round(input.height*scale)); c.getContext('2d')!.drawImage(input,0,0,c.width,c.height);
      active=await createWorker('eng',1,{workerPath:'./tesseract/worker.min.js',langPath:'./tesseract/lang',corePath:'./tesseract/core',workerBlobURL:false,gzip:false});
      if (controller.signal.aborted || token!==session.current) { await active.terminate(); return; }
      worker.current=active; await active.setParameters({tessedit_pageseg_mode:all?PSM.AUTO:PSM.SINGLE_LINE});
      const result=await active.recognize(c); if (controller.signal.aborted || token!==session.current) return;
      if (all) {
        const found=(result.data.lines??[]).filter((l)=>l.text.trim()).map((l)=>{
          const x=Math.max(0,Math.floor(l.bbox.x0/scale)-3),y=Math.max(0,Math.floor(l.bbox.y0/scale)-3);
          return {text:l.text.trim(),confidence:l.confidence,rect:{x,y,w:Math.min(src.width-x,Math.ceil(l.bbox.x1/scale)+3-x),h:Math.min(src.height-y,Math.ceil(l.bbox.y1/scale)+3-y)}};
        });
        setLines(found); if (found[0]) select(found[0].rect,found[0].text,found[0].confidence);
        else throw new Error('No readable lines found. Drag around one line and enter its wording to fit it visually.');
      } else { setText(result.data.text.trim().replace(/\n/g,' ')); setConfidence(result.data.confidence); if (!result.data.text.trim()) throw new Error('Could not read this line. Enter its wording below, then fit the font.'); }
    } catch(e) { if (!controller.signal.aborted && token===session.current) setError(e instanceof Error?e.message:String(e)); }
    finally { if (worker.current===active) worker.current=null; if (active && !controller.signal.aborted) await active.terminate(); if (token===session.current && operation.current===controller) setBusy(''); }
  }
  async function fit(): Promise<void> {
    if (!crop || !text.trim()) return;
    const token=session.current,controller=new AbortController(); operation.current=controller; setBusy('Loading offline fonts…'); setError(''); setMatches([]);
    try {
      const c=region(crop),ink=sampleInk(c.getContext('2d')!.getImageData(0,0,c.width,c.height)),fonts=await matchingCandidates(useEditorStore.getState().doc);
      const found=await fitVisualFont(ink,text.trim(),fonts,controller.signal,(p)=>{if(token===session.current && operation.current===controller)setBusy('Fitting glyphs… '+Math.round(p*100)+'%');});
      if (controller.signal.aborted || token!==session.current) return;
      setSample(ink); setMatches(found); setChosen(0);
      if (ink.height<16 || ink.contrast<35 || (found[0]?.score??0)<.65) setError('Approximate result: this sample is small, low contrast or unlike the available fonts. Check the preview; import the original font for a closer fit.');
    } catch(e) { if (!controller.signal.aborted && token===session.current) setError(e instanceof Error?e.message:String(e)); }
    finally { if (token===session.current && operation.current===controller) setBusy(''); }
  }
  function textLayer(match: VisualMatch): TextLayer {
    return {id:'',name:'',type:'text',text:text.trim(),visible:true,locked:false,opacity:1,blendMode:'normal',parentId:null,maskBitmapId:null,transform:{anchor:{x:0,y:0},position:{x:0,y:0},scale:{x:match.scaleX,y:1},rotation:0},fontFamily:match.family,fontWeight:match.weight,fontStyle:match.style,fontSizePx:match.size,inkMetrics:match.metrics,letterSpacingEm:match.tracking,lineHeight:1.2,align:'left',color:sample?.color??[0,0,0,1],webFontUrl:null};
  }
  useEffect(()=>{
    const match=matches[chosen],c=preview.current;if(!match||!sample||!c)return;
    c.width=sample.width+16;c.height=sample.height+16;const ctx=c.getContext('2d')!;ctx.translate(8,8);ctx.scale(match.scaleX,1);paintText(ctx,textLayer(match));
  },[matches,chosen,sample]);
  function apply(): void {
    const match=matches[chosen];if(!match||!sample||!crop)return;
    const fitted=textLayer(match),state=useEditorStore.getState();
    state.commit('Add visually matched text',(doc)=>{
      const next=addTextLayer(doc,{text:fitted.text}),id=next.layerOrder.at(-1)!;
      doc.layers[id]={...fitted,id,name:'Matched text · '+match.family,transform:{...fitted.transform,position:{x:crop.x+sample.x,y:crop.y+sample.y}}};doc.layerOrder.push(id);
    });
    useEditorStore.getState().selectLayer(useEditorStore.getState().doc.layerOrder.at(-1)!);state.setActiveTool('move');onClose();
  }
  async function importFont(file?: File): Promise<void> {
    if(!file)return;const token=session.current;setError('');setBusy('Importing font…');
    try {
      if(file.size>8_000_000)throw new Error('Choose a font file smaller than 8 MB.');
      const family=file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,60)+'-'+crypto.randomUUID().slice(0,6);
      const asset={family,dataUrl:await readFileAsDataUrl(file),weight:'400',style:'normal' as const},id=crypto.randomUUID(),doc=useEditorStore.getState().doc;
      await ensureProjectFonts({...doc,fonts:{...doc.fonts,[id]:asset}});if(token!==session.current)return;
      useEditorStore.getState().commit('Import font',(d)=>{d.fonts={...d.fonts,[id]:asset};});setMatches([]);
      useEditorStore.getState().setNotice('Font imported. It is included when you save this project. Fit the line again to include it.');
    }catch(e){if(token===session.current)setError(e instanceof Error?e.message:String(e));}finally{if(token===session.current)setBusy('');}
  }
  if(!open)return null;const doc=useEditorStore.getState().doc;
  return <div className="modal-backdrop" onClick={()=>{cancel();onClose();}}><section className="editor-modal font-studio" role="dialog" aria-modal="true" aria-label="Text and font extraction" onClick={(e)=>e.stopPropagation()}>
    <header><div><span className="eyebrow">TYPOGRAPHY STUDIO</span><h2>Find the look. Keep it editable.</h2></div><button aria-label="Close font matching" onClick={()=>{cancel();onClose();}}><Icon name="close"/></button></header>
    <p className="muted">Scan for text, or drag around one straight line. The app compares actual rendered glyphs and automatically selects its closest fit, size, spacing and color.</p>
    <div className="font-studio-grid"><div><div className="font-source-wrap"><div className="font-source-relative"><canvas aria-label="Font source image" ref={source} onPointerDown={(e)=>{if(busy)return;e.currentTarget.setPointerCapture(e.pointerId);start.current=point(e);setMatches([]);}} onPointerMove={(e)=>{if(start.current)setCrop(rectFrom(start.current,point(e)));}} onPointerUp={(e)=>{if(!start.current)return;const rect=rectFrom(start.current,point(e));start.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(rect.w>4&&rect.h>4)select(rect);}} onPointerCancel={()=>{start.current=null;}}/>
    {crop&&<div className="font-crop" style={{left:crop.x/doc.width*100+'%',top:crop.y/doc.height*100+'%',width:crop.w/doc.width*100+'%',height:crop.h/doc.height*100+'%'}}/>}</div></div>
    <div className="button-row"><button disabled={!ready||!!busy} onClick={()=>void recognize(true)}>Scan whole image</button><button disabled={!crop||!!busy} onClick={()=>void recognize(false)}>Read selected line</button></div>
    {lines.length>0&&<label className="field">Detected lines<select aria-label="Detected lines" onChange={(e)=>{const line=lines[Number(e.target.value)]!;select(line.rect,line.text,line.confidence);}}>{lines.map((line,i)=><option key={i} value={i}>{line.text}</option>)}</select></label>}
    <p className="muted">On-device English OCR. Handwriting, curved text, heavy effects and textured backgrounds may need manual correction.</p></div>
    <div><label className="field">Recognized wording<input aria-label="Recognized wording" value={text} disabled={!!busy} onChange={(e)=>{setText(e.target.value);setMatches([]);}} placeholder="Read the line or type its exact wording"/></label>
    {confidence!==null&&<p className="muted">OCR confidence {Math.round(confidence)}% · correct any mistakes before fitting.</p>}
    <button className="primary wide" disabled={!crop||!text.trim()||!!busy} onClick={()=>void fit()}>Auto-match font &amp; appearance</button>
    {busy&&<div role="status" className="match-progress"><span>{busy}</span><button onClick={cancel}>Cancel</button></div>}
    {matches[chosen]&&<><h3>Automatically selected · {matches[chosen]!.family}</h3><div className="font-match-preview checker"><canvas aria-label="Matched text preview" ref={preview}/></div><p className="muted">Visual fit {Math.round(matches[chosen]!.score*100)} / 100 · weight {matches[chosen]!.weight} · {matches[chosen]!.style}. This is a similarity score, not proof of font identity.</p><button className="primary wide" onClick={apply}>Add matched editable text</button><details><summary>Compare other fits</summary>{matches.map((m,i)=><button className="wide" key={i} aria-pressed={chosen===i} onClick={()=>setChosen(i)}>{m.family} · {Math.round(m.score*100)}</button>)}</details></>}
    <div className="font-import"><h3>Have the original font?</h3><p className="muted">Import a licensed TTF, OTF, WOFF or WOFF2 file. The font travels with your saved project.</p><label className="file-button">Import font<input aria-label="Import font" type="file" accept=".ttf,.otf,.woff,.woff2" disabled={!!busy} onChange={(e)=>{void importFont(e.target.files?.[0]);e.target.value='';}}/></label></div>
    <p className="muted">14 bundled Latin font families plus your imported fonts. An absent or custom typeface can only be approximated. Original imagery stays intact beneath the new text.</p>
    </div></div>{error&&<p role="alert" className="error">{error}</p>}
  </section></div>;
}
