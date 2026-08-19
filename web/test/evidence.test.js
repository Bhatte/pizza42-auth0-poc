import { describe, expect, it } from "vitest";

import {
  formatEuro,
  formatTimestamp,
  providerName,
} from "../src/lib/format.js";
import { decodeToken, expiryStatus } from "../src/lib/tokens.js";

const API_AUDIENCE = "https://api.pizza42.com";

function jwt(payload) {
  const encode = (value) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "RS256" })}.${encode(payload)}.AAAAsignature`;
}

describe("reading a token", () => {
  it("decodes the claims a token carries", () => {
    const claims = decodeToken(jwt({ sub: "auth0|42", aud: [API_AUDIENCE] }));

    expect(claims).toMatchObject({ sub: "auth0|42", aud: [API_AUDIENCE] });
  });

  // Decoding is display, never a decision. Anything unreadable has to come back
  // as nothing rather than as a half-populated object something might trust.
  it("returns nothing for anything that is not a readable JWT", () => {
    expect(decodeToken("not-a-jwt")).toBeNull();
    expect(decodeToken("")).toBeNull();
    expect(decodeToken(undefined)).toBeNull();
  });
});

describe("expiry", () => {
  // Counts down in the largest unit that still says something useful, so a
  // token with an hour on it does not tick a seconds counter at the reader.
  it.each([
    [7325, "2h 2m left"],
    [600, "10m 0s left"],
    [9, "9s left"],
  ])("reports %i seconds as %s", (secondsLeft, label) => {
    const nowMs = 1_760_000_000_000;
    const status = expiryStatus({ exp: nowMs / 1000 + secondsLeft }, nowMs);

    expect(status).toMatchObject({ known: true, expired: false });
    expect(status.label).toBe(label);
  });

  it("says plainly when a token has already expired", () => {
    const nowMs = 1_760_000_000_000;
    const status = expiryStatus({ exp: nowMs / 1000 - 1 }, nowMs);

    expect(status.expired).toBe(true);
    expect(status.label).toBe("expired");
  });

  it("reports an unknown expiry rather than inventing one", () => {
    expect(expiryStatus({})).toEqual({ known: false });
    expect(expiryStatus(null)).toEqual({ known: false });
  });
});

describe("formatting for a reader", () => {
  it("formats money in the currency the API prices in", () => {
    expect(formatEuro.format(22.83)).toBe("€22.83");
  });

  it("formats a timestamp, and leaves an unparseable one alone", () => {
    expect(formatTimestamp("2026-08-16T19:41:02.100Z")).toMatch(/2026/);
    expect(formatTimestamp("whenever")).toBe("whenever");
    expect(formatTimestamp(null)).toBe("—");
  });

  // A wrong provider name in an evidence panel is worse than an unfamiliar one.
  it("names known providers and shows unknown ones verbatim", () => {
    expect(providerName("google-oauth2")).toBe("Google");
    expect(providerName("auth0")).toBe("Email and password");
    expect(providerName("windowslive")).toBe("windowslive");
    expect(providerName("")).toBe("Unknown");
  });
});
