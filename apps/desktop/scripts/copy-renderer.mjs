#!/usr/bin/env node
// Copy the built web renderer into the desktop bundle so Electron can load it
// at runtime via main.cjs → file://.../renderer/index.html
import { promises as fs } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const rendererSrc = path.resolve(here, '..', '..', 'web', 'dist');
const rendererDst = path.resolve(here, '..', 'renderer');

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

try {
  await fs.access(rendererSrc);
} catch {
  console.warn('[desktop] renderer build not found at', rendererSrc, '- run `pnpm --filter @pef/web build` first');
  process.exit(0);
}

await fs.rm(rendererDst, { recursive: true, force: true });
await copyDir(rendererSrc, rendererDst);
console.log('[desktop] renderer copied to', rendererDst);

// Rename main.js → main.cjs so Electron treats it as CommonJS
const distElectron = path.resolve(here, '..', 'dist-electron');
try {
  const files = await fs.readdir(distElectron);
  for (const f of files) {
    if (f.endsWith('.js')) {
      const src = path.join(distElectron, f);
      const dst = path.join(distElectron, f.replace(/\.js$/, '.cjs'));
      await fs.rename(src, dst);
    }
  }
  console.log('[desktop] renamed .js → .cjs');
} catch {
  // no compiled output yet; ignore
}
