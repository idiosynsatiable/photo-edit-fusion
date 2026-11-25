import type { Document as EditorDocument, ImageLayer } from '@pef/shared';
import { transformToMatrix, invertMatrix } from '@pef/canvas-engine';
import { loadBitmaps, renderDocument } from './render.js';
import { estimateCorrection, type Correction } from './color-transfer.js';
export type { Correction } from './color-transfer.js';
export async function matchScene(doc: EditorDocument, layer: ImageLayer): Promise<Correction> {
  const index = doc.layerOrder.indexOf(layer.id), below = doc.layerOrder.slice(0,index);
  if (!below.some((id) => doc.layers[id]?.visible && doc.layers[id]?.type !== 'group')) throw new Error('Add a background photo beneath this image before matching the scene.');
  if (Math.abs(layer.transform.scale.x * layer.transform.scale.y) < 1e-8) throw new Error('Resize this zero-scale layer before matching.');
  const cache = new Map<string, HTMLImageElement | HTMLCanvasElement>(); await loadBitmaps(doc,cache);
  const ratio = Math.min(1,512 / Math.max(layer.sourceWidth,layer.sourceHeight));
  const width = Math.max(1,Math.round(layer.sourceWidth*ratio)), height = Math.max(1,Math.round(layer.sourceHeight*ratio));
  const source = document.createElement('canvas'), reference = document.createElement('canvas');
  source.width = reference.width = width; source.height = reference.height = height;
  const a = source.getContext('2d',{willReadFrequently:true})!, b = reference.getContext('2d',{willReadFrequently:true})!;
  const sx = width/layer.sourceWidth, sy = height/layer.sourceHeight; a.scale(sx,sy);
  const neutral: ImageLayer = { ...layer, visible:true, opacity:1, blendMode:'normal', harmonization:undefined, featherPx:0, transform: {position:{x:0,y:0},rotation:0,scale:{x:1,y:1},anchor:{x:0,y:0}} };
  renderDocument({doc:{...doc,width:layer.sourceWidth,height:layer.sourceHeight,background:[0,0,0,0],layerOrder:[layer.id],layers:{[layer.id]:neutral}},ctx:a,bitmapCache:cache});
  const inv = invertMatrix(transformToMatrix(layer.transform,layer.sourceWidth,layer.sourceHeight));
  b.setTransform(inv[0]!*sx,inv[1]!*sy,inv[3]!*sx,inv[4]!*sy,inv[6]!*sx,inv[7]!*sy);
  renderDocument({doc:{...doc,layerOrder:below},ctx:b,bitmapCache:cache});
  return estimateCorrection(a.getImageData(0,0,width,height).data,b.getImageData(0,0,width,height).data);
}
