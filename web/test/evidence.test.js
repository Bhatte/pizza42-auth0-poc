import { describe, expect, it } from "vitest";

import {
  formatEuro,
  formatTimestamp,
  providerName,
} from "../src/lib/format.js";
import {
  audienceList,
  decodeToken,
  expiryStatus,
  formatDuration,
} from "../src/lib/tokens.js";

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

  it("reads an audience whether it arrives as a string or a list", () => {
    expect(audienceList(API_AUDIENCE)).toEqual([API_AUDIENCE]);
    expect(
      audienceList([API_AUDIENCE, "https://tenant.eu.auth0.com/userinfo"]),
    ).toHaveLength(2);
    expect(audienceList(undefined)).toEqual([]);
  });
});

describe("expiry", () => {
  it("counts down in the largest unit that still says something useful", () => {
    expect(formatDuration(7325)).toBe("2h 2m");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(9)).toBe("9s");
    expect(formatDuration(-30)).toBe("0s");
  });

  it("reports how long a token has left", () => {
    const nowMs = 1_760_000_000_000;
    const status = expiryStatus({ exp: nowMs / 1000 + 600 }, nowMs);

    expect(status).toMatchObject({ known: true, expired: false });
    expect(status.label).toBe("10m 0s left");
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
