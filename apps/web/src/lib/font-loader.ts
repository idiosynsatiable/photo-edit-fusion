/**
 * Dynamically inject a Google Fonts <link> for a given URL. Returns a promise
 * that resolves once document.fonts.ready settles, which is the most reliable
 * proxy for the WebFont being usable in canvas measurement.
 */
const loaded = new Set<string>();

export async function loadGoogleFontByUrl(url: string): Promise<void> {
  if (loaded.has(url)) return;
  loaded.add(url);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
  if ('fonts' in document) {
    await document.fonts.ready;
  }
}
