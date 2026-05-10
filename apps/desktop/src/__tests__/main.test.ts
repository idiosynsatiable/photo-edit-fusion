import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('desktop main', () => {
  it('main.ts exists and references contextIsolation', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf8');
    expect(src).toContain('contextIsolation: true');
    expect(src).toContain('nodeIntegration: false');
  });

  it('preload.ts exposes pefDesktop', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'preload.ts'), 'utf8');
    expect(src).toContain('exposeInMainWorld');
    expect(src).toContain('pefDesktop');
  });
});
