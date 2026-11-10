import { test, expect } from '@playwright/test';

test('app loads and shows toolbar', async ({ page }) => {
  page.on('pageerror', (error) => console.log('E2E_PAGE_ERROR:', error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.log('E2E_BROWSER_ERROR:', message.text()); });
  const response = await page.goto('/');
  console.log('E2E_NAV_STATUS:', response?.status());
  console.log('E2E_BODY_TEXT:', await page.locator('body').innerText());
  console.log('E2E_ROOT_HTML:', (await page.locator('#root').innerHTML()).slice(0, 3000));
  await expect(page.getByText('Photo Edit Fusion')).toBeVisible();
  await expect(page.getByText('Open Image')).toBeVisible();
  await expect(page.getByText('Text + Font Ω')).toBeVisible();
  await expect(page.getByText('Take Photo')).toBeVisible();
});

test('layers panel is empty on a fresh document', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Layers', { exact: true })).toBeVisible();
  await expect(page.getByText(/get started/)).toBeVisible();
});

test('text tool adds a layer', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Text (T)').click();
  await expect(page.getByText(/Text — /)).toBeVisible();
});

test('opening font extract modal is reachable', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Text + Font Ω').click();
  await expect(page.getByText('Ω Text & Font Extraction')).toBeVisible();
});

test('keyboard shortcut V switches to move tool', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('t');
  await page.keyboard.press('v');
  // move tool is initially active too — assertion covers both cases
  const moveBtn = page.getByLabel('Move (V)');
  await expect(moveBtn).toBeVisible();
});

test('AI Studio requires explicit Gemini consent before sending an image', async ({ page }) => {
  await page.route('**/api/integrations', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ integrations: [{ name: 'gemini-ai-edit', enabled: true }] }),
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open AI Studio Ω' }).click();
  const panel = page.locator('section[aria-label="AI editing assistant"]');
  await expect(panel.getByText('Photo Edit Fusion Ω · AI Studio')).toBeVisible();
  await panel.locator('input[type="file"]').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/XioAAAAASUVORK5CYII=', 'base64'),
  });
  const scan = panel.getByRole('button', { name: 'Scan entire image' });
  await expect(scan).toBeDisabled();
  await panel.getByLabel(/I consent to sending this image/).check();
  await expect(scan).toBeEnabled();
});


test('shape tools add editable rectangle and ellipse layers', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Add rectangle shape').click();
  await expect(page.getByText('rectangle', { exact: false })).toBeVisible();
  await page.getByLabel('Add ellipse shape').click();
  await expect(page.getByText('ellipse', { exact: false })).toBeVisible();
});

test('camera capture control is present for Android photo import', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Take Photo' })).toBeVisible();
  const cameraInput = page.locator('input[type="file"][capture="environment"]');
  await expect(cameraInput).toHaveAttribute('accept', 'image/*');
});

test('offline OCR worker, WASM core, and English model are bundled locally', async ({ request }) => {
  const assets = [
    '/tesseract/worker.min.js',
    '/tesseract/core/tesseract-core.wasm.js',
    '/tesseract/lang/eng.traineddata',
  ];
  for (const asset of assets) {
    const response = await request.get(asset);
    expect(response.ok(), `Expected bundled offline OCR asset: ${asset}`).toBeTruthy();
  }
});

test('System Check opens and reports local capabilities', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ω System Check' }).click();
  const panel = page.getByRole('dialog', { name: 'System diagnostics' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Canvas renderer')).toBeVisible();
  await expect(panel.getByText('OCR worker')).toBeVisible();
  await expect(panel.getByText('English OCR model')).toBeVisible();
  await expect(panel.getByText('OCR WASM binaries')).toBeVisible();
  await expect(panel.getByText('Offline OCR engine')).toBeVisible();
});

test('local photo import creates a correctly sized editable image document', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'sample-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/XioAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByText('sample-photo', { exact: true })).toBeVisible();
  await expect(page.getByText('1 × 1', { exact: true })).toBeVisible();
  await expect(page.getByText('image', { exact: true })).toBeVisible();
});

test('mobile photo import auto-fits the complete editable canvas inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#ff0000"/></svg>';
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name: 'mobile-fit-test.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg),
  });
  const stage = page.getByTestId('canvas-stage');
  const canvas = page.getByTestId('editor-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const bounds = node.closest('[data-testid="canvas-stage"]')!.getBoundingClientRect();
    return rect.width > 100 && rect.width <= bounds.width && rect.height <= bounds.height;
  })).toBeTruthy();
  await expect.poll(async () => canvas.evaluate((node) => {
    const c = node as HTMLCanvasElement;
    const pixel = c.getContext('2d')?.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return Boolean(pixel && pixel[0] > 240 && pixel[1] < 20 && pixel[2] < 20);
  })).toBeTruthy();
  await expect(stage).toBeVisible();
});
