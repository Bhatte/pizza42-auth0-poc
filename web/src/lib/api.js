export class ApiError extends Error {
  constructor({ code, message, remediation, status }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.remediation = remediation;
    this.status = status;
  }
}

export function createApiClient({ baseUrl, fetch: fetchRequest = fetch }) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  async function parseResponse(response) {
    const payload = await response.json();

    if (!response.ok) {
      throw new ApiError({
        code: payload.error ?? "request_failed",
        message: payload.message ?? "The request could not be completed.",
        remediation: payload.remediation,
        status: response.status,
      });
    }

    return payload;
  }

  return {
    async getMenu() {
      const response = await fetchRequest(`${normalizedBaseUrl}/api/menu`);
      return parseResponse(response);
    },
    async createOrder(order, accessToken) {
      const response = await fetchRequest(`${normalizedBaseUrl}/api/orders`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(order),
      });
      return parseResponse(response);
    },
    async identifyCustomer(accessToken) {
      const response = await fetchRequest(
        `${normalizedBaseUrl}/api/marketing/identify`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${accessToken}` },
        },
      );
      const payload = await parseResponse(response);
      return payload.event;
    },
  };
}
