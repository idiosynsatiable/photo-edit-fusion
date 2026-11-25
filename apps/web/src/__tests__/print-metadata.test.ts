import { describe, it, expect } from 'vitest';
import { stampDensity } from '../lib/print-metadata.js';
describe('embedded print density',()=>{
  it('updates JFIF density and preserves encoded image data',()=>{
    const bytes=new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,255,218,1,2,3]),out=stampDensity(bytes,'jpeg',300);
    expect([...out.slice(13,18)]).toEqual([1,1,44,1,44]);expect(out.slice(20)).toEqual(bytes.slice(20));expect(bytes[13]).toBe(0);
  });
  it('inserts one PNG density chunk and keeps IDAT data intact',()=>{
    const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,2,73,68,65,84,12,34,0,0,0,0,0,0,0,0,73,69,78,68,0,0,0,0]),out=stampDensity(bytes,'png',300),twice=stampDensity(out,'png',150);
    expect(out.length).toBe(bytes.length+21);expect(twice.length).toBe(out.length);expect(new DataView(out.buffer).getUint32(16)).toBe(11811);expect(new DataView(twice.buffer).getUint32(16)).toBe(5906);expect(out.slice(29)).toEqual(bytes.slice(8));
  });
});
