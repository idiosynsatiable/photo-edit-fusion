import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Read a File as a data URL. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.readAsDataURL(file);
  });
}

/** Decode an image data URL to an HTMLImageElement. */
export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

function safeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, '_').trim() || 'photo-edit-fusion-export';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not prepare export'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const comma = dataUrl.indexOf(',');
      if (comma < 0) reject(new Error('Could not encode export'));
      else resolve(dataUrl.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Export through Android's native share sheet when running in Capacitor.
 * In a browser/PWA, use the standard download attribute.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const safeName = safeFilename(filename);
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await blobToBase64(blob);
      const saved = await Filesystem.writeFile({
        path: safeName,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({
        title: safeName,
        text: 'Exported from Photo Edit Fusion',
        url: saved.uri,
        dialogTitle: 'Save or share your export',
      });
      return;
    } catch {
      // Fall through to the browser download path if native sharing is unavailable.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Convert a base64 data URL fragment to a Uint8Array. */
export function dataUrlToUint8(dataUrl: string): Uint8Array {
  const i = dataUrl.indexOf(',');
  const payload = i !== -1 ? dataUrl.slice(i + 1) : dataUrl;
  const bin = atob(payload);
  const arr = new Uint8Array(bin.length);
  for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
  return arr;
}
