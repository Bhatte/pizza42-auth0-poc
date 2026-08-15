function requireEnvironment(value, name) {
  if (!value) throw new Error(`Missing required web configuration: ${name}`);
  return value;
}

export const webConfig = Object.freeze({
  auth0Domain: requireEnvironment(
    import.meta.env.VITE_AUTH0_DOMAIN,
    "VITE_AUTH0_DOMAIN",
  ),
  auth0ClientId: requireEnvironment(
    import.meta.env.VITE_AUTH0_CLIENT_ID,
    "VITE_AUTH0_CLIENT_ID",
  ),
  auth0Audience: requireEnvironment(
    import.meta.env.VITE_AUTH0_AUDIENCE,
    "VITE_AUTH0_AUDIENCE",
  ),
  apiBaseUrl: requireEnvironment(
    import.meta.env.VITE_API_BASE_URL,
    "VITE_API_BASE_URL",
  ),
});
