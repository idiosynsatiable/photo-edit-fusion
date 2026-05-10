#!/usr/bin/env node
/**
 * Fail the build if any obvious secret pattern shows up in source files.
 * Walks the repo, skips node_modules / dist / build / .git, and reports
 * matches with file:line.
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
  '.last-run.json',
]);

const TEXT_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.html',
  '.css',
  '.svg',
  '.env.example',
]);

const PATTERNS = [
  // generic key/token formats
  { name: 'AWS Access Key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS Secret Key', re: /\b(?:(?:AWS|aws)[_-]?(?:secret|SECRET)[_-]?(?:access|ACCESS)?[_-]?(?:key|KEY))[^\n]{0,80}=[^\n]{0,40}[A-Za-z0-9/+]{40}\b/ },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Stripe live key', re: /\bsk_live_[A-Za-z0-9]{20,}\b/ },
  { name: 'Stripe restricted live', re: /\brk_live_[A-Za-z0-9]{20,}\b/ },
  { name: 'GitHub PAT (classic)', re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub PAT (fine-grained)', re: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { name: 'GitLab PAT', re: /\bglpat-[A-Za-z0-9-_]{20,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: 'OpenAI key', re: /\bsk-[A-Za-z0-9]{40,}\b/ },
  { name: 'Anthropic key', re: /\bsk-ant-[A-Za-z0-9-]{20,}\b/ },
  { name: 'Twilio SID', re: /\bAC[a-f0-9]{32}\b/ },
  { name: 'Private key block', re: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/ },
  // hardcoded WhatTheFont/Fontspring/Remove.bg keys (any non-empty value)
  // ONLY in files that are NOT .env.example
  { name: 'Hardcoded WhatTheFont', re: /WHATTHEFONT_API_KEY\s*=\s*["'`][^"'`\s]+["'`]/ },
  { name: 'Hardcoded Fontspring', re: /FONTSPRING_API_KEY\s*=\s*["'`][^"'`\s]+["'`]/ },
  { name: 'Hardcoded Remove.bg', re: /REMOVE_BG_API_KEY\s*=\s*["'`][^"'`\s]+["'`]/ },
];

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let failures = 0;
let scanned = 0;
const findings = [];

for await (const file of walk(root)) {
  const ext = path.extname(file);
  if (!TEXT_EXTS.has(ext) && path.basename(file) !== '.env.example') continue;
  // skip the scanner itself
  if (file === fileURLToPath(import.meta.url)) continue;
  const content = await fs.readFile(file, 'utf8');
  scanned++;
  const lines = content.split(/\n/);
  for (const { name, re } of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const isExample = path.basename(file) === '.env.example';
        if (isExample && /API_KEY\s*=\s*$/.test(lines[i])) continue; // empty value in .env.example is OK
        findings.push({ file: path.relative(root, file), line: i + 1, pattern: name, snippet: lines[i].trim().slice(0, 120) });
        failures++;
      }
    }
  }
}

if (findings.length) {
  console.error(`Found ${findings.length} potential secret(s):`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.pattern}]  ${f.snippet}`);
  }
  console.error(`\nScanned ${scanned} files.`);
  process.exit(1);
}
console.log(`scan-secrets: clean. Scanned ${scanned} files.`);
