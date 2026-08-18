const CLAIM_NAMESPACE = "https://pizza42.com/";

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

function deriveCustomerProfile(orders, event) {
  const orderCount = orders.length;
  const identityProvider = event.user.identities?.[0]?.provider ?? "auth0";

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

exports.onExecutePostLogin = async (event, api) => {
  const orders = Array.isArray(event.user.app_metadata?.orders)
    ? event.user.app_metadata.orders
    : [];
  const emailVerified = event.user.email_verified === true;

  api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}email_verified`, emailVerified);
  api.accessToken.setCustomClaim(
    `${CLAIM_NAMESPACE}email_verified`,
    emailVerified,
  );
  api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}orders`, orders);
  api.idToken.setCustomClaim(
    `${CLAIM_NAMESPACE}customer_profile`,
    deriveCustomerProfile(orders, event),
  );
};
