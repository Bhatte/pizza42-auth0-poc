export function requireVerifiedEmail(claimName) {
  return function verifiedEmailMiddleware(request, response, next) {
    if (request.auth?.payload?.[claimName] === true) {
      next();
      return;
    }

    response.status(403).json({
      error: "email_not_verified",
      message: "We just need to confirm your email before your first order.",
      remediation: "Open the link in the email we sent, then check again.",
    });
  };
}
