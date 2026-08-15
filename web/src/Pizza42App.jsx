import { useEffect, useMemo, useState } from "react";

const formatEuro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});
const EMAIL_VERIFIED_CLAIM = "https://pizza42.com/email_verified";
const ORDERS_CLAIM = "https://pizza42.com/orders";
const CUSTOMER_PROFILE_CLAIM = "https://pizza42.com/customer_profile";

export function Pizza42App({ auth, api }) {
  if (auth.isLoading) return <LoadingScreen />;
  if (!auth.isAuthenticated) return <GuestExperience auth={auth} />;
  return <OrderingExperience auth={auth} api={api} />;
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Pizza 42 home">
      <span className="brand-mark" aria-hidden="true">
        42
      </span>
      <span className="brand-name">Pizza 42</span>
    </a>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true">
      <Brand />
      <div className="loading-copy">
        <span className="loading-dot" aria-hidden="true" />
        <p>Preparing your menu…</p>
      </div>
    </main>
  );
}

function GuestExperience({ auth }) {
  return (
    <main className="guest-shell">
      <header className="guest-header">
        <Brand />
        <p className="security-note">
          <ShieldIcon /> Secured with Auth0
        </p>
      </header>

      <section className="guest-hero" aria-labelledby="welcome-heading">
        <div className="hero-copy">
          <p className="eyebrow">Fast identity. Hot pizza.</p>
          <h1 id="welcome-heading">
            Your Friday night,
            <span> one less thing to think about.</span>
          </h1>
          <p className="hero-intro">
            Sign in once, choose your favourites and leave password drama to us.
            Dinner should be the complicated decision.
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => auth.loginWithRedirect()}
            >
              Sign in to order <ArrowIcon />
            </button>
            <button
              className="button button-quiet"
              type="button"
              onClick={() =>
                auth.loginWithRedirect({
                  authorizationParams: { screen_hint: "signup" },
                })
              }
            >
              Create an account
            </button>
          </div>
          <ul className="guest-promises" aria-label="Ordering benefits">
            <li>Google or email sign-in</li>
            <li>Self-service password reset</li>
            <li>Prices checked by our kitchen</li>
          </ul>
        </div>

        <div className="hero-scene" aria-hidden="true">
          <div className="pizza-illustration">
            <span className="topping topping-one" />
            <span className="topping topping-two" />
            <span className="topping topping-three" />
            <span className="basil basil-one" />
            <span className="basil basil-two" />
          </div>
          <div className="order-ticket">
            <p>CAMDEN ST · 19:42</p>
            <strong>YOUR USUAL?</strong>
            <span>Margherita · Large</span>
            <span>Garlic bread</span>
            <i />
            <b>€19.00</b>
          </div>
          <p className="scene-caption">Tonight&apos;s shortcut</p>
        </div>
      </section>

      <footer className="guest-footer">
        <p>600 kitchens across Europe</p>
        <p>Identity proof of concept · No payment is taken</p>
      </footer>
    </main>
  );
}

function OrderingExperience({ auth, api }) {
  const [menu, setMenu] = useState(null);
  const [menuError, setMenuError] = useState(false);
  const [basket, setBasket] = useState({});
  const [orderState, setOrderState] = useState({ status: "idle" });
  const [marketingState, setMarketingState] = useState({ status: "loading" });
  const [isVerified, setIsVerified] = useState(
    auth.idTokenClaims?.[EMAIL_VERIFIED_CLAIM] === true,
  );

  useEffect(() => {
    let active = true;
    api
      .getMenu()
      .then((result) => {
        if (active) setMenu(result);
      })
      .catch(() => {
        if (active) setMenuError(true);
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    let active = true;

    auth
      .getAccessTokenSilently()
      .then((accessToken) => api.identifyCustomer(accessToken))
      .then((event) => {
        if (active) setMarketingState({ status: "ready", event });
      })
      .catch(() => {
        if (active) setMarketingState({ status: "unavailable" });
      });

    return () => {
      active = false;
    };
  }, [api, auth]);

  const basketItems = useMemo(() => {
    if (!menu) return [];
    return menu.items
      .filter((item) => basket[item.sku])
      .map((item) => ({ ...item, qty: basket[item.sku] }));
  }, [basket, menu]);
  const itemCount = basketItems.reduce((sum, item) => sum + item.qty, 0);
  const total = basketItems.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );
  const orderHistory = Array.isArray(auth.idTokenClaims?.[ORDERS_CLAIM])
    ? auth.idTokenClaims[ORDERS_CLAIM]
    : [];
  const customerProfile = auth.idTokenClaims?.[CUSTOMER_PROFILE_CLAIM] ?? {};

  function changeQuantity(sku, amount) {
    setBasket((current) => {
      const nextQuantity = Math.max(0, (current[sku] ?? 0) + amount);
      const next = { ...current };
      if (nextQuantity === 0) delete next[sku];
      else next[sku] = nextQuantity;
      return next;
    });
  }

  async function placeOrder() {
    setOrderState({ status: "submitting" });
    try {
      const accessToken = await auth.getAccessTokenSilently();
      const order = await api.createOrder(
        {
          store: "Dublin Camden Street",
          items: basketItems.map(({ sku, qty }) => ({ sku, qty })),
        },
        accessToken,
      );
      setBasket({});
      setOrderState({ status: "confirmed", order });
    } catch (error) {
      if (error?.code === "email_not_verified") setIsVerified(false);
      setOrderState({ status: "error", error });
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Brand />
          <div className="account-actions">
            <span
              className={`verification-pill ${isVerified ? "is-verified" : "needs-verification"}`}
            >
              {isVerified ? <CheckIcon /> : <MailIcon />}
              {isVerified ? "Email verified" : "Email check needed"}
            </span>
            <div className="account-copy">
              <span>{auth.user?.name ?? "Pizza lover"}</span>
              <small>{auth.user?.email}</small>
            </div>
            <button className="text-button" type="button" onClick={auth.logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="app-content">
        {!isVerified ? (
          <VerificationNotice
            errorMessage={
              orderState.status === "error" &&
              orderState.error?.code === "email_not_verified"
                ? orderState.error.message
                : undefined
            }
            onRefresh={async () => {
              const verified = await auth.refreshVerification();
              setIsVerified(verified);
            }}
          />
        ) : null}

        <p className="sr-only" role="status" aria-live="polite">
          {isVerified && auth.idTokenClaims?.[EMAIL_VERIFIED_CLAIM] !== true
            ? "Email verified. You can place your order."
            : ""}
        </p>

        <div className="ordering-grid">
          <section className="menu-section" aria-labelledby="menu-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Camden Street kitchen</p>
                <h1 id="menu-heading">What are you hungry for?</h1>
              </div>
              <p className="kitchen-status">
                <span aria-hidden="true" /> Taking orders
              </p>
            </div>

            {menuError ? (
              <div className="inline-error" role="alert">
                <strong>Today&apos;s menu did not load.</strong>
                <p>Try again in a moment. Your basket has not been changed.</p>
              </div>
            ) : !menu ? (
              <MenuSkeleton />
            ) : (
              <ol className="menu-list">
                {menu.items.map((item, index) => (
                  <li key={item.sku} className="menu-row">
                    <span className="menu-number" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="menu-copy">
                      <div className="menu-title-line">
                        <h2>{item.name}</h2>
                        {item.size ? <span>{item.size}</span> : null}
                      </div>
                      <p>{item.description}</p>
                      <small>{item.category}</small>
                    </div>
                    <strong className="menu-price">
                      {formatEuro.format(item.price)}
                    </strong>
                    <button
                      className="add-button"
                      type="button"
                      onClick={() => changeQuantity(item.sku, 1)}
                      aria-label={`Add ${item.name}`}
                    >
                      <PlusIcon /> <span>Add</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <aside className="basket" aria-label="Your order">
            <div className="basket-heading">
              <div>
                <p className="eyebrow">Order ticket</p>
                <h2>Your order</h2>
              </div>
              <span>{itemCount === 1 ? "1 item" : `${itemCount} items`}</span>
            </div>

            {basketItems.length === 0 ? (
              <div className="empty-basket">
                <PizzaSliceIcon />
                <p>Your basket is waiting.</p>
                <span>Add something good from the menu.</span>
              </div>
            ) : (
              <ul className="basket-lines">
                {basketItems.map((item) => (
                  <li key={item.sku}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatEuro.format(item.price * item.qty)}</span>
                    </div>
                    <div
                      className="quantity-control"
                      aria-label={`${item.name} quantity`}
                    >
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.sku, -1)}
                        aria-label={`Remove one ${item.name}`}
                      >
                        −
                      </button>
                      <span aria-live="polite">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.sku, 1)}
                        aria-label={`Add another ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="basket-total">
              <span>Total</span>
              <strong>{formatEuro.format(total)}</strong>
            </div>
            <p className="authority-note">
              Final prices are checked by the Pizza 42 API.
            </p>
            <button
              className="button button-primary checkout-button"
              type="button"
              disabled={itemCount === 0 || orderState.status === "submitting"}
              onClick={placeOrder}
            >
              {orderState.status === "submitting"
                ? "Placing order…"
                : `Place order · ${formatEuro.format(total)}`}
            </button>
            <div className="order-result" role="status" aria-live="polite">
              {orderState.status === "confirmed" ? (
                <p>
                  <CheckIcon /> Order {orderState.order.id} is in.
                </p>
              ) : orderState.status === "error" &&
                orderState.error?.code !== "email_not_verified" ? (
                <p className="error-copy">
                  {orderState.error?.message ??
                    "Your order could not be placed. Please try again."}
                </p>
              ) : null}
            </div>
          </aside>
        </div>

        <OrderHistory orders={orderHistory} />
        <TechnicalEvidence
          auth={auth}
          isVerified={isVerified}
          orderHistory={orderHistory}
          customerProfile={customerProfile}
          marketingState={marketingState}
        />
      </div>
    </main>
  );
}

function VerificationNotice({ errorMessage, onRefresh }) {
  const [isChecking, setIsChecking] = useState(false);

  return (
    <section
      className="verification-notice"
      aria-labelledby="verification-heading"
    >
      <div className="notice-icon" aria-hidden="true">
        <MailIcon />
      </div>
      <div className="notice-copy">
        <p className="eyebrow">Email check</p>
        <h2 id="verification-heading">Verify once, then order</h2>
        <p>
          {errorMessage ??
            "You can browse now. Open the verification email from Auth0 before you place your first order."}
        </p>
      </div>
      <button
        className="button button-secondary"
        type="button"
        disabled={isChecking}
        onClick={async () => {
          setIsChecking(true);
          try {
            await onRefresh();
          } finally {
            setIsChecking(false);
          }
        }}
      >
        {isChecking ? "Checking…" : "I've verified my email"}
      </button>
    </section>
  );
}

function MenuSkeleton() {
  return (
    <div
      className="menu-skeleton"
      aria-live="polite"
      aria-label="Loading today's menu"
    >
      <p>Loading today&apos;s menu…</p>
      <span />
      <span />
      <span />
    </div>
  );
}

function OrderHistory({ orders }) {
  return (
    <section className="history-section" aria-labelledby="history-heading">
      <div className="history-intro">
        <p className="eyebrow">Account history</p>
        <h2 id="history-heading">Your recent orders</h2>
        <p>Shown from your latest ID token. Sign in again to refresh it.</p>
      </div>
      {orders.length === 0 ? (
        <p className="history-empty">
          Your first Pizza 42 order will appear here.
        </p>
      ) : (
        <ol className="history-list">
          {orders.map((order) => (
            <li key={order.id}>
              <div>
                <strong>{order.store}</strong>
                <code>{order.id}</code>
              </div>
              <span>{formatEuro.format(order.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function TechnicalEvidence({
  auth,
  isVerified,
  orderHistory,
  customerProfile,
  marketingState,
}) {
  return (
    <details className="evidence-drawer">
      <summary>
        <span>
          <ShieldIcon /> Technical evidence
        </span>
        <small>Claims, trust boundaries and simulated marketing event</small>
      </summary>
      <div className="evidence-content">
        <section aria-labelledby="id-token-heading">
          <p className="eyebrow">Authentication context</p>
          <h2 id="id-token-heading">ID token: client identity</h2>
          <p>
            Used by this browser to understand the signed-in customer. It is
            never sent to the orders API as authorization.
          </p>
          <dl>
            <div>
              <dt>Subject</dt>
              <dd>{auth.idTokenClaims?.sub ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Email verified</dt>
              <dd>{isVerified ? "true" : "false"}</dd>
            </div>
            <div>
              <dt>Order history entries</dt>
              <dd>{orderHistory.length}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="access-token-heading">
          <p className="eyebrow">Resource access</p>
          <h2 id="access-token-heading">Access token: API authorization</h2>
          <p>
            The API validates signature, issuer, audience, expiry and scope
            before applying the verified-email ordering rule.
          </p>
          <p className="token-safety">
            Raw token values are intentionally hidden.
          </p>
        </section>
        <section aria-labelledby="marketing-heading">
          <p className="eyebrow">Demo adapter</p>
          <h2 id="marketing-heading">Simulated Segment destination</h2>
          <p>
            Identity context shaped for a downstream tool. Login and checkout do
            not depend on this destination.
          </p>
          {marketingState.status === "unavailable" ? (
            <p className="token-safety">
              Simulation unavailable; ordering is unaffected.
            </p>
          ) : null}
          <pre aria-label="Simulated customer profile">
            {JSON.stringify(
              marketingState.status === "ready"
                ? marketingState.event
                : customerProfile,
              null,
              2,
            )}
          </pre>
        </section>
      </div>
    </details>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4 10 4 4 8-9" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.5 16 5v4.4c0 3.8-2.4 6.4-6 8.1-3.6-1.7-6-4.3-6-8.1V5l6-2.5Z" />
      <path d="m7 10 2 2 4-4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="m4 6 6 5 6-5" />
    </svg>
  );
}

function PizzaSliceIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 10c11-5 22-5 32 0L24 42 8 10Z" />
      <path d="M7 10c11 4 23 4 34 0" />
      <circle cx="20" cy="22" r="2.5" />
      <circle cx="29" cy="18" r="2.5" />
    </svg>
  );
}
