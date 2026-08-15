import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";

import { getPublicMenu } from "./config/menu.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errors.js";
import { createMarketingRouter } from "./routes/marketing.js";
import { createOrdersRouter } from "./routes/orders.js";
import { createInMemoryMarketingEventsRepository } from "./services/marketing-events.js";

export function createApp({
  authConfig,
  ordersRepository,
  marketingEventsRepository = createInMemoryMarketingEventsRepository(),
  allowedOrigins = [],
} = {}) {
  const app = express();
  const authMiddleware = createAuthMiddleware(authConfig);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || allowedOrigins.includes(origin));
      },
      methods: ["GET", "POST"],
      allowedHeaders: ["authorization", "content-type"],
      exposedHeaders: ["www-authenticate"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/api/menu", (_request, response) => {
    response.status(200).json(getPublicMenu());
  });

  app.use(
    "/api/orders",
    createOrdersRouter({ ...authMiddleware, ordersRepository }),
  );
  app.use(
    "/api/marketing",
    createMarketingRouter({
      ...authMiddleware,
      ordersRepository,
      marketingEventsRepository,
    }),
  );

  app.use((_request, response) => {
    response.status(404).json({
      error: "not_found",
      message: "The requested resource does not exist.",
    });
  });

  app.use(errorHandler);

  return app;
}
