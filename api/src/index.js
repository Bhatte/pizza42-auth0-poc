import "dotenv/config";

import { createApp } from "./app.js";
import { loadConfig } from "./config/environment.js";
import { createManagementOrdersRepository } from "./services/management.js";

const config = loadConfig(process.env);
const ordersRepository = createManagementOrdersRepository({
  config: config.management,
});
const app = createApp({
  authConfig: config.auth,
  allowedOrigins: config.allowedOrigins,
  ordersRepository,
});

const server = app.listen(config.port, () => {
  console.log(`Pizza 42 API listening on port ${config.port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}; closing HTTP server`);
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
