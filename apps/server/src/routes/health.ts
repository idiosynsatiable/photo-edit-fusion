import type { FastifyInstance } from 'fastify';

interface IntegrationStatus {
  name: string;
  enabled: boolean;
  reason?: string;
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', () => ({ status: 'ok', appVersion: '1.0.0' }));

  app.get('/api/integrations', () => {
    const statuses: IntegrationStatus[] = [
      {
        name: 'whatthefont',
        enabled: !!app.config.WHATTHEFONT_API_KEY,
        reason: app.config.WHATTHEFONT_API_KEY ? undefined : 'WHATTHEFONT_API_KEY not set',
      },
      {
        name: 'fontspring',
        enabled: !!app.config.FONTSPRING_API_KEY,
        reason: app.config.FONTSPRING_API_KEY ? undefined : 'FONTSPRING_API_KEY not set',
      },
      {
        name: 'remove-bg',
        enabled: !!app.config.REMOVE_BG_API_KEY,
        reason: app.config.REMOVE_BG_API_KEY ? undefined : 'REMOVE_BG_API_KEY not set',
      },
      { name: 'google-fonts-similarity', enabled: true },
      { name: 'local-onnx-cut', enabled: true },
    ];
    return { integrations: statuses };
  });
}
