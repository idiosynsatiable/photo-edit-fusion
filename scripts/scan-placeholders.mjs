#!/usr/bin/env node
/**
 * Fail the build if TODO/FIXME/XXX/HACK/PLACEHOLDER markers appear in source.
 * Skips this scanner itself, the docs/ directory (where action-items are
 * legitimately tracked), and the lock files.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.turbo',
  'out',
  'release',
  'coverage',
  'renderer',
  'dist-electron',
  'docs',
]);

const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.html', '.css']);

const PATTERN = /\b(TODO|FIXME|XXX|HACK|PLACEHOLDER|TBD|TBA)\b/;

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const findings = [];
let scanned = 0;
for await (const file of walk(root)) {
  const ext = path.extname(file);
  if (!TEXT_EXTS.has(ext)) continue;
  if (path.basename(file) === 'pnpm-lock.yaml' || path.basename(file) === 'package-lock.json') continue;
  if (file === fileURLToPath(import.meta.url)) continue;
  const content = await fs.readFile(file, 'utf8');
  scanned++;
  const lines = content.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    if (PATTERN.test(lines[i])) {
      findings.push({ file: path.relative(root, file), line: i + 1, snippet: lines[i].trim().slice(0, 140) });
    }
  }
}

if (findings.length) {
  console.error(`Found ${findings.length} placeholder marker(s):`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.snippet}`);
  console.error(`\nScanned ${scanned} files.`);
  process.exit(1);
}
console.log(`scan-placeholders: clean. Scanned ${scanned} files.`);
