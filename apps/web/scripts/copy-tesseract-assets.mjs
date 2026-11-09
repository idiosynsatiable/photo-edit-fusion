import { cp, mkdir, realpath, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = join(appRoot, 'public', 'tesseract');
const tesseractRoot = await realpath(join(appRoot, 'node_modules', 'tesseract.js'));
const coreRoot = await realpath(join(tesseractRoot, 'node_modules', 'tesseract.js-core'));
const languageRoot = await realpath(join(appRoot, 'node_modules', '@tesseract.js-data', 'eng'));
const workerSource = join(tesseractRoot, 'dist', 'worker.min.js');
const coreFiles = (await readdir(coreRoot)).filter((name) => /^tesseract-core.*\\.wasm\\.js$/.test(name));

if (coreFiles.length < 4) {
  throw new Error(`Expected all four Tesseract WASM loader variants, found ${coreFiles.length}`);
}

await mkdir(join(publicRoot, 'core'), { recursive: true });
await mkdir(join(publicRoot, 'lang'), { recursive: true });
await cp(workerSource, join(publicRoot, 'worker.min.js'));
for (const file of coreFiles) await cp(join(coreRoot, file), join(publicRoot, 'core', file));
await cp(join(languageRoot, '4.0.0_best_int', 'eng.traineddata.gz'), join(publicRoot, 'lang', 'eng.traineddata.gz'));

console.log(`Bundled local OCR assets: worker, ${coreFiles.length} WASM loaders, English traineddata.`);
