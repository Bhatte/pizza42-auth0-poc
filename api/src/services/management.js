export function createManagementOrdersRepository({
  config,
  fetch: fetchRequest = globalThis.fetch,
  now = Date.now,
}) {
  let cachedToken;

  async function getAccessToken() {
    const currentTime = now();

    if (cachedToken && currentTime < cachedToken.refreshAt) {
      return cachedToken.value;
    }

    const response = await fetchRequest(
      `https://${config.domain}/oauth/token`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          audience: config.audience,
          grant_type: "client_credentials",
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Unable to obtain Auth0 Management API token");
    }

    const payload = await response.json();
    cachedToken = {
      value: payload.access_token,
      refreshAt: currentTime + Number(payload.expires_in) * 1000 * 0.8,
    };

    return cachedToken.value;
  }

  async function getUser(subject) {
    const accessToken = await getAccessToken();
    const response = await fetchRequest(
      `https://${config.domain}/api/v2/users/${encodeURIComponent(subject)}`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error("Unable to read Auth0 user profile");
    }

    return response.json();
  }

  return {
    async listForUser(subject) {
      const user = await getUser(subject);
      return Array.isArray(user.app_metadata?.orders)
        ? user.app_metadata.orders
        : [];
    },
    async appendForUser(subject, order) {
      const user = await getUser(subject);
      const orders = Array.isArray(user.app_metadata?.orders)
        ? user.app_metadata.orders
        : [];
      const accessToken = await getAccessToken();
      const response = await fetchRequest(
        `https://${config.domain}/api/v2/users/${encodeURIComponent(subject)}`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            app_metadata: { orders: [...orders, order] },
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Unable to update Auth0 user profile");
      }

      return order;
    },
  };
}
