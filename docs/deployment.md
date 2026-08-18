# Deployment

Two Vercel projects build from this one repository. That is the ordinary Vercel
monorepo arrangement, not a workaround: each project has its own **Root
Directory**, and Vercel builds them independently from the same commit.

| Project       | Root directory | Framework | Production URL                    |
| ------------- | -------------- | --------- | --------------------------------- |
| `pizza42-web` | `web`          | Vite      | https://pizza42.tejasbhat.com     |
| `pizza42-api` | `api`          | Express   | https://pizza42-api.tejasbhat.com |

Both are connected to `Bhatte/pizza42-auth0-poc` with production branch `main`.

## Root Directory is not optional

A CLI deploy run from inside `web/` uploads that folder as the whole project, so
it succeeds even when Root Directory is unset. A Git deploy clones the entire
repository and builds from Root Directory instead. A project that deploys
correctly by CLI with Root Directory unset will therefore build from the
repository root the moment Git is connected, and produce nothing useful.

Set Root Directory before connecting Git, not after.

## Commits must be attributable to a GitHub account

Vercel resolves the commit author's email to a GitHub account and checks that
account can access the project. An email that is not registered on the author's
GitHub account cannot be resolved, and the deployment is refused before the
build starts:

```
Vercel – pizza42-web: failure :: Deployment was blocked
Vercel – pizza42-api: failure :: GitHub couldn't verify an account for the commit
```

This is easy to hit by accident. Git on Windows synthesises an identity from the
machine account and domain when `user.email` is unset, which produced commits
authored as `<machine-account>@<windows-domain>` — an address with no GitHub account behind it.
Every such commit was blocked; manual CLI uploads kept working, which disguised
the problem as "Vercel is not deploying".

The repository is configured to use the GitHub noreply address:

```bash
git config user.email "64166046+Bhatte@users.noreply.github.com"
```

Use `--global` instead if every repository on the machine should use it.

## Environment variables

Names only; values live in the Vercel project settings and never in this
repository.

`pizza42-web` — `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`,
`VITE_AUTH0_AUDIENCE`, `VITE_API_BASE_URL`.

`pizza42-api` — `NODE_ENV`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`,
`AUTH0_ISSUER_BASE_URL`, `MGMT_CLIENT_ID`, `MGMT_CLIENT_SECRET`,
`MGMT_AUDIENCE`, `CORS_ORIGIN`.

`MGMT_CLIENT_SECRET` is the only secret. It is never exposed to the browser: no
API value carries a `VITE_` prefix, and Vite only inlines variables that do.

## The API origin is coupled to the SPA's CSP

`web/vercel.json` names the API origin literally in `connect-src`, because
Vercel does not expand environment variables inside header values. Changing
where the API is deployed means editing that policy in the same commit, or the
storefront will render perfectly and be unable to load a menu.

Read the built bundle rather than the documentation when confirming which origin
the SPA actually calls:

```bash
curl -s https://pizza42.tejasbhat.com/assets/index-*.js \
  | grep -oE "https://[a-z0-9.-]+(vercel\.app|tejasbhat\.com)" | sort -u
```

## Confirming a deployment actually shipped

A green push is not a deployment. Check the commit that is live, not the commit
that is pushed:

```bash
gh api repos/Bhatte/pizza42-auth0-poc/commits/main/status \
  --jq '.statuses[] | "\(.context): \(.state) :: \(.description)"'
curl -sI https://pizza42.tejasbhat.com | grep -i content-security-policy
```

The second command is the quickest proof the SPA is current, because the CSP
header only exists in builds from 18 August 2026 onwards.
