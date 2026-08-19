#!/usr/bin/env bash
#
# Wires account linking into the tenant. Automates section 6 of tenant-config.md
# and the linking lines of section 11.
#
# Creates a machine-to-machine application, grants it read:users and
# update:users, and sets its credentials as secrets on the Post-Login Action.
# The client secret is never printed and never written to disk: it lives in this
# process and goes straight to the Action.
#
#   AUTH0=/path/to/auth0.exe ./auth0/setup-account-linking.sh
#
# Requires an authenticated CLI: `auth0 login`.

set -euo pipefail

AUTH0="${AUTH0:-auth0}"
APP_NAME="Pizza 42 Account Linking"
ACTION_NAME="Pizza 42 Post-Login Claims"
CODE="$(dirname "$0")/actions/post-login.js"

DOMAIN=$("$AUTH0" tenants list --no-color --json 2>/dev/null |
  python -c "import sys,json;print(json.load(sys.stdin)[0]['name'])")
echo "tenant: $DOMAIN"

# Refuse to create a second copy. Two linking applications on one tenant is a
# credential nobody is tracking.
EXISTING=$("$AUTH0" apps list --no-color --json 2>/dev/null |
  python -c "
import sys, json
apps = json.load(sys.stdin)
print(next((a['client_id'] for a in apps if a['name'] == '''$APP_NAME'''), ''))
")

if [ -n "$EXISTING" ]; then
  echo "application already exists: $EXISTING"
  echo "delete it first if you want fresh credentials:"
  echo "  $AUTH0 apps delete $EXISTING"
  exit 1
fi

echo "creating application…"
APP=$("$AUTH0" apps create \
  --name "$APP_NAME" \
  --type m2m \
  --description "Links a verified identity into an existing verified account, from the Post-Login Action" \
  --reveal-secrets --json --no-input --no-color)

CLIENT_ID=$(printf '%s' "$APP" | python -c "import sys,json;print(json.load(sys.stdin)['client_id'])")
CLIENT_SECRET=$(printf '%s' "$APP" | python -c "import sys,json;print(json.load(sys.stdin)['client_secret'])")
echo "  client_id: $CLIENT_ID"

# update:users is broad — it can change an email, a password or a blocked flag.
# It lives here rather than on the orders service so that credential stays
# unable to touch an identity.
echo "granting read:users and update:users…"
"$AUTH0" api post client-grants --no-color --data "{
  \"client_id\": \"$CLIENT_ID\",
  \"audience\": \"https://$DOMAIN/api/v2/\",
  \"scope\": [\"read:users\", \"update:users\"]
}" >/dev/null

ACTION_ID=$("$AUTH0" actions list --no-color --json 2>/dev/null |
  python -c "
import sys, json
actions = json.load(sys.stdin)
print(next((a['id'] for a in actions if a['name'] == '''$ACTION_NAME'''), ''))
")

if [ -z "$ACTION_ID" ]; then
  echo "no action named '$ACTION_NAME' on this tenant" >&2
  exit 1
fi

echo "updating action $ACTION_ID…"
"$AUTH0" actions update "$ACTION_ID" \
  --name "$ACTION_NAME" \
  --runtime node22 \
  --code "$(cat "$CODE")" \
  --secret "MGMT_DOMAIN=$DOMAIN" \
  --secret "MGMT_CLIENT_ID=$CLIENT_ID" \
  --secret "MGMT_CLIENT_SECRET=$CLIENT_SECRET" \
  --force --no-input --no-color >/dev/null

echo "deploying…"
"$AUTH0" actions deploy "$ACTION_ID" --no-color >/dev/null

echo
echo "done. verify with:"
echo "  $AUTH0 actions show $ACTION_ID"
echo
echo "then sign in with a password account, verify its email, and sign in with"
echo "Google on the same address. Behind the counter should read"
echo "\"Email and password, Google\" under Signed in with."
