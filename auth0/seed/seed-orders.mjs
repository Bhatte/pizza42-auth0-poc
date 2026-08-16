#!/usr/bin/env node
// Seeds a demo account's order history by placing real orders through the
// Pizza 42 API. It deliberately does not write app_metadata directly: the
// seeded history is then proof that the authorization, validation and pricing
// path works, rather than data that bypassed it.
//
//   auth0 test token -a https://api.pizza42.com -s "openid profile email create:orders read:orders"
//   PIZZA42_ACCESS_TOKEN=<token> node auth0/seed/seed-orders.mjs [apiBaseUrl]

import { readFile } from "node:fs/promises";

const accessToken = process.env.PIZZA42_ACCESS_TOKEN;
const apiBaseUrl = (
  process.argv[2] ??
  process.env.PIZZA42_API_BASE_URL ??
  "http://localhost:8080"
).replace(/\/$/, "");

if (!accessToken) {
  console.error(
    [
      "Missing PIZZA42_ACCESS_TOKEN.",
      "",
      "Get a real customer token for the account you want to seed:",
      "  auth0 test token -a https://api.pizza42.com \\",
      '    -s "openid profile email create:orders read:orders"',
      "",
      "Then re-run:",
      "  PIZZA42_ACCESS_TOKEN=<token> node auth0/seed/seed-orders.mjs " +
        apiBaseUrl,
    ].join("\n"),
  );
  process.exit(1);
}

const baskets = JSON.parse(
  await readFile(new URL("./orders-seed.json", import.meta.url), "utf8"),
);

console.log(`Seeding ${baskets.length} orders via ${apiBaseUrl}`);

let placed = 0;

for (const [index, basket] of baskets.entries()) {
  const response = await fetch(`${apiBaseUrl}/api/orders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(basket),
  });

  const body = await response.json().catch(() => ({}));

  if (response.status !== 201) {
    console.error(
      `  ${index + 1}/${baskets.length} FAILED ${response.status} ${body.error ?? ""} ${body.message ?? ""}`,
    );
    if (response.status === 403 && body.error === "email_not_verified") {
      console.error(
        "  This account must verify its email before it can place orders.",
      );
    }
    process.exit(1);
  }

  placed += 1;
  console.log(
    `  ${index + 1}/${baskets.length} ${body.id}  ${body.store}  EUR ${body.total}`,
  );

  // Orders are appended with a read-modify-write against app_metadata, so the
  // seed runs strictly in sequence rather than racing itself.
}

const history = await fetch(`${apiBaseUrl}/api/orders`, {
  headers: { authorization: `Bearer ${accessToken}` },
});
const { orders = [] } = await history.json().catch(() => ({}));

const marketing = await fetch(`${apiBaseUrl}/api/marketing/identify`, {
  method: "POST",
  headers: { authorization: `Bearer ${accessToken}` },
});
const { event } = await marketing.json().catch(() => ({}));

console.log(`\nPlaced ${placed} orders. Profile now holds ${orders.length}.`);
console.log("Derived marketing traits:");
console.log(JSON.stringify(event?.traits ?? {}, null, 2));
