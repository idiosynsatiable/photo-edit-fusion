import { z } from 'zod';

const ConfigSchema = z.object({
  PEF_SERVER_PORT: z.coerce.number().int().positive().default(4317),
  PEF_SERVER_HOST: z.string().default('127.0.0.1'),
  PEF_DATA_DIR: z.string().default('./data'),
  PEF_CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PEF_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  PEF_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  PEF_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(26214400),
  PEF_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WHATTHEFONT_API_KEY: z.string().optional(),
  WHATTHEFONT_API_URL: z.string().default('https://www.myfonts.com/api/whatthefont/v1'),
  FONTSPRING_API_KEY: z.string().optional(),
  FONTSPRING_API_URL: z.string().default('https://www.fontspring.com/api/matcherator/v2'),
  REMOVE_BG_API_KEY: z.string().optional(),
  REMOVE_BG_API_URL: z.string().default('https://api.remove.bg/v1.0/removebg'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse(env);
}
