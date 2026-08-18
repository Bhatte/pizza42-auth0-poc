import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";

import {
  CLAIM_NAMESPACE,
  CLAIMS,
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  REQUIRED_SCOPES,
} from "./config/contracts.js";
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

  // The API's front door. Anyone handed this hostname — a panel member, an
  // uptime check, a curious reviewer — will open the bare origin first, so it
  // answers with the service name and where to go rather than a 404 for a path
  // that was never meant to serve anything.
  app.get("/", (_request, response) => {
    response.status(200).json({
      service: "Pizza 42 Orders API",
      health: "/api/health",
      meta: "/api/meta",
      menu: "/api/menu",
    });
  });

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  // What this API will accept, published rather than described. Every value
  // here is already visible in any token the tenant issues or in a rejection
  // this API returns, so none of it is a secret; what it buys is that a
  // reviewer can compare the audience their token carries against the audience
  // this deployment enforces without being given a tenant dashboard login.
  app.get("/api/meta", (_request, response) => {
    response.status(200).json({
      service: "Pizza 42 Orders API",
      issuer: authConfig?.issuerBaseURL ?? null,
      audience: authConfig?.audience ?? null,
      token_signing_alg: "RS256",
      required_scopes: REQUIRED_SCOPES,
      claim_namespace: CLAIM_NAMESPACE,
      verified_email_claim: CLAIMS.emailVerified,
      verified_email_enforced_on: ["POST /api/orders"],
      currency: "EUR",
      max_line_quantity: MAX_LINE_QUANTITY,
      max_order_lines: MAX_ORDER_LINES,
    });
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
