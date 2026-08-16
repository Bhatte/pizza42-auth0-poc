// Vercel serverless entry point. The same createApp() used by src/index.js and
// by the test suite, exported as a request handler instead of bound to a port.
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/environment.js";
import { createManagementOrdersRepository } from "../src/services/management.js";

const config = loadConfig(process.env);

export default createApp({
  authConfig: config.auth,
  allowedOrigins: config.allowedOrigins,
  ordersRepository: createManagementOrdersRepository({
    config: config.management,
  }),
});
