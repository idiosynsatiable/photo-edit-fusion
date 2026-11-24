import { createDocument } from '@pef/canvas-engine';
import { useEditorStore, validSize } from '../store/editor-store.js';
import { loadImage, readFileAsDataUrl, downloadBlob } from './file-utils.js';
import { loadBitmaps, renderDocument } from './render.js';
import type { Document } from '@pef/shared';

export async function importImages(files: File[], replace = false): Promise<void> {
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (!file.type.startsWith('image/')) throw new Error('Choose a PNG, JPEG, WebP or other supported image.');
      if (file.size > 40 * 1024 * 1024) throw new Error('Choose an image smaller than 40 MB.');
      const dataUrl = await readFileAsDataUrl(file), image = await loadImage(dataUrl);
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!validSize(width, height)) throw new Error('Images can be up to 8192 px per side and 16 megapixels. Resize this image before importing.');
      const state = useEditorStore.getState();
      if (i === 0 && (replace || !state.doc.layerOrder.length)) {
        const next = createDocument({ name: file.name.replace(/\.[^.]+$/, '') || 'Untitled', width, height });
        next.background = [0, 0, 0, 0]; state.applyDoc(next);
      }
      useEditorStore.getState().addImage({ bitmapId: crypto.randomUUID(), bitmapDataUrl: dataUrl, sourceWidth: width, sourceHeight: height, name: file.name });
    }
    useEditorStore.getState().fitCanvas();
  } catch (error) { useEditorStore.getState().setNotice(error instanceof Error ? error.message : 'This image could not be opened. Try PNG or JPEG.'); }
}

export async function exportImage(doc: Document, options: { format: 'png' | 'jpeg' | 'webp'; width: number; height: number; quality: number; background: string }): Promise<void> {
  if (!validSize(options.width, options.height)) throw new Error('Export dimensions must be positive, up to 16 megapixels.');
  const canvas = document.createElement('canvas'); canvas.width = options.width; canvas.height = options.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image export is unavailable.');
  const cache = new Map<string, HTMLImageElement>(); await loadBitmaps(doc, cache); await document.fonts.ready;
  ctx.scale(options.width / doc.width, options.height / doc.height);
  renderDocument({ doc, ctx, bitmapCache: cache });
  if (options.format === 'jpeg' || options.background !== 'transparent') {
    ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = options.background === 'transparent' ? '#ffffff' : options.background;
    ctx.fillRect(0, 0, doc.width, doc.height);
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Could not encode image.')), `image/${options.format}`, options.quality));
  if (blob.type !== `image/${options.format}`) throw new Error('Your device does not support this format. Choose PNG.');
  await downloadBlob(blob, `${doc.name || 'Untitled'}.${options.format === 'jpeg' ? 'jpg' : options.format}`);
}
