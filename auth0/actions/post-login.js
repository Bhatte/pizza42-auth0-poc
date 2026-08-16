const CLAIM_NAMESPACE = "https://pizza42.com/";

function mostFrequent(items, selectKey) {
  const counts = new Map();

  for (const item of items) {
    const key = selectKey(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    null
  );
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
    favourite_item: mostFrequent(items, (item) => item.name),
    favourite_store: mostFrequent(orders, (order) => order.store),
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
