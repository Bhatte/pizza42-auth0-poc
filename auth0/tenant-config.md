# Auth0 tenant configuration

This records the tenant as it is actually configured, not as it was planned.
Every value below was read back from the Management API after the change.

Machine-to-machine client identifiers are written as placeholders. They are
not secrets, but neither are they anything a reader needs; the SPA client ID is
left in place because it is already public in the deployed bundle.
Tenant identifiers are public; secrets are never recorded here.

Tenant: `tejasbhat.eu.auth0.com` (EU region)

**Last reconciled against the live tenant: 18 August 2026.** Re-run the reads
below before a rehearsal and correct anything that disagrees. A settings change
made in the Dashboard does not announce itself here, and a reviewer who trusts
a stale line in this file forms a false belief about the running system — which
is worse than having no file at all.

```bash
auth0 api get "resource-servers"          # consent, RBAC, dialect, scopes
auth0 api get "clients?fields=..."        # callbacks, grants, refresh tokens
auth0 api get "attack-protection/brute-force-protection"
auth0 api get branding                    # needs read:branding, see §8
```

## 1. Pizza 42 Orders API

| Setting                   | Value                          |
| ------------------------- | ------------------------------ |
| Name                      | `Pizza 42 Orders API`          |
| Identifier (audience)     | `https://api.pizza42.com`      |
| Signing algorithm         | `RS256`                        |
| Permissions               | `create:orders`, `read:orders` |
| RBAC (`enforce_policies`) | **off**                        |
| Token dialect             | `access_token`                 |
| Allow offline access      | on                             |
| Skip first-party consent  | **on**                         |

RBAC is deliberately off. The use case has one API capability and no role
hierarchy, so OAuth scopes alone express "this token may place an order",
which is what the challenge asks for. With RBAC on, Auth0 narrows the `scope`
claim to permissions granted through an assigned role, so a customer who signs
up during a demo would receive a token without `create:orders` and be rejected
for the wrong reason. Introducing a second authorization model would add that
failure mode without adding customer value.

Offline access is on because the SPA requests `offline_access` for refresh
tokens.

First-party consent skipping is on, so the hosted storefront hands off to
Universal Login and back without an intervening "Pizza 42 Web is requesting
access" screen. Pizza 42 owns both the SPA and the Orders API; asking a hungry
customer to authorise the pizza shop to talk to the pizza shop is friction that
buys nothing. The setting is scoped to verifiable first-party clients, so a
genuine third-party integration would still have to prompt.

**`localhost` still shows the consent prompt**, because a localhost callback
cannot be verified as belonging to the client owner. That is a property of the
origin, not a misconfiguration. Rehearse the customer journey against
`https://pizza42.tejasbhat.com`; a demo driven from `http://localhost:5173`
will show a consent beat that no real customer sees.

## 2. Pizza 42 Web (single-page application)

| Setting               | Value                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Client ID             | `9gEcvJTrO7n76XSSCIRJ48LAYQBXQnYf`                                                         |
| Type                  | Single Page Application                                                                    |
| Grant types           | `authorization_code`, `refresh_token`                                                      |
| Token endpoint auth   | `none` — a public client holds no secret                                                   |
| Allowed Callback URLs | `http://localhost:5173`, `https://pizza42.tejasbhat.com`, `https://pizza42-web.vercel.app` |
| Allowed Logout URLs   | `http://localhost:5173`, `https://pizza42.tejasbhat.com`, `https://pizza42-web.vercel.app` |
| Allowed Web Origins   | `http://localhost:5173`, `https://pizza42.tejasbhat.com`, `https://pizza42-web.vercel.app` |

Exact origins only; no wildcards.

### Refresh tokens

Rotation is on with a **3 second leeway**. Zero leeway causes false reuse
detection when two near-simultaneous exchanges race, which the SPA can trigger
by refreshing verification state while another request is in flight. Auth0
provides the overlap window for exactly this case.

Absolute lifetime 30 days, idle lifetime 7 days.

## 3. Customer connections

| Connection                         | Strategy        | Enabled for Pizza 42 Web |
| ---------------------------------- | --------------- | ------------------------ |
| `Username-Password-Authentication` | `auth0`         | yes                      |
| `google-oauth2`                    | `google-oauth2` | yes                      |

The Google connection uses Pizza 42-owned Google OAuth credentials rather than
Auth0 development keys.

A connection that exists but is not enabled for the application will fail
login with no useful error, so both are verified through
`GET /api/v2/connections/{id}/clients` rather than assumed.

The database connection sends a verification email on signup and still permits
sign-in while `email_verified` is false. Verification is enforced by the orders
API, not by the login flow — that is the customer's stated requirement.

Self-service password reset is the standard Universal Login flow. No embedded
credential form exists in the SPA.

Social and database identities **are** linked automatically, but only when
both sides carry a verified email address. See section 4 and
[../docs/design-decisions.md](../docs/design-decisions.md).

## 4. Post-Login Action

Name: `Pizza 42 Post-Login Claims`, runtime `node22`, bound to the `post-login`
trigger. Source of truth is [actions/post-login.js](actions/post-login.js).

Deployed version 2 uses trigger contract `post-login` v3. The deployed source
matches the repository source.

The Action:

- links a second sign-in method into an existing account when both sides have a
  verified email address;
- writes the namespaced `email_verified` claim to both the ID and access token;
- copies `app_metadata.orders` into the ID token for challenge requirement 10;
- names every linked provider in a namespaced `identities` claim;
- derives a bounded customer profile for the marketing demonstration.

Everything except linking is a pure function of `event.user`. The `post-login`
trigger also runs on refresh-token exchange, so linking checks
`event.transaction.protocol` and does nothing there — otherwise every silent
token refresh the SPA makes would carry two Management API round trips. Linking
also stops before any network call when the authenticating identity is
unverified, has no email, or is already a primary.

### Secrets

Set on the Action, not in the tenant environment:

| Key                  | Value                                             |
| -------------------- | ------------------------------------------------- |
| `MGMT_DOMAIN`        | `tejasbhat.eu.auth0.com`                          |
| `MGMT_CLIENT_ID`     | Client ID of the linking application in section 6 |
| `MGMT_CLIENT_SECRET` | Its client secret                                 |

With the secrets unset the Action still runs and still issues every claim; it
simply never links, and the two accounts stay separate. That is the intended
behaviour for a tenant where linking has not been configured, and it is what
the repository's own test suite exercises.

The Action calls the Management API over `fetch` with a four-second timeout and
needs no npm dependency added in the Action editor.

### Applying it

```bash
auth0 actions update <action-id> --file actions/post-login.js
auth0 actions deploy <action-id>
```

Re-read the deployed source afterwards and confirm it matches this repository.

## 5. Pizza 42 API Service (machine to machine)

| Setting   | Value                                     |
| --------- | ----------------------------------------- |
| Client ID | `<orders-service-client-id>`              |
| Grant     | `client_credentials`                      |
| Audience  | `https://tejasbhat.eu.auth0.com/api/v2/`  |
| Scopes    | `read:users`, `update:users_app_metadata` |

Not `update:users`. The orders service can append orders and nothing else — it
cannot change an email address, a password or a blocked flag, so compromising
this credential is bounded to metadata. The cost of that choice is real: a
programmatic "resend verification email" feature needs broader permission, so
it is not built. Use Dashboard → Users → Actions → Send Verification Email.

Client ID and secret live only in the API environment. They are never exposed
through Vite variables, browser code, logs or this repository.

## 6. Pizza 42 Account Linking (machine to machine)

| Setting  | Value                                    |
| -------- | ---------------------------------------- |
| Grant    | `client_credentials`                     |
| Audience | `https://tejasbhat.eu.auth0.com/api/v2/` |
| Scopes   | `read:users`, `update:users`             |

Separate from the orders service credential on purpose. Linking identities
requires `update:users`, which is broad: it can change an email address, a
password or a blocked flag. Widening the orders service to get it would undo
the least-privilege boundary described in section 5, so the permission lives on
its own application whose secret exists only as an Action secret.

The orders service still cannot change an identity, and this credential is
never used to append an order.

## 7. Pizza 42 Demo Token Helper (machine to machine)

| Setting   | Value                           |
| --------- | ------------------------------- |
| Client ID | `<demo-token-helper-client-id>` |
| Grant     | `client_credentials`            |
| Audience  | `https://api.pizza42.com`       |
| Scopes    | `read:orders` only              |

Exists so the wrong-scope failure demonstration is deterministic: it issues a
cryptographically valid token that deliberately lacks ordering authority.

```bash
curl -s -X POST https://tejasbhat.eu.auth0.com/oauth/token \
  -H 'content-type: application/json' \
  -d '{"client_id":"<demo-token-helper-client-id>","client_secret":"<secret>","audience":"https://api.pizza42.com","grant_type":"client_credentials"}'
```

## 8. Attack protection

| Control                     | State |
| --------------------------- | ----- |
| Brute force protection      | on    |
| Suspicious IP throttling    | on    |
| Breached password detection | on    |

## 9. Universal Login branding

Universal Login is rendered by Auth0 from tenant settings, so nothing in this
repository changes it. It is applied through the Management API and read back
here.

| Setting           | Value                                            |
| ----------------- | ------------------------------------------------ |
| `page_background` | `#160e09` (`--char`)                             |
| `primary`         | `#f66a1c` (`--ember`)                            |
| `logo_url`        | `https://pizza42.tejasbhat.com/pizza42-mark.svg` |

The colors were moved off the previous service blue (`#111525` / `#ed4a22`) on
17 August 2026 when the storefront moved to the ember palette:

```bash
auth0 api patch branding --data '{"colors":{"primary":"#f66a1c","page_background":"#160e09"}}'
auth0 api get branding
```

They must match the storefront tokens `--char` and `--ember` in
[../DESIGN.md](../DESIGN.md). Update both together or the hosted login will
visibly diverge from the app it hands off to.

**The logo is a URL Auth0 fetches at render time, not an upload.** It points at
the deployed storefront, so `web/public/pizza42-mark.svg` in this repository is
the source of truth and the hosted login picks up a new mark **only after the
site is redeployed**. A stale sign-in logo therefore means the deployment is
behind, not that the tenant is misconfigured. Auth0 and the browser both cache
it, so confirm in a private window.

Reading branding requires scopes the CLI does not request by default:

```bash
auth0 login --scopes "read:branding,update:branding"
```

English login copy is:

> Sign in to order and manage your Pizza 42 account.

This text is stored under `prompts/login/custom-text/en`.

## 10. Demo data state

The tenant contained four test identities and five stored orders during live
validation. All users were deleted on 17 August 2026 at the repository owner's
request. The current baseline is zero users and zero user `app_metadata`.
Auth0 audit logs remain available according to tenant retention policy.

## 11. Recreating this tenant

```bash
auth0 login
auth0 apis create --name "Pizza 42 Orders API" --identifier https://api.pizza42.com \
  --scopes create:orders,read:orders --offline-access
auth0 apps create --name "Pizza 42 Web" --type spa \
  --callbacks http://localhost:5173,https://pizza42.tejasbhat.com \
  --logout-urls http://localhost:5173,https://pizza42.tejasbhat.com \
  --origins http://localhost:5173,https://pizza42.tejasbhat.com
auth0 apps create --name "Pizza 42 API Service" --type m2m
auth0 apps create --name "Pizza 42 Account Linking" --type m2m
auth0 actions create --name "Pizza 42 Post-Login Claims" --trigger post-login \
  --code "$(cat auth0/actions/post-login.js)"
```

Then, because these are not exposed as CLI flags:

- set `enforce_policies:false` and `token_dialect:"access_token"` on the API;
- enable both connections for the SPA via
  `PATCH /api/v2/connections/{id}/clients` with `[{"client_id":"…","status":true}]`
  — the older `enabled_clients` property on `PATCH /connections/{id}` is
  rejected by the current Management API;
- set `refresh_token.leeway` to 3 on the SPA;
- grant the orders M2M client only `read:users` and `update:users_app_metadata`;
- bind the Action to the `post-login` trigger.

Account linking is the one part of this that is scripted, because it involves a
credential that should not be copied between a terminal and a dashboard:

```bash
AUTH0=/path/to/auth0 ./auth0/setup-account-linking.sh
```

It creates the linking application, grants it `read:users` and `update:users`,
sets the three secrets on the Action and deploys. The client secret stays inside
that process — it is never printed and never written to disk.

Verify with [../docs/test-matrix.md](../docs/test-matrix.md) before claiming any
of it works.
