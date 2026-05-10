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

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
