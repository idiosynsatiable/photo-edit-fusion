import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import type { Config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { fontIdRoutes } from './routes/font-id.js';
import { aiCutRoutes } from './routes/ai-cut.js';
import { projectRoutes } from './routes/project.js';

export async function buildServer(cfg: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: cfg.PEF_LOG_LEVEL,
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino/file', options: { destination: 1 } },
    },
    bodyLimit: cfg.PEF_MAX_UPLOAD_BYTES,
  });

  await app.register(cors, {
    origin: cfg.PEF_CORS_ORIGIN.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: cfg.PEF_RATE_LIMIT_MAX,
    timeWindow: cfg.PEF_RATE_LIMIT_WINDOW_MS,
  });

  await app.register(multipart, {
    limits: { fileSize: cfg.PEF_MAX_UPLOAD_BYTES, files: 1 },
  });

  app.decorate('config', cfg);

  await app.register(healthRoutes);
  await app.register(fontIdRoutes);
  await app.register(aiCutRoutes);
  await app.register(projectRoutes);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}
