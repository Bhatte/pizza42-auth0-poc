import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { deriveCustomerProfile } from "../src/domain/customer-profile.js";

// The Action cannot import this module: it is deployed as a single CommonJS
// file into Auth0's editor, so the derivation is duplicated there on purpose.
// These cases are the contract both copies answer to. auth0/test runs the same
// file, so a threshold changed in one place and not the other fails CI rather
// than quietly shipping a customer whose segment depends on where it was asked.
const goldenCases = JSON.parse(
  readFileSync(
    new URL("../../fixtures/customer-profile-cases.json", import.meta.url),
    "utf8",
  ),
);

describe("customer profile golden cases", () => {
  it.each(goldenCases.map((golden) => [golden.name, golden]))(
    "%s",
    (_name, golden) => {
      expect(
        deriveCustomerProfile(golden.orders, {
          identityProvider: golden.identity_provider,
        }),
      ).toEqual(golden.expected);
    },
  );
});
