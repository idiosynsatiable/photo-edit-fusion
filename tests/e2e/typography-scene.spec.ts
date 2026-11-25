import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test.beforeEach(async({page})=>{page.on('dialog',(dialog)=>dialog.accept());});
async function openRaster(page:Page,data:string,name='creative-poster.png',add=false):Promise<void>{
  await page.locator(add?'#add-image-input':'#open-image-input').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(data,'base64')});await expect(page.getByText('Image properties',{exact:true})).toBeVisible();
}
async function pixels(page:Page):Promise<number[]>{return page.getByLabel('Photo editing canvas').evaluate((c:HTMLCanvasElement)=>[...c.getContext('2d')!.getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data]);}
async function saveProject(page:Page):Promise<any>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project',exact:true}).click();return JSON.parse(await readFile((await(await event).path())!,'utf8'));}
test('whole-image OCR and rendered glyph fitting automatically find the closest bundled font',async({page,context})=>{
  test.setTimeout(120_000);await page.goto('/');
  const data=await page.evaluate(async()=>{
    await document.fonts.load('700 64px "Oswald"','FUSION STUDIO');const c=document.createElement('canvas');c.width=640;c.height=180;const x=c.getContext('2d')!;x.fillStyle='#f7f7f7';x.fillRect(0,0,640,180);x.fillStyle='#164d54';x.font='700 64px "Oswald"';x.fillText('FUSION STUDIO',60,110);return c.toDataURL().split(',')[1]!;
  });
  await openRaster(page,data);await page.getByRole('button',{name:'Font Extract (F)',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Text and font extraction'});
  await dialog.getByRole('button',{name:'Scan whole image',exact:true}).click();await expect(dialog.getByLabel('Recognized wording',{exact:true})).toHaveValue('FUSION STUDIO',{timeout:60_000});
  await dialog.getByRole('button',{name:'Auto-match font & appearance',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Automatically selected · Oswald',exact:true})).toBeVisible({timeout:30_000});await page.screenshot({path:test.info().outputPath('automatic-font-match.png')});
  await context.setOffline(true);await dialog.getByRole('button',{name:'Add matched editable text',exact:true}).click();await expect(page.getByLabel('Font family',{exact:true})).toHaveValue('Oswald');
  const project=await saveProject(page),layers=Object.values(project.document.layers) as any[],text=layers.find((l)=>l.type==='text');expect(layers).toHaveLength(2);expect(text.fontWeight).toBe(700);expect(text.inkMetrics).toBeDefined();expect(text.color[1]).toBeCloseTo(77/255,1);expect(text.transform.position.x).toBeGreaterThan(55);expect(text.transform.position.x).toBeLessThan(70);
  await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await saveProject(page)).document.layerOrder).toHaveLength(1);
});
for(const family of ['Lora','Pacifico']){
  test('visual matcher distinguishes '+family+' from other font styles',async({page})=>{
    test.setTimeout(60_000);await page.goto('/');
    const result=await page.evaluate(async(family)=>{
      const [{fitVisualFont,sampleInk},{matchingCandidates}]=await Promise.all([import('/src/lib/visual-font-match.ts'),import('/src/lib/typography.ts')]);
      const c=document.createElement('canvas');c.width=650;c.height=140;const ctx=c.getContext('2d')!;await document.fonts.load('400 60px "'+family+'"');ctx.fillStyle='#fff';ctx.fillRect(0,0,650,140);ctx.fillStyle='#222';ctx.font='400 60px "'+family+'"';ctx.fillText('Creative mornings',20,90);
      const fonts=await matchingCandidates({layers:{}} as any),ink=sampleInk(ctx.getImageData(0,0,650,140));return fitVisualFont(ink,'Creative mornings',fonts,new AbortController().signal,()=>{});
    },family);expect(result[0]!.family).toBe(family);expect(result[0]!.score).toBeGreaterThan(.8);
  });
}
test('scene matching preserves originals through undo and reload',async({page})=>{
  await page.goto('/');
  const raster=async(color:string)=>page.evaluate((color)=>{const c=document.createElement('canvas');c.width=128;c.height=96;const x=c.getContext('2d')!;x.fillStyle=color;x.fillRect(0,0,128,96);return c.toDataURL().split(',')[1]!;},color);
  await openRaster(page,await raster('rgb(90,140,165)'),'background.png');await openRaster(page,await raster('rgb(180,100,65)'),'overlay.png',true);await expect.poll(()=>pixels(page)).toEqual([180,100,65,255]);const before=await saveProject(page);
  await page.getByRole('button',{name:'Match scene automatically',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Match scene',exact:true});await expect(dialog.getByRole('button',{name:'Apply scene match',exact:true})).toBeEnabled();await dialog.getByLabel('Match strength',{exact:true}).fill('100');await dialog.getByRole('button',{name:'Apply scene match',exact:true}).click();await expect.poll(()=>pixels(page)).toEqual([90,140,165,255]);
  const after=await saveProject(page);expect(after.document.bitmaps).toEqual(before.document.bitmaps);expect(after.document.layerOrder).toHaveLength(2);expect(after.document.layers[after.document.layerOrder[1]].harmonization.strength).toBe(1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>pixels(page)).toEqual([180,100,65,255]);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();await page.reload();await expect.poll(()=>pixels(page)).toEqual([90,140,165,255]);
});
test('imported font files survive project save and reopen offline',async({page,context})=>{
  await page.goto('/');await page.getByRole('button',{name:'Font Extract (F)',exact:true}).click();const font=await readFile('apps/web/node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2');
  await page.getByLabel('Import font',{exact:true}).setInputFiles({name:'MyLicensedDisplay.woff2',mimeType:'font/woff2',buffer:font});await expect(page.getByText('Font imported. It is included when you save this project. Fit the line again to include it.')).toBeVisible();await page.getByRole('button',{name:'Close font matching',exact:true}).click();await page.getByRole('button',{name:'Text (T)',exact:true}).click();
  const options=await page.getByLabel('Font family',{exact:true}).locator('option').allTextContents(),imported=options.find((v)=>v.startsWith('MyLicensedDisplay-'))!;expect(imported).toBeTruthy();await page.getByLabel('Font family',{exact:true}).selectOption(imported);const project=await saveProject(page);expect(Object.values(project.document.fonts)).toHaveLength(1);await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();await page.reload();await expect.poll(()=>page.evaluate((family)=>[...document.fonts].some((face)=>face.family===family&&face.status==='loaded'),imported)).toBe(true);await context.setOffline(true);
  await page.locator('input[accept=".json,application/json"]').setInputFiles({name:'typography.pef.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();const resaved=await saveProject(page);expect(resaved.document.fonts).toEqual(project.document.fonts);expect(resaved.document.layers[resaved.document.layerOrder[0]].fontFamily).toBe(imported);
});
test('print PNG embeds density and sticker export retains all corner pixels',async({page})=>{
  await page.goto('/');const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=80;const x=c.getContext('2d')!;x.fillStyle='#e13520';x.fillRect(0,0,120,80);return c.toDataURL().split(',')[1]!;});await openRaster(page,data);await page.getByRole('button',{name:'Export',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Export image',exact:true});await modal.getByLabel('Export selected layer as a sticker',{exact:true}).check();await modal.getByLabel('Resolution (PPI)',{exact:true}).fill('300');const event=page.waitForEvent('download');await modal.getByRole('button',{name:'Export PNG',exact:true}).click();const bytes=await readFile((await(await event).path())!),density=bytes.indexOf('pHYs');expect(density).toBeGreaterThan(0);expect(bytes.readUInt32BE(density+4)).toBe(11811);
  const decoded=await page.evaluate(async(data)=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d')!;x.drawImage(img,0,0);return {width:img.width,height:img.height,corners:[[0,0],[119,0],[0,79],[119,79]].map(([a,b])=>[...x.getImageData(a!,b!,1,1).data])};},bytes.toString('base64'));expect(decoded).toEqual({width:120,height:80,corners:Array(4).fill([225,53,32,255])});
});
test('adding images preserves a configured empty canvas',async({page})=>{
  await page.goto('/');await page.getByLabel('Canvas width',{exact:true}).fill('600');await page.getByLabel('Canvas height',{exact:true}).fill('400');await page.getByRole('button',{name:'Resize canvas',exact:true}).click();
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=70;return c.toDataURL().split(',')[1]!;});await openRaster(page,data,'added.png',true);await expect(page.getByLabel('Canvas width',{exact:true})).toHaveValue('600');await expect(page.getByLabel('Canvas height',{exact:true})).toHaveValue('400');
});

test('scene matching measures and renders existing adjustments in the same order',async({page})=>{
  await page.goto('/');
  const data=async(color:string)=>page.evaluate((color)=>{const c=document.createElement('canvas');c.width=96;c.height=64;const x=c.getContext('2d')!;x.fillStyle=color;x.fillRect(0,0,96,64);return c.toDataURL().split(',')[1]!;},color);
  await openRaster(page,await data('rgb(100,140,160)'),'background.png');await openRaster(page,await data('rgb(170,90,60)'),'overlay.png',true);
  await page.getByLabel('Brightness',{exact:true}).fill('20');
  await page.getByRole('button',{name:'Match scene automatically',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Match scene',exact:true});await expect(dialog.getByRole('button',{name:'Apply scene match',exact:true})).toBeEnabled();await dialog.getByLabel('Match strength',{exact:true}).fill('100');await dialog.getByLabel('Scene edge feather',{exact:true}).fill('0');
  await page.screenshot({path:test.info().outputPath('scene-color-match.png')});
  await dialog.getByRole('button',{name:'Apply scene match',exact:true}).click();await expect.poll(()=>pixels(page)).toEqual([100,140,160,255]);
});
test('mask restoration and feathering preserve the original image',async({page})=>{
  await page.goto('/');const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=128;c.height=96;const x=c.getContext('2d')!;x.fillStyle='#278d71';x.fillRect(0,0,128,96);return c.toDataURL().split(',')[1]!;});await openRaster(page,data);
  await page.getByRole('button',{name:'Eraser (E)',exact:true}).click();const box=(await page.locator('.artboard').boundingBox())!;
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await expect.poll(async()=>(await pixels(page))[3]).toBe(0);
  await page.getByRole('button',{name:'Restore mask',exact:true}).click();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await expect.poll(()=>pixels(page)).toEqual([39,141,113,255]);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await pixels(page))[3]).toBe(0);await page.getByRole('button',{name:'Redo',exact:true}).click();
  await page.getByLabel('Edge feather (px)',{exact:true}).fill('6');await expect.poll(()=>page.getByLabel('Photo editing canvas').evaluate((c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,1,1).data[3])).toBeLessThan(240);await expect.poll(async()=>(await pixels(page))[3]).toBe(255);
});
