# Auth0 tenant configuration

This checklist keeps tenant changes repeatable while leaving tenant identifiers and secrets out of source control. Record sanitized screenshots separately when validating the hosted path.

## 1. Register the Pizza 42 API

Create an Auth0 API with:

- name: `Pizza 42 Orders API`;
- identifier: `https://api.pizza42.com`;
- signing algorithm: `RS256`;
- permissions: `create:orders` and `read:orders`;
- RBAC enabled, with permissions included in access tokens.

Assign both permissions to the POC customer role. The Express API still checks the operation-specific scope; a successful login alone does not authorize an order.

## 2. Register the single-page application

Create an application of type **Single Page Application**. For local development, add only these exact origins:

| Setting               | Local value             |
| --------------------- | ----------------------- |
| Allowed Callback URLs | `http://localhost:5173` |
| Allowed Logout URLs   | `http://localhost:5173` |
| Allowed Web Origins   | `http://localhost:5173` |

Add the final HTTPS host as a separate exact value before deployment. Do not use wildcard origins. Copy the public domain and client ID to `web/.env`; a SPA has no client secret.

The React provider requests Authorization Code with PKCE through the Auth0 SDK, the API audience, and `openid profile email offline_access create:orders read:orders`. Refresh tokens remain in memory and should use rotation in the tenant.

## 3. Enable customer connections

Enable one database connection for email/password accounts and one Google social connection for the Pizza 42 SPA. Configure the database connection to send verification email, but do not block login for an unverified address: the orders API owns that authorization rule.

Keep self-service password reset enabled through Universal Login. Do not build an embedded credential form in the SPA. Do not automatically link social and database users based only on a matching email address.

## 4. Add the Post-Login Action

Create a Post-Login Action using [actions/post-login.js](actions/post-login.js), deploy it, and place it in the Login flow. The Action:

- writes the namespaced `email_verified` claim to ID and access tokens;
- copies `app_metadata.orders` to the ID token for the exercise;
- derives a bounded customer-profile summary for the marketing demonstration.

The full history claim is an explicit POC constraint, not the proposed production design.

## 5. Authorize the Management API client

Create a separate machine-to-machine application for the Node API and authorize it for the Auth0 Management API with only:

- `read:users`;
- `update:users_app_metadata`.

Put its client ID and secret in `api/.env`. Never expose them through Vite variables, browser code, screenshots, logs, or repository history.

## 6. Validate the hosted path

Run each case in [../docs/test-matrix.md](../docs/test-matrix.md), including direct API calls that bypass the SPA. Before sharing evidence, remove access tokens, authorization headers, tenant secrets, email addresses, and Management API responses that contain unrelated profile data.
