import { cp, mkdir, realpath, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = join(appRoot, 'public', 'tesseract');
const tesseractRoot = await realpath(join(appRoot, 'node_modules', 'tesseract.js'));
const coreRoot = await realpath(join(dirname(tesseractRoot), 'tesseract.js-core'));
const languageRoot = await realpath(join(appRoot, 'node_modules', '@tesseract.js-data', 'eng'));
const workerSource = join(tesseractRoot, 'dist', 'worker.min.js');
const packageFiles = await readdir(coreRoot);
const loaderFiles = packageFiles.filter((name) => /^tesseract-core.*\.wasm\.js$/.test(name));
const coreFiles = packageFiles.filter((name) => name.startsWith('tesseract-core'));

const wasmFiles = coreFiles.filter((name) => name.endsWith('.wasm'));

if (loaderFiles.length < 4) {
  throw new Error('Expected all four Tesseract WASM loader variants, found ' + loaderFiles.length);
}
if (wasmFiles.length < 4) {
  throw new Error('Expected four Tesseract WASM binaries, found ' + wasmFiles.length);
}

await mkdir(join(publicRoot, 'core'), { recursive: true });
await mkdir(join(publicRoot, 'lang'), { recursive: true });
await cp(workerSource, join(publicRoot, 'worker.min.js'));
for (const file of coreFiles) await cp(join(coreRoot, file), join(publicRoot, 'core', file));
await writeFile(join(publicRoot, 'core', 'manifest.json'), JSON.stringify({ files: coreFiles, wasmFiles }));
const compressedLanguageData = await readFile(join(languageRoot, '4.0.0_best_int', 'eng.traineddata.gz'));
await writeFile(join(publicRoot, 'lang', 'eng.traineddata'), gunzipSync(compressedLanguageData));

console.log('Bundled local OCR assets: worker, ' + coreFiles.length + ' core files including ' + wasmFiles.length + ' WASM binaries, uncompressed English traineddata.');
