import { loadConfig } from './config.js';
import { buildServer } from './server.js';

const cfg = loadConfig();
const app = await buildServer(cfg);

app
  .listen({ port: cfg.PEF_SERVER_PORT, host: cfg.PEF_SERVER_HOST })
  .then((addr) => app.log.info(`photo-edit-fusion server listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
