const CLAIM_NAMESPACE = "https://pizza42.com/";

// A hung Management API call must not become a hung login. Four seconds is
// generous for two round trips inside the same region and still leaves room
// inside the Action's own budget.
const MANAGEMENT_TIMEOUT_MS = 4000;

// Ranks by summed weight rather than by how many lines mention a key. Ten
// Margheritas on one order line outrank a single Garden Veg on another, which
// is what Marketing means by "most ordered". Ties keep the earliest-seen key,
// so the trait stays put across logins instead of flapping.
function highestWeighted(entries, selectKey, selectWeight = () => 1) {
  const totals = new Map();

  for (const entry of entries) {
    const key = selectKey(entry);
    if (key) totals.set(key, (totals.get(key) ?? 0) + selectWeight(entry));
  }

  return (
    [...totals.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    null
  );
}

// "Last Pizza Ordered" is a trait Pizza 42 marketing named directly. Prefer a
// pizza from the most recent order; fall back to whatever else was on it.
function headlineItem(order) {
  const items = order?.items ?? [];
  const pizza = items.find((item) => item.category === "pizza" || item.size);
  return (pizza ?? items[0])?.name ?? null;
}

function segmentFor(orderCount) {
  if (orderCount >= 10) return "Loyal Regular";
  if (orderCount >= 4) return "Returning Regular";
  if (orderCount >= 1) return "Occasional";
  return "New Customer";
}

function deriveCustomerProfile(orders, user) {
  const orderCount = orders.length;
  const identityProvider = user.identities?.[0]?.provider ?? "auth0";

  if (orderCount === 0) {
    return {
      customer_segment: segmentFor(orderCount),
      order_count: 0,
      favourite_item: null,
      favourite_store: null,
      last_item_ordered: null,
      last_order_at: null,
      average_order_value: 0,
      identity_provider: identityProvider,
    };
  }

  const items = orders.flatMap((order) => order.items ?? []);
  const total = orders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0,
  );
  const newestFirst = [...orders].sort(
    (left, right) => new Date(right.placed_at) - new Date(left.placed_at),
  );

  return {
    customer_segment: segmentFor(orderCount),
    order_count: orderCount,
    favourite_item: highestWeighted(
      items,
      (item) => item.name,
      // Orders seeded before the line schema settled may carry no qty.
      (item) => Number(item.qty) || 1,
    ),
    // A visit is one visit, however many pizzas left the oven.
    favourite_store: highestWeighted(orders, (order) => order.store),
    last_item_ordered: headlineItem(newestFirst[0]),
    last_order_at: newestFirst[0]?.placed_at ?? null,
    average_order_value: Math.round((total / orderCount) * 100) / 100,
    identity_provider: identityProvider,
  };
}

/* ------------------------------------------------------ account linking -- */

// One person who signed up with a password and later came back through Google
// has one account, not two. Auth0 will not work that out on its own, because
// two identities sharing an email address is not proof they share an owner.
//
// The proof this Action insists on is that BOTH sides have a verified email.
// Without that rule, anyone could register victim@example.com on the database
// connection, never open the verification mail, and wait: the day the real
// owner signed in with Google, the attacker's password would open their
// account. Every guard below exists to refuse rather than to guess.

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function ordersOf(user) {
  return Array.isArray(user?.app_metadata?.orders)
    ? user.app_metadata.orders
    : [];
}

function providersOf(user) {
  return (user?.identities ?? [])
    .map((identity) => identity.provider)
    .filter(Boolean);
}

// Checks that cost nothing, run before the Management API is called at all.
function linkPreflight(event) {
  // The post-login trigger also fires on refresh-token exchange. Searching
  // there would put two Management API round trips on every silent refresh the
  // SPA makes, which is most of them.
  if (event.transaction?.protocol === "oauth2-refresh-token") {
    return { search: false, reason: "refresh_exchange" };
  }
  if (event.user.email_verified !== true) {
    return { search: false, reason: "email_unverified" };
  }
  if (!normalizeEmail(event.user.email)) {
    return { search: false, reason: "no_email" };
  }
  // A user that already carries more than one identity is a primary. Auth0
  // refuses to link a primary as somebody else's secondary, so stop here
  // rather than spend two calls discovering that.
  if ((event.user.identities ?? []).length !== 1) {
    return { search: false, reason: "already_a_primary" };
  }
  return { search: true, reason: "eligible" };
}

function linkDecision(user, candidates) {
  const email = normalizeEmail(user.email);

  const matches = (candidates ?? []).filter(
    (candidate) =>
      candidate.user_id !== user.user_id &&
      candidate.email_verified === true &&
      normalizeEmail(candidate.email) === email,
  );

  if (matches.length === 0) return { link: false, reason: "no_match" };
  // Two verified accounts on one address should not exist, and if they do,
  // picking one of them is a guess. Guessing wrong merges two people.
  if (matches.length > 1) return { link: false, reason: "ambiguous" };

  return { link: true, reason: "verified_email_match", primary: matches[0] };
}

// Linking discards the secondary's metadata, so the orders have to be carried
// across first. Deduplicated by order id, oldest first, matching the order the
// API appends in.
function mergeOrders(primaryOrders, secondaryOrders) {
  const seen = new Set();
  const merged = [];

  for (const order of [...primaryOrders, ...secondaryOrders]) {
    const key = order?.id ?? JSON.stringify(order);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(order);
  }

  return merged.sort(
    (left, right) => new Date(left.placed_at) - new Date(right.placed_at),
  );
}

function createManagementApi(secrets, fetchRequest = globalThis.fetch) {
  const base = `https://${secrets.MGMT_DOMAIN}`;
  let token;

  async function send(path, init = {}) {
    if (!token) {
      const response = await fetchRequest(`${base}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: secrets.MGMT_CLIENT_ID,
          client_secret: secrets.MGMT_CLIENT_SECRET,
          audience: `${base}/api/v2/`,
          grant_type: "client_credentials",
        }),
        signal: AbortSignal.timeout(MANAGEMENT_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`management token request returned ${response.status}`);
      }
      token = (await response.json()).access_token;
    }

    const response = await fetchRequest(`${base}/api/v2${path}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(MANAGEMENT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`management ${path} returned ${response.status}`);
    }

    return response.json();
  }

  return {
    findByEmail(email) {
      return send(`/users-by-email?email=${encodeURIComponent(email)}`);
    },
    setOrders(userId, orders) {
      return send(`/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ app_metadata: { orders } }),
      });
    },
    linkIdentity(primaryUserId, { provider, userId }) {
      return send(`/users/${encodeURIComponent(primaryUserId)}/identities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, user_id: userId }),
      });
    },
  };
}

// Returns the user the session should continue as: the pre-existing primary
// when a link was made, or null when nothing was linked.
async function linkVerifiedIdentities(event, api, management) {
  const preflight = linkPreflight(event);
  if (!preflight.search) return null;

  const candidates = await management.findByEmail(
    normalizeEmail(event.user.email),
  );
  const decision = linkDecision(event.user, candidates);
  if (!decision.link) return null;

  const { primary } = decision;
  const merged = mergeOrders(ordersOf(primary), ordersOf(event.user));

  // Carry the orders over before the link, because linking is what destroys
  // the record they currently live on.
  if (merged.length !== ordersOf(primary).length) {
    await management.setOrders(primary.user_id, merged);
  }

  const separator = event.user.user_id.indexOf("|");
  await management.linkIdentity(primary.user_id, {
    provider: event.user.user_id.slice(0, separator),
    userId: event.user.user_id.slice(separator + 1),
  });

  // The identity that authenticated is now a secondary. Without this the token
  // would be issued for a user record that no longer exists.
  api.authentication.setPrimaryUser(primary.user_id);

  return {
    ...primary,
    app_metadata: { ...primary.app_metadata, orders: merged },
    identities: [
      ...(primary.identities ?? []),
      ...(event.user.identities ?? []),
    ],
  };
}

/* ------------------------------------------------------------- trigger -- */

// `deps` is a test seam. Auth0 calls this with two arguments.
exports.onExecutePostLogin = async (event, api, deps = {}) => {
  let user = event.user;

  // Linking is optional configuration. A tenant without the secrets set keeps
  // separate accounts and everything else still works.
  if (deps.management || event.secrets?.MGMT_CLIENT_ID) {
    try {
      const management =
        deps.management ?? createManagementApi(event.secrets, deps.fetch);
      const linked = await linkVerifiedIdentities(event, api, management);
      if (linked) user = linked;
    } catch (error) {
      // Never cost anyone their login over this. Two separate accounts is a
      // worse experience than one; a failed sign-in is worse than both.
      console.log(`account link skipped: ${error.message}`);
    }
  }

  const orders = ordersOf(user);
  const emailVerified = user.email_verified === true;

  api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}email_verified`, emailVerified);
  api.accessToken.setCustomClaim(
    `${CLAIM_NAMESPACE}email_verified`,
    emailVerified,
  );
  api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}orders`, orders);
  api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}identities`, [
    ...new Set(providersOf(user)),
  ]);
  api.idToken.setCustomClaim(
    `${CLAIM_NAMESPACE}customer_profile`,
    deriveCustomerProfile(orders, user),
  );
};

// Exported for the test suite. The Action itself only ever calls the trigger.
exports.__internal = { linkPreflight, linkDecision, mergeOrders };
