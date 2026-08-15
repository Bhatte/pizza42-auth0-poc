export function requireVerifiedEmail(claimName) {
  return function verifiedEmailMiddleware(request, response, next) {
    if (request.auth?.payload?.[claimName] === true) {
      next();
      return;
    }

    response.status(403).json({
      error: "email_not_verified",
      message: "A verified email address is required before placing an order.",
      remediation:
        "Check your inbox for the verification link, then refresh your session.",
    });
  };
}
