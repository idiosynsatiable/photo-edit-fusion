import { describe, it, expect } from 'vitest';
import { correctPixels, estimateCorrection } from '../lib/color-transfer.js';
const flat=(r:number,g:number,b:number,a=255)=>new Uint8ClampedArray(Array.from({length:100},()=>[r,g,b,a]).flat());
describe('scene color matching',()=>{
  it('matches a color cast without changing alpha or original source storage',()=>{
    const source=flat(180,100,60),original=source.slice(),effect=estimateCorrection(source,flat(100,140,160));effect.strength=1;correctPixels(source,effect);
    expect([...source.slice(0,4)]).toEqual([100,140,160,255]);expect(original[0]).toBe(180);
  });
  it('leaves pixels unchanged at zero strength and rejects transparent overlap',()=>{
    const source=flat(200,90,30),original=source.slice(),effect=estimateCorrection(source,flat(80,110,170));effect.strength=0;correctPixels(source,effect);expect(source).toEqual(original);
    expect(()=>estimateCorrection(source,flat(0,0,0,0))).toThrow('Not enough overlap');
  });
});
