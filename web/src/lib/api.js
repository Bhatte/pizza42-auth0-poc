export class ApiError extends Error {
  constructor({ code, message, remediation, status }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.remediation = remediation;
    this.status = status;
  }
}

const NON_JSON_MESSAGES = {
  429: "The kitchen is busy right now. Try again in a moment.",
  502: "We could not reach the kitchen. Your basket has not been changed.",
  503: "We could not reach the kitchen. Your basket has not been changed.",
  504: "The kitchen took too long to answer. Your basket has not been changed.",
};

export function createApiClient({ baseUrl, fetch: fetchRequest = fetch }) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  async function parseResponse(response) {
    let payload;

    try {
      payload = await response.json();
    } catch {
      // Rate limiters, gateways and cold-starting platforms answer with HTML
      // or an empty body. Never surface a raw parse error to a hungry customer.
      throw new ApiError({
        code: response.ok ? "invalid_response" : "service_unavailable",
        message:
          NON_JSON_MESSAGES[response.status] ??
          "Something went wrong on our side. Your basket has not been changed.",
        remediation: "Please try again in a moment.",
        status: response.status,
      });
    }

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
    async getOrders(accessToken) {
      const response = await fetchRequest(`${normalizedBaseUrl}/api/orders`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const payload = await parseResponse(response);
      return payload.orders;
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
