import { useEffect, useMemo, useState } from "react";

const formatEuro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});
const EMAIL_VERIFIED_CLAIM = "https://pizza42.com/email_verified";
const ORDERS_CLAIM = "https://pizza42.com/orders";
const CUSTOMER_PROFILE_CLAIM = "https://pizza42.com/customer_profile";

function useMenu(api) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let active = true;
    api
      .getMenu()
      .then((menu) => active && setState({ status: "ready", menu }))
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, [api]);

  return state;
}

export function Pizza42App({ auth, api }) {
  if (auth.isLoading) return <LoadingScreen />;
  if (!auth.isAuthenticated) return <GuestExperience auth={auth} api={api} />;
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

function Colophon({ children }) {
  return (
    <footer className="colophon">
      <div className="colophon-shops">
        <p>Camden Street · Rathmines · Smithfield</p>
        <p>Kitchen open until 23:00</p>
      </div>
      {children}
      <p className="colophon-note">
        A build for the Auth0 technical challenge. No payment is taken and no
        pizza leaves the kitchen.
      </p>
    </footer>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true">
      <Brand />
      <div className="loading-copy">
        <span className="loading-dot" aria-hidden="true" />
        <p>Lighting the oven…</p>
      </div>
    </main>
  );
}

function MenuList({ menuState, onAdd }) {
  if (menuState.status === "error") {
    return (
      <div className="inline-error" role="alert">
        <strong>The kitchen is not answering.</strong>
        <p>Tonight&apos;s menu could not be loaded. Try again in a moment.</p>
      </div>
    );
  }

  if (menuState.status === "loading") {
    return (
      <div
        className="menu-skeleton"
        aria-live="polite"
        aria-label="Loading tonight's menu"
      >
        <p>Checking what&apos;s on tonight…</p>
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <ol className="menu-list">
      {menuState.menu.items.map((item, index) => (
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
          </div>
          <strong className="menu-price">
            {formatEuro.format(item.price)}
          </strong>
          {onAdd ? (
            <button
              className="add-button"
              type="button"
              onClick={() => onAdd(item.sku)}
              aria-label={`Add ${item.name}`}
            >
              <PlusIcon /> <span>Add</span>
            </button>
          ) : (
            <span className="menu-spacer" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

function GuestExperience({ auth, api }) {
  const menuState = useMenu(api);

  return (
    <main className="guest-shell">
      <header className="guest-header">
        <Brand />
        <button
          className="button button-quiet"
          type="button"
          onClick={() => auth.loginWithRedirect()}
        >
          Sign in
        </button>
      </header>

      <section className="guest-hero" aria-labelledby="welcome-heading">
        <div className="hero-copy">
          <p className="eyebrow">Camden Street, Dublin 2</p>
          <h1 id="welcome-heading">
            Three pizzas.
            <span> Done properly.</span>
          </h1>
          <p className="hero-intro">
            Dough proved for two days, San Marzano tomatoes, and an oven hot
            enough to finish a base in ninety seconds. Twenty minutes from your
            order to the box.
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => auth.loginWithRedirect()}
            >
              Start your order <ArrowIcon />
            </button>
            <button
              className="button button-secondary"
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
            <strong>TABLE ORDER</strong>
            <span>Margherita · Large</span>
            <span>Garlic bread</span>
            <i />
            <b>€19.00</b>
          </div>
          <p className="scene-caption">Out of the oven at 20:04</p>
        </div>
      </section>

      <section className="guest-menu" aria-labelledby="guest-menu-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tonight</p>
            <h2 id="guest-menu-heading">On the counter</h2>
          </div>
          <p className="kitchen-status">
            <span aria-hidden="true" /> Taking orders
          </p>
        </div>
        <MenuList menuState={menuState} />
      </section>

      <Colophon />
    </main>
  );
}

function OrderingExperience({ auth, api }) {
  const menuState = useMenu(api);
  const [chosenStore, setChosenStore] = useState("");
  const [basket, setBasket] = useState({});
  const [orderState, setOrderState] = useState({ status: "idle" });
  const [marketingState, setMarketingState] = useState({ status: "loading" });
  const [isVerified, setIsVerified] = useState(
    auth.idTokenClaims?.[EMAIL_VERIFIED_CLAIM] === true,
  );

  const menu = menuState.status === "ready" ? menuState.menu : null;
  // Derived, not stored: the first store is a fallback until the customer picks
  // one, so the menu arriving never has to write state from an effect.
  const store = chosenStore || menu?.stores?.[0] || "";

  const subject = auth.idTokenClaims?.sub;
  const { getAccessTokenSilently } = auth;

  useEffect(() => {
    let active = true;

    getAccessTokenSilently()
      .then((accessToken) => api.identifyCustomer(accessToken))
      .then((event) => active && setMarketingState({ status: "ready", event }))
      .catch(() => active && setMarketingState({ status: "unavailable" }));

    return () => {
      active = false;
    };
  }, [api, subject, getAccessTokenSilently]);

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
          store,
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
            {isVerified ? null : (
              <span className="verification-pill needs-verification">
                <MailIcon />
                Email not confirmed
              </span>
            )}
            <div className="account-copy">
              <span>{auth.user?.name ?? "Your account"}</span>
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
            email={auth.user?.email}
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
            ? "Email confirmed. You can place your order."
            : ""}
        </p>

        <div className="ordering-grid">
          <section className="menu-section" aria-labelledby="menu-heading">
            <div className="section-heading">
              <div>
                <label className="store-picker">
                  <span className="eyebrow">Collecting from</span>
                  <select
                    value={store}
                    onChange={(event) => setChosenStore(event.target.value)}
                  >
                    {(menu?.stores ?? []).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <h1 id="menu-heading">What are you hungry for?</h1>
              </div>
              <p className="kitchen-status">
                <span aria-hidden="true" /> Taking orders
              </p>
            </div>

            <MenuList
              menuState={menuState}
              onAdd={(sku) => changeQuantity(sku, 1)}
            />
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
                <p>Nothing on the ticket yet.</p>
                <span>Add something from the counter.</span>
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
            <button
              className="button button-primary checkout-button"
              type="button"
              disabled={
                itemCount === 0 || !store || orderState.status === "submitting"
              }
              onClick={placeOrder}
            >
              {orderState.status === "submitting"
                ? "Sending to the kitchen…"
                : `Place order · ${formatEuro.format(total)}`}
            </button>
            <div className="order-result" role="status" aria-live="polite">
              {orderState.status === "confirmed" ? (
                <p>
                  <CheckIcon /> Order {orderState.order.id} is with the kitchen.
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

        <Colophon>
          <SessionDetails
            auth={auth}
            isVerified={isVerified}
            orderHistory={orderHistory}
            customerProfile={customerProfile}
            marketingState={marketingState}
          />
        </Colophon>
      </div>
    </main>
  );
}

function VerificationNotice({ email, errorMessage, onRefresh }) {
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
        <h2 id="verification-heading">Confirm your email to order</h2>
        <p>
          {errorMessage ??
            `Browse all you like. Before your first order, open the link we sent to ${email ?? "your inbox"}.`}
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
        {isChecking ? "Checking…" : "I've confirmed it"}
      </button>
    </section>
  );
}

function OrderHistory({ orders }) {
  return (
    <section className="history-section" aria-labelledby="history-heading">
      <div className="history-intro">
        <p className="eyebrow">Your account</p>
        <h2 id="history-heading">Recent orders</h2>
      </div>
      {orders.length === 0 ? (
        <p className="history-empty">
          Nothing yet. Your first order will show up here.
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

function SessionDetails({
  auth,
  isVerified,
  orderHistory,
  customerProfile,
  marketingState,
}) {
  return (
    <details className="session-details">
      <summary>Session details</summary>
      <div className="session-content">
        <dl>
          <div>
            <dt>Account</dt>
            <dd>{auth.idTokenClaims?.sub ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Email confirmed</dt>
            <dd>{isVerified ? "Yes" : "Not yet"}</dd>
          </div>
          <div>
            <dt>Orders on file</dt>
            <dd>{orderHistory.length}</dd>
          </div>
        </dl>
        <p className="session-note">
          Sign-in is handled by Auth0. The ordering API checks the access token,
          its scope and this account&apos;s confirmation state before the
          kitchen sees anything. Token values are never shown here.
        </p>
        <div className="session-profile">
          <p className="eyebrow">
            Customer profile · simulated Segment destination
          </p>
          {marketingState.status === "unavailable" ? (
            <p className="session-note">
              Destination unavailable. Ordering is unaffected.
            </p>
          ) : null}
          <pre aria-label="Derived customer profile">
            {JSON.stringify(
              marketingState.status === "ready"
                ? marketingState.event.traits
                : customerProfile,
              null,
              2,
            )}
          </pre>
        </div>
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
