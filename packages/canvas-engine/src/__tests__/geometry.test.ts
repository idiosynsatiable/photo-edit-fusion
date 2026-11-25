import { describe, it, expect } from 'vitest';
import { createDocument } from '../document.js';
import { addImageLayer } from '../layer-ops.js';
import { hitTest, layerWorldBounds } from '../hit-test.js';
describe('geometry matches the rendered anchor',()=>{
  it('finds visible pixels and bounds rotated/flipped layers consistently',()=>{
    const doc=addImageLayer(createDocument({width:400,height:300}),{bitmapId:'b',bitmapDataUrl:'data:image/png;base64,AA',sourceWidth:100,sourceHeight:60}),layer=doc.layers[doc.layerOrder[0]!]!;
    expect(layerWorldBounds(layer)).toEqual({minX:150,minY:120,maxX:250,maxY:180});expect(hitTest(doc,{x:151,y:121})?.id).toBe(layer.id);expect(hitTest(doc,{x:251,y:181})).toBeNull();
    const transformed={...layer,transform:{...layer.transform,rotation:Math.PI/2,scale:{x:-2,y:1}}},bounds=layerWorldBounds(transformed);
    expect(bounds.minX).toBeCloseTo(170);expect(bounds.maxX).toBeCloseTo(230);expect(bounds.minY).toBeCloseTo(50);expect(bounds.maxY).toBeCloseTo(250);
  });
});
