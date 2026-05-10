import type { FastifyInstance } from 'fastify';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ProjectFileV1Schema, type ApiError } from '@pef/shared';

/**
 * POST /api/projects   { name, project: ProjectFileV1 } → saves to disk
 * GET  /api/projects                                     → list saved projects
 * GET  /api/projects/:id                                 → load by id
 * DELETE /api/projects/:id                               → remove
 */
export async function projectRoutes(app: FastifyInstance): Promise<void> {
  const dir = path.resolve(app.config.PEF_DATA_DIR, 'projects');
  await fs.mkdir(dir, { recursive: true });

  app.get('/api/projects', async () => {
    const files = await fs.readdir(dir);
    const items = files.filter((f) => f.endsWith('.pef.json'));
    return {
      projects: await Promise.all(
        items.map(async (f) => {
          const stat = await fs.stat(path.join(dir, f));
          return { id: f.replace(/\.pef\.json$/, ''), modifiedAt: stat.mtime.toISOString(), bytes: stat.size };
        }),
      ),
    };
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const safe = sanitizeId(req.params.id);
    if (!safe) return reply.status(400).send(badRequest('invalid id'));
    const filePath = path.join(dir, `${safe}.pef.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = ProjectFileV1Schema.safeParse(JSON.parse(raw));
      if (!parsed.success) return reply.status(500).send(badRequest('corrupted project file'));
      return parsed.data;
    } catch {
      return reply.status(404).send(badRequest('not found'));
    }
  });

  app.post<{ Body: { id?: string; project: unknown } }>('/api/projects', async (req, reply) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || !('project' in body)) {
      return reply.status(400).send(badRequest('expected { id?, project }'));
    }
    const parsed = ProjectFileV1Schema.safeParse(body.project);
    if (!parsed.success) {
      const err: ApiError = {
        error: 'validation_error',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
      return reply.status(400).send(err);
    }
    const id = sanitizeId(body.id ?? parsed.data.document.id);
    if (!id) return reply.status(400).send(badRequest('invalid id'));
    const filePath = path.join(dir, `${id}.pef.json`);
    await fs.writeFile(filePath, JSON.stringify(parsed.data));
    return { id, ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const safe = sanitizeId(req.params.id);
    if (!safe) return reply.status(400).send(badRequest('invalid id'));
    try {
      await fs.unlink(path.join(dir, `${safe}.pef.json`));
      return { ok: true };
    } catch {
      return reply.status(404).send(badRequest('not found'));
    }
  });
}

function sanitizeId(id: string): string | null {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

function badRequest(message: string): ApiError {
  return { error: 'validation_error', details: [{ path: 'id', message }] };
}
