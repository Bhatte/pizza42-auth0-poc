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
  trustProxy = 1,
} = {}) {
  const app = express();
  const authMiddleware = createAuthMiddleware(authConfig);

  app.disable("x-powered-by");
  // One proxy hop in front of the API (Vercel). Without this every request
  // carries the proxy address, so all customers would share a single bucket.
  app.set("trust proxy", trustProxy);
  app.use(helmet());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler(_request, response) {
        response.status(429).json({
          error: "rate_limited",
          message: "Too many requests. Please try again shortly.",
        });
      },
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
