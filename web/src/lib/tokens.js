import { jwtDecode } from "jwt-decode";

// Decoding is not verification, and this file must never be mistaken for it.
// Everything here runs in the browser purely so a reviewer can read what a
// token asserts. The API re-reads every one of these values from the signature
// it verifies itself; nothing the drawer displays is trusted by anything.

export function decodeToken(raw) {
  if (!raw) return null;
  try {
    return jwtDecode(raw);
  } catch {
    return null;
  }
}

export function audienceList(audience) {
  if (Array.isArray(audience)) return audience;
  return audience ? [audience] : [];
}

// Which of the two tokens this is, decided the way the API decides it: by
// audience. An ID token is addressed to the SPA's client ID; an access token
// for this API is addressed to the API identifier.
export function createTokenClassifier({ apiAudience, clientId }) {
  return function classify(raw) {
    const claims = decodeToken(raw);
    if (!claims) return "unreadable token";
    const audiences = audienceList(claims.aud);
    if (audiences.includes(apiAudience)) return "access token";
    if (audiences.includes(clientId)) return "ID token";
    return "bearer token";
  };
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function expiryStatus(claims, nowMs = Date.now()) {
  if (!claims?.exp) return { known: false };
  const secondsLeft = claims.exp - Math.floor(nowMs / 1000);
  return {
    known: true,
    expired: secondsLeft <= 0,
    secondsLeft,
    label: secondsLeft <= 0 ? "expired" : `${formatDuration(secondsLeft)} left`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

// Flips one character of the signature segment. The header and payload are left
// untouched, so the API cannot reject this on shape or content — it has to
// reject it on the signature, which is the whole point of sending it.
export function tamperSignature(raw) {
  const segments = String(raw ?? "").split(".");
  if (segments.length !== 3 || segments[2].length === 0) return raw;
  const signature = segments[2];
  const last = signature.slice(-1);
  return `${segments[0]}.${segments[1]}.${signature.slice(0, -1)}${last === "A" ? "B" : "A"}`;
}
