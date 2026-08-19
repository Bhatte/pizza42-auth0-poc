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
