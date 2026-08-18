export const formatEuro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

const formatDateTime = new Intl.DateTimeFormat("en-IE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatTimestamp(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : formatDateTime.format(parsed);
}

// Auth0 subject prefixes as a customer would name them. Anything unrecognised
// is shown verbatim rather than guessed at, because a wrong provider name in an
// evidence panel is worse than an unfamiliar one.
const PROVIDER_NAMES = {
  auth0: "Email and password",
  "google-oauth2": "Google",
};

export function providerName(identifier) {
  if (!identifier) return "Unknown";
  return PROVIDER_NAMES[identifier] ?? identifier;
}
