import { OrderInputError } from "../domain/orders.js";
import { ManagementApiError } from "../services/management.js";

export function errorHandler(error, request, response, _next) {
  if (error.headers) {
    response.set(error.headers);
  }

  if (error.status === 401) {
    return response.status(401).json({
      error: "authentication_required",
      message: "A valid access token is required.",
    });
  }

  if (error.status === 403) {
    return response.status(403).json({
      error: "insufficient_scope",
      message: "The access token does not grant this operation.",
    });
  }

  if (error.type === "entity.parse.failed") {
    return response.status(400).json({
      error: "invalid_json",
      message: "The request body must be valid JSON.",
    });
  }

  if (error.type === "entity.too.large") {
    return response.status(413).json({
      error: "payload_too_large",
      message: "The request body exceeds the allowed size.",
    });
  }

  if (error instanceof OrderInputError && error.code === "unknown_sku") {
    return response.status(400).json({
      error: "unknown_sku",
      message: "The requested menu item is not available.",
    });
  }

  if (error instanceof OrderInputError && error.code === "invalid_order") {
    return response.status(400).json({
      error: "invalid_order",
      message: "One or more order items are invalid.",
    });
  }

  // Everything below is unexpected. Log the cause without tokens, headers or
  // request bodies so an operator can tell "Auth0 said no" from "we broke".
  console.error("[pizza42]", request.method, request.path, error.name, {
    upstreamStatus: error.upstreamStatus,
    operation: error.operation,
  });

  if (error instanceof ManagementApiError) {
    return response.status(502).json({
      error: "identity_store_unavailable",
      message: "We could not reach your Pizza 42 profile right now.",
      remediation: "Please try again in a moment.",
    });
  }

  return response.status(500).json({
    error: "internal_error",
    message: "The request could not be completed.",
  });
}
