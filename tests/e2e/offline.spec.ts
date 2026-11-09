import { test, expect } from '@playwright/test';

test('production PWA reloads after app shell is cached and network is removed', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('Photo Edit Fusion Ω')).toBeVisible();
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported in this browser.');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBeTruthy();
  await expect(page.getByText('Open Image')).toBeVisible();
  const localAssets = [
    '/tesseract/worker.min.js',
    '/tesseract/core/tesseract-core.wasm.js',
    '/tesseract/lang/eng.traineddata.gz',
  ];
  for (const asset of localAssets) {
    const response = await page.evaluate(async (path) => fetch(path).then((result) => result.status), asset);
    expect(response).toBe(200);
  }
  await context.setOffline(true);
  for (const asset of localAssets) {
    const response = await page.evaluate(async (path) => fetch(path).then((result) => result.status), asset);
    expect(response).toBe(200);
  }
  await page.reload();
  await expect(page.getByText('Open Image')).toBeVisible();
  await expect(page.getByText('Text + Font Ω')).toBeVisible();
});
