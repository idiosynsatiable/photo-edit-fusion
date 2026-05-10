import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildServer } from '../server.js';
import type { Config } from '../config.js';

let dataDir: string;

const cfg: Config = {
  PEF_SERVER_PORT: 0,
  PEF_SERVER_HOST: '127.0.0.1',
  PEF_DATA_DIR: '',
  PEF_CORS_ORIGIN: 'http://localhost:5173',
  PEF_RATE_LIMIT_MAX: 1000,
  PEF_RATE_LIMIT_WINDOW_MS: 60000,
  PEF_MAX_UPLOAD_BYTES: 1_000_000,
  PEF_LOG_LEVEL: 'fatal',
  WHATTHEFONT_API_URL: 'https://example.invalid/wtf',
  FONTSPRING_API_URL: 'https://example.invalid/fs',
  REMOVE_BG_API_URL: 'https://example.invalid/rb',
};

let app: Awaited<ReturnType<typeof buildServer>>;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pef-test-'));
  cfg.PEF_DATA_DIR = dataDir;
  app = await buildServer(cfg);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/health' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { status: string };
    expect(body.status).toBe('ok');
  });
});

describe('GET /api/integrations', () => {
  it('returns five integration entries with disabled-safe info', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/integrations' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { integrations: Array<{ name: string; enabled: boolean }> };
    const names = body.integrations.map((i) => i.name);
    expect(names).toContain('whatthefont');
    expect(names).toContain('fontspring');
    expect(names).toContain('remove-bg');
    expect(names).toContain('google-fonts-similarity');
    expect(names).toContain('local-onnx-cut');
    expect(body.integrations.find((i) => i.name === 'whatthefont')!.enabled).toBe(false);
    expect(body.integrations.find((i) => i.name === 'google-fonts-similarity')!.enabled).toBe(true);
  });
});

describe('POST /api/font-id', () => {
  it('falls back to local similarity when no keys are set', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/font-id',
      payload: { imageBase64: 'A'.repeat(40) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { provider: string; matches: unknown[] };
    expect(body.provider).toBe('google-fonts-similarity');
    expect(body.matches.length).toBeGreaterThan(0);
  });

  it('rejects invalid request body', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/font-id',
      payload: { imageBase64: 'a' },
    });
    expect(r.statusCode).toBe(400);
  });
});

describe('POST /api/ai-cut', () => {
  it('returns 503 integration_disabled for remove-bg when no key', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/ai-cut',
      payload: { imageBase64: 'A'.repeat(40) },
    });
    expect(r.statusCode).toBe(503);
    const body = r.json() as { error: string; integration: string };
    expect(body.error).toBe('integration_disabled');
    expect(body.integration).toBe('remove-bg');
  });

  it('delegates to local-onnx when client requests it', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/ai-cut',
      payload: { imageBase64: 'A'.repeat(40), preferProvider: 'local-onnx' },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { provider: string; delegateToClient: boolean };
    expect(body.provider).toBe('local-onnx');
    expect(body.delegateToClient).toBe(true);
  });
});

describe('Project CRUD', () => {
  it('saves, lists, fetches, and deletes a project', async () => {
    const project = {
      formatVersion: 1,
      document: {
        id: 'abc',
        name: 'Sample',
        width: 100,
        height: 100,
        layerOrder: [],
        layers: {},
        bitmaps: {},
        background: [1, 1, 1, 1],
        meta: { createdAt: 'a', modifiedAt: 'b', appVersion: '1.0.0' },
      },
    };
    const post = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { id: 'sample-1', project },
    });
    expect(post.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(list.statusCode).toBe(200);
    const listBody = list.json() as { projects: Array<{ id: string }> };
    expect(listBody.projects.find((p) => p.id === 'sample-1')).toBeTruthy();

    const get = await app.inject({ method: 'GET', url: '/api/projects/sample-1' });
    expect(get.statusCode).toBe(200);

    const del = await app.inject({ method: 'DELETE', url: '/api/projects/sample-1' });
    expect(del.statusCode).toBe(200);

    const get2 = await app.inject({ method: 'GET', url: '/api/projects/sample-1' });
    expect(get2.statusCode).toBe(404);
  });

  it('rejects invalid project id', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/projects/..%2Fetc' });
    expect([400, 404]).toContain(r.statusCode);
  });
});
