#!/usr/bin/env node
// Dev launcher: starts Vite (web) on :5173 and Electron pointing at it.
import { spawn } from 'node:child_process';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..', '..', '..');

const vite = spawn('pnpm', ['--filter', '@pef/web', 'dev'], { cwd: root, stdio: 'inherit', env: process.env });

const electronEnv = { ...process.env, NODE_ENV: 'development' };
const electron = spawn('npx', ['electron', '.'], {
  cwd: path.resolve(here, '..'),
  stdio: 'inherit',
  env: electronEnv,
});

function shutdown() {
  vite.kill('SIGTERM');
  electron.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
electron.on('exit', shutdown);
