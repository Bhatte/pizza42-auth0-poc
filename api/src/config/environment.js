import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  AUTH0_DOMAIN: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+$/i),
  AUTH0_AUDIENCE: z.url(),
  AUTH0_ISSUER_BASE_URL: z.url(),
  MGMT_CLIENT_ID: z.string().min(1),
  MGMT_CLIENT_SECRET: z.string().min(1),
  MGMT_AUDIENCE: z.url(),
  CLAIM_NAMESPACE: z.url().default("https://pizza42.com/"),
  CORS_ORIGIN: z.string().min(1),
});

export function loadConfig(environment) {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error("Missing or invalid API environment configuration");
  }

  return {
    nodeEnvironment: result.data.NODE_ENV,
    port: result.data.PORT,
    auth: {
      audience: result.data.AUTH0_AUDIENCE,
      issuerBaseURL: result.data.AUTH0_ISSUER_BASE_URL,
    },
    management: {
      domain: result.data.AUTH0_DOMAIN,
      clientId: result.data.MGMT_CLIENT_ID,
      clientSecret: result.data.MGMT_CLIENT_SECRET,
      audience: result.data.MGMT_AUDIENCE,
    },
    claimNamespace: result.data.CLAIM_NAMESPACE,
    allowedOrigins: result.data.CORS_ORIGIN.split(",").map((origin) =>
      origin.trim(),
    ),
  };
}
