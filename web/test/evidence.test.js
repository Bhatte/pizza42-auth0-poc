import { describe, expect, it, vi } from "vitest";

import { PROBES, curlFor, isAvailable, runProbe } from "../src/lib/probes.js";
import { createRequestLog } from "../src/lib/request-log.js";
import { createTokenClassifier, tamperSignature } from "../src/lib/tokens.js";

const API_AUDIENCE = "https://api.pizza42.com";
const CLIENT_ID = "sTdY6qgVpN2mKcR8wZ0hLb4XeF7uJ1nA";

function jwt(payload) {
  const encode = (value) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "RS256" })}.${encode(payload)}.AAAAsignature`;
}

const ACCESS_TOKEN = jwt({ sub: "auth0|42", aud: [API_AUDIENCE], exp: 1 });
const ID_TOKEN = jwt({ sub: "auth0|42", aud: CLIENT_ID, exp: 1 });

const classify = createTokenClassifier({
  apiAudience: API_AUDIENCE,
  clientId: CLIENT_ID,
});

describe("token inspection", () => {
  it("names each token by the audience it is addressed to", () => {
    expect(classify(ACCESS_TOKEN)).toBe("access token");
    expect(classify(ID_TOKEN)).toBe("ID token");
    expect(classify(jwt({ aud: "https://elsewhere.example" }))).toBe(
      "bearer token",
    );
    expect(classify("not-a-jwt")).toBe("unreadable token");
  });

  it("tampers with the signature and nothing else", () => {
    const tampered = tamperSignature(ACCESS_TOKEN);

    const [header, payload, signature] = ACCESS_TOKEN.split(".");
    const [tamperedHeader, tamperedPayload, tamperedSignature] =
      tampered.split(".");

    expect(tamperedHeader).toBe(header);
    expect(tamperedPayload).toBe(payload);
    expect(tamperedSignature).not.toBe(signature);
    expect(tamperedSignature).toHaveLength(signature.length);
  });

  it("leaves a token that is not a JWT alone rather than corrupting it", () => {
    expect(tamperSignature("opaque")).toBe("opaque");
  });
});

describe("request log", () => {
  it("records which credential was presented and never the credential", async () => {
    const log = createRequestLog({ classify });
    const fetchRequest = vi.fn().mockResolvedValue(new Response("{}"));
    const request = log.instrument(fetchRequest);

    await request("https://api.pizza42.example/api/orders", {
      headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    const [entry] = log.getSnapshot();
    expect(entry).toMatchObject({
      method: "GET",
      path: "/api/orders",
      credential: "access token",
      status: 200,
    });
    expect(JSON.stringify(log.getSnapshot())).not.toContain(ACCESS_TOKEN);
  });

  it("reports an anonymous call as carrying nothing", async () => {
    const log = createRequestLog({ classify });
    const request = log.instrument(
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );

    await request("https://api.pizza42.example/api/orders");

    expect(log.getSnapshot()[0]).toMatchObject({
      credential: "none",
      status: 401,
    });
  });

  // A wrapper that turned fetch(url) into fetch(url, {}) would have changed the
  // client's observable behaviour to buy nothing.
  it("forwards the caller's arguments unchanged", async () => {
    const fetchRequest = vi.fn().mockResolvedValue(new Response("{}"));
    const request = createRequestLog().instrument(fetchRequest);

    await request("https://api.pizza42.example/api/menu");

    expect(fetchRequest).toHaveBeenCalledWith(
      "https://api.pizza42.example/api/menu",
    );
  });

  it("records a request that never reached the API, then rethrows", async () => {
    const log = createRequestLog();
    const request = log.instrument(
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(
      request("https://api.pizza42.example/api/menu"),
    ).rejects.toThrow("Failed to fetch");
    expect(log.getSnapshot()[0]).toMatchObject({
      status: null,
      failure: "TypeError",
    });
  });

  it("keeps the newest calls and discards the rest", async () => {
    const log = createRequestLog({ limit: 2 });
    const request = log.instrument(
      vi.fn().mockResolvedValue(new Response("{}")),
    );

    for (const path of ["/a", "/b", "/c"]) {
      await request(`https://api.pizza42.example${path}`);
    }

    expect(log.getSnapshot().map((entry) => entry.path)).toEqual(["/c", "/b"]);
  });
});

describe("probes", () => {
  it("offers the unverified probe only while the account is unverified", () => {
    const probe = PROBES.find(
      (candidate) => candidate.id === "unverified-order",
    );

    expect(isAvailable(probe, { verified: false })).toBe(true);
    expect(isAvailable(probe, { verified: true })).toBe(false);
  });

  // The command is meant to be projected onto a wall.
  it("never puts a token value in the command it prints", () => {
    for (const probe of PROBES) {
      const command = curlFor(probe, "Dublin Camden Street");
      expect(command).not.toContain(ACCESS_TOKEN);
      expect(command).not.toContain(ID_TOKEN);
      if (probe.credential) expect(command).toContain("$");
    }
  });

  it("presents the ID token when the probe is about the ID token", async () => {
    const probe = PROBES.find(
      (candidate) => candidate.id === "id-token-as-credential",
    );
    const fetchRequest = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "authentication_required" }), {
        status: 401,
      }),
    );

    const result = await runProbe(probe, {
      baseUrl: "https://api.pizza42.example",
      accessToken: ACCESS_TOKEN,
      idToken: ID_TOKEN,
      store: "Dublin Camden Street",
      fetchRequest,
    });

    expect(fetchRequest.mock.calls[0][1].headers.authorization).toBe(
      `Bearer ${ID_TOKEN}`,
    );
    expect(result).toMatchObject({ status: 401, matched: true });
  });

  it("reports a probe as unexpected when the API does not refuse it", async () => {
    const probe = PROBES.find((candidate) => candidate.id === "unknown-item");
    const fetchRequest = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "ord_1" }), { status: 201 }),
      );

    const result = await runProbe(probe, {
      baseUrl: "https://api.pizza42.example",
      accessToken: ACCESS_TOKEN,
      idToken: ID_TOKEN,
      store: "Dublin Camden Street",
      fetchRequest,
    });

    expect(result.matched).toBe(false);
  });

  it("survives an API that answers a probe with HTML", async () => {
    const probe = PROBES[0];
    const fetchRequest = vi
      .fn()
      .mockResolvedValue(new Response("<html>429</html>", { status: 429 }));

    const result = await runProbe(probe, {
      baseUrl: "https://api.pizza42.example",
      accessToken: ACCESS_TOKEN,
      idToken: ID_TOKEN,
      store: "Dublin Camden Street",
      fetchRequest,
    });

    expect(result.matched).toBe(false);
    expect(result.body.note).toMatch(/not JSON/i);
  });
});
