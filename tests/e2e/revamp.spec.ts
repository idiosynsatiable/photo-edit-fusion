import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test.beforeEach(async ({ page }) => { page.on('dialog', (dialog) => dialog.accept()); });
async function photo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  const data = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 128, 96); ctx.fillStyle = 'rgb(220,30,40)'; ctx.fillRect(30, 20, 69, 57); return c.toDataURL().split(',')[1]!; });
  await page.locator('#open-image-input').setInputFiles({ name: 'test-photo.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await expect(page.getByText('Image properties', { exact: true })).toBeVisible();
  await expect.poll(() => page.getByLabel('Photo editing canvas').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(64, 48, 1, 1).data[0])).toBe(220);
}
test('desktop empty canvas is transparent and matches the workspace design', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make something yours.' })).toBeVisible();
  expect(await page.getByLabel('Photo editing canvas').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(0);
  await page.screenshot({ path: test.info().outputPath('editor-desktop.png') });
});
test('adding a second image keeps both layers, transforms are reversible, and reload restores them', async ({ page }) => {
  await photo(page);
  const data = await page.getByLabel('Photo editing canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL().split(',')[1]!);
  await page.locator('#add-image-input').setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select test-photo.png', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select second.png', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Rotate 90°', exact: true }).click();
  await expect(page.getByLabel('Rotation (degrees)', { exact: true })).toHaveValue('90');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Rotation (degrees)', { exact: true })).toHaveValue('0');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select second.png', exact: true })).toBeVisible();
});
test('dragging makes one undo step and crop preserves editable layers', async ({ page }) => {
  await photo(page); await page.getByRole('button', { name: 'Move (V)', exact: true }).click();
  const box = (await page.locator('.artboard').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 18, box.y + box.height / 2 + 9, { steps: 15 }); await page.mouse.up();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.locator('.history-content li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await page.getByRole('button', { name: 'Crop (C)', exact: true }).click();
  await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down(); await page.mouse.move(box.x + 80, box.y + 65, { steps: 6 }); await page.mouse.up();
  await expect(page.getByLabel('Canvas width')).toHaveValue('70');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Canvas width')).toHaveValue('128');
});
test('masks on duplicated images are isolated and projects reopen with masks', async ({ page }) => {
  await photo(page); await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate layer', exact: true }).click();
  await page.getByRole('button', { name: 'Lasso (L)', exact: true }).click();
  await page.getByRole('button', { name: 'Auto Cut', exact: true }).click();
  const cut = page.getByRole('dialog', { name: 'Background removal' });
  await cut.getByRole('button', { name: 'Run AI Cut', exact: true }).click();
  await expect(cut.getByRole('button', { name: 'Run AI Cut', exact: true })).toBeEnabled();
  await cut.getByRole('button', { name: 'Close background removal', exact: true }).click();
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Hide test-photo.png', exact: true }).click();
  await expect.poll(() => page.getByLabel('Photo editing canvas').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(0);
  await page.getByRole('button', { name: 'Hide test-photo.png copy', exact: true }).click();
  await page.getByRole('button', { name: 'Show test-photo.png', exact: true }).click();
  await expect.poll(() => page.getByLabel('Photo editing canvas').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(255);
  const save = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save Project', exact: true }).click();
  const json = await readFile((await (await save).path())!, 'utf8'), project = JSON.parse(json).document;
  expect(project.layerOrder).toHaveLength(2);
  expect(Object.values(project.layers).filter((l) => (l as { maskBitmapId: string | null }).maskBitmapId)).toHaveLength(1);
  await page.locator('input[accept=".json,application/json"]').setInputFiles({ name: 'saved.pef.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select test-photo.png copy', exact: true })).toBeVisible();
});
for (const format of ['png', 'jpeg', 'webp'] as const) {
  test(`exports a newly adjusted image as ${format} at chosen dimensions`, async ({ page }) => {
    await photo(page); await page.getByRole('button', { name: 'Mono', exact: true }).click();
    await expect.poll(() => page.getByLabel('Photo editing canvas').evaluate((c: HTMLCanvasElement) => { const p = c.getContext('2d')!.getImageData(64, 48, 1, 1).data; return Math.abs(p[0]! - p[1]!); })).toBeLessThan(2);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Export image' });
    await modal.getByLabel('Format', { exact: true }).selectOption(format); await modal.getByLabel('Width (px)', { exact: true }).fill('64');
    const event = page.waitForEvent('download'); await modal.getByRole('button', { name: `Export ${format.toUpperCase()}`, exact: true }).click();
    const bytes = await readFile((await (await event).path())!);
    const decoded = await page.evaluate(async ({ data, mime }) => { const image = new Image(); image.src = `data:${mime};base64,${data}`; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }, { data: bytes.toString('base64'), mime: `image/${format}` });
    expect(decoded).toEqual({ width: 64, height: 48 });
  });
}
test('mobile controls stay accessible without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make something yours.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('editor-mobile.png') });
  await page.getByRole('button', { name: 'Text (T)', exact: true }).click();
  await expect(page.getByLabel('Text', { exact: true })).toBeVisible();
  await page.getByLabel('Text', { exact: true }).fill('Made on my phone');
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Text — Your text', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete layer', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Text — Your text', exact: true })).toBeVisible();
});
