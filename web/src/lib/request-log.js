// Every call the storefront makes, recorded as it happens, so the evidence
// drawer can show the network conversation without anyone opening devtools.
//
// Token values are never kept. An entry records *which credential was
// presented* — none, the access token, the ID token — because that is the fact
// a reviewer is checking, and a log of bearer tokens is a log of credentials.

const DEFAULT_CLASSIFY = () => "bearer token";

function headerValue(headers, name) {
  if (!headers) return undefined;
  // Either a Headers instance or the plain object the API client builds.
  if (typeof headers.get === "function") return headers.get(name) ?? undefined;
  const key = Object.keys(headers).find(
    (candidate) => candidate.toLowerCase() === name,
  );
  return key ? headers[key] : undefined;
}

function pathOf(url) {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return String(url);
  }
}

export function createRequestLog({
  limit = 40,
  classify = DEFAULT_CLASSIFY,
  now = () => Date.now(),
} = {}) {
  let entries = [];
  const listeners = new Set();

  function publish(next) {
    entries = next.slice(0, limit);
    for (const listener of listeners) listener();
  }

  function credentialOf(headers) {
    const authorization = headerValue(headers, "authorization");
    if (!authorization) return "none";
    const [scheme, value] = authorization.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !value) return "non-bearer";
    return classify(value);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Stable identity between publishes, which is what useSyncExternalStore
    // needs to avoid an infinite render loop.
    getSnapshot() {
      return entries;
    },
    clear() {
      publish([]);
    },
    // The API client already accepts a `fetch`, so instrumentation composes in
    // at the edge instead of being threaded through every call site.
    instrument(fetchRequest = fetch) {
      return async function loggedFetch(url, ...rest) {
        const init = rest[0] ?? {};
        const startedAt = now();
        const started = {
          id: `${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
          at: startedAt,
          method: (init.method ?? "GET").toUpperCase(),
          path: pathOf(url),
          credential: credentialOf(init.headers),
        };

        try {
          const response = await fetchRequest(url, ...rest);
          publish([
            {
              ...started,
              status: response.status,
              ok: response.ok,
              ms: now() - startedAt,
            },
            ...entries,
          ]);
          return response;
        } catch (error) {
          // A blocked request never reaches the API, so it has no status. Say
          // that rather than inventing one; a CSP or CORS refusal looks exactly
          // like this and is worth being able to recognise on sight.
          publish([
            {
              ...started,
              status: null,
              ok: false,
              ms: now() - startedAt,
              failure: error?.name ?? "NetworkError",
            },
            ...entries,
          ]);
          throw error;
        }
      };
    },
  };
}
