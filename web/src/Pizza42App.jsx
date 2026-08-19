import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EvidenceDrawer } from "./EvidenceDrawer.jsx";
import { formatEuro } from "./lib/format.js";
const EMAIL_VERIFIED_CLAIM = "https://pizza42.com/email_verified";
const ORDERS_CLAIM = "https://pizza42.com/orders";
const CUSTOMER_PROFILE_CLAIM = "https://pizza42.com/customer_profile";
// Mirrors the bounded order contract in CONTEXT.md, which the API enforces in
// its request schema. Repeated here so the basket cannot build a line the
// kitchen will refuse; the API remains the boundary, this is just courtesy.
const MAX_LINE_QUANTITY = 20;

// The menu endpoint returns what the kitchen sells, not how it photographs.
// Art direction is a storefront concern, so the pairing lives here and degrades
// to a typographic tile when a SKU we have never shot turns up.
const DISH_PHOTOGRAPHY = {
  "PIZ-MARG-L": {
    file: "margherita",
    alt: "Margherita straight off the stone, blistered crust and torn basil",
  },
  "PIZ-VEG-L": {
    file: "garden-veg",
    alt: "Garden Veg cut into slices, peppers and mushroom under melted mozzarella",
  },
  "SID-GARL": {
    file: "garlic-bread",
    alt: "Garlic bread on a dark plate, butter still pooling in the crumb",
  },
};

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
      <span className="brand-lockup">
        <span className="brand-name">Pizza 42</span>
        <span className="brand-place">Wood-fired · Dublin</span>
      </span>
    </a>
  );
}

function DishPhoto({ sku, sizes, eager = false }) {
  const shot = DISH_PHOTOGRAPHY[sku];

  if (!shot) {
    return (
      <span className="dish-photo is-missing" aria-hidden="true">
        <PizzaSliceIcon />
      </span>
    );
  }

  return (
    <img
      className="dish-photo"
      src={`/img/${shot.file}-900.jpg`}
      srcSet={`/img/${shot.file}-520.jpg 520w, /img/${shot.file}-900.jpg 900w`}
      sizes={sizes}
      width="900"
      height="675"
      alt={shot.alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

function Colophon() {
  return (
    <footer className="colophon">
      <div className="colophon-shops">
        <p>Camden Street / Rathmines / Smithfield</p>
        <p>Collection until 23:00</p>
      </div>
      <p className="colophon-note">
        Pizza 42 sign-in proof of concept. No payment is taken and no order is
        sent to a kitchen.
      </p>
    </footer>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true">
      <Brand />
      <div className="loading-copy">
        <span className="loading-flame" aria-hidden="true" />
        <p>Lighting the oven…</p>
      </div>
    </main>
  );
}

function MenuList({ menuState, onAdd, layout = "showcase" }) {
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
        className={`menu-skeleton is-${layout}`}
        aria-live="polite"
        aria-label="Loading tonight's menu"
      >
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <ul className={`menu-list is-${layout}`}>
      {menuState.menu.items.map((item, index) => (
        <li key={item.sku} className="dish">
          <div className="dish-frame">
            <DishPhoto
              sku={item.sku}
              name={item.name}
              sizes={
                layout === "showcase"
                  ? "(max-width: 46rem) 92vw, (max-width: 72rem) 44vw, 24rem"
                  : "6rem"
              }
              eager={layout === "showcase" && index === 0}
            />
            {layout === "showcase" ? (
              <strong className="dish-price">
                {formatEuro.format(item.price)}
              </strong>
            ) : null}
          </div>

          <div className="dish-body">
            <h3 className="dish-name">
              {item.name}
              {item.size ? <span>{item.size}</span> : null}
            </h3>
            <p className="dish-note">{item.description}</p>
            {layout === "order" ? (
              <strong className="dish-line-price">
                {formatEuro.format(item.price)}
              </strong>
            ) : null}
          </div>

          {onAdd ? (
            <button
              className="add-button"
              type="button"
              onClick={() => onAdd(item.sku)}
              aria-label={`Add ${item.name}`}
            >
              <PlusIcon /> <span>Add</span>
            </button>
          ) : null}
        </li>
      ))}
    </ul>
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

      <section className="hero" aria-labelledby="welcome-heading">
        <picture className="hero-photo">
          <img
            src="/img/hero-1100.jpg"
            srcSet="/img/hero-700.jpg 700w, /img/hero-1100.jpg 1100w, /img/hero-1800.jpg 1800w"
            sizes="100vw"
            width="1800"
            height="1012"
            alt="A pizza on the stone at the mouth of the wood-fired oven, flame running up the wall beside it"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <span className="hero-scrim" aria-hidden="true" />
        <span className="hero-flicker" aria-hidden="true" />

        <div className="hero-copy">
          <p className="hero-open">
            <span aria-hidden="true" /> Open now, collection tonight
          </p>
          <h1 id="welcome-heading">Forty-two seconds over live fire.</h1>
          <p className="hero-intro">
            Two-day dough, San Marzano tomatoes and a stone floor held at 450°C.
            Three things on the menu, each one made properly.
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
      </section>

      <div className="service-rail">
        <span>Fired to order</span>
        <span>450°C stone</span>
        <span>Two-day dough</span>
        <span>Collection only</span>
      </div>

      <section className="guest-menu" aria-labelledby="guest-menu-heading">
        <div className="section-heading">
          <h2 id="guest-menu-heading">On tonight</h2>
          <p className="kitchen-status">
            <span aria-hidden="true" /> Taking orders
          </p>
        </div>
        <MenuList menuState={menuState} layout="showcase" />
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
  const [historyState, setHistoryState] = useState({
    status: "loading",
    orders: [],
  });
  // Bumped after a successful order. The ID token cannot answer "what have I
  // ordered?" because it was minted at login and says so; the API can.
  const [historyRevision, setHistoryRevision] = useState(0);
  const [isVerified, setIsVerified] = useState(
    auth.idTokenClaims?.[EMAIL_VERIFIED_CLAIM] === true,
  );
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const drawerToggle = useRef(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    // Sending focus back where it came from, rather than to the top of the
    // document, is the difference between a panel and a trapdoor.
    drawerToggle.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== "?") return;
      // Never steal a keystroke someone is typing into a control. There is no
      // text input in the storefront today, and this is what keeps that from
      // becoming a bug the first time there is one.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      setDrawerOpen((open) => !open);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  useEffect(() => {
    let active = true;

    getAccessTokenSilently()
      .then((accessToken) => api.getOrders(accessToken))
      .then((orders) => active && setHistoryState({ status: "ready", orders }))
      .catch(
        () => active && setHistoryState({ status: "unavailable", orders: [] }),
      );

    return () => {
      active = false;
    };
  }, [api, subject, getAccessTokenSilently, historyRevision]);

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
  // Challenge requirement 10: the order history Auth0 put in the ID token at
  // login. It is evidence, not the customer's live order list, so it is shown
  // in Behind the counter beside the API's answer rather than sold as "recent".
  const claimedOrders = Array.isArray(auth.idTokenClaims?.[ORDERS_CLAIM])
    ? auth.idTokenClaims[ORDERS_CLAIM]
    : [];
  const customerProfile = useMemo(
    () => auth.idTokenClaims?.[CUSTOMER_PROFILE_CLAIM] ?? {},
    [auth.idTokenClaims],
  );

  const insight = useMemo(
    () => ({
      claimedProfile: customerProfile,
      liveProfile:
        marketingState.status === "ready" ? marketingState.event.traits : null,
      marketingStatus: marketingState.status,
      claimedOrderCount: claimedOrders.length,
      liveOrderCount:
        historyState.status === "ready" ? historyState.orders.length : null,
      event: marketingState.status === "ready" ? marketingState.event : null,
    }),
    [customerProfile, marketingState, claimedOrders.length, historyState],
  );

  function changeQuantity(sku, amount) {
    setBasket((current) => {
      const nextQuantity = Math.min(
        MAX_LINE_QUANTITY,
        Math.max(0, (current[sku] ?? 0) + amount),
      );
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
      setHistoryRevision((revision) => revision + 1);
    } catch (error) {
      if (error?.code === "email_not_verified") setIsVerified(false);
      setOrderState({ status: "error", error });
    }
  }

  return (
    <main className={`app-shell${isDrawerOpen ? " with-drawer" : ""}`}>
      <header className="app-header">
        <div className="header-inner">
          <Brand />
          <div className="account-actions">
            <button
              className="counter-toggle"
              type="button"
              ref={drawerToggle}
              aria-expanded={isDrawerOpen}
              onClick={() => setDrawerOpen((open) => !open)}
              title="Behind the counter — press ?"
            >
              <InspectIcon />
              <span>Behind the counter</span>
            </button>
            {isVerified ? null : (
              <span className="verification-pill">
                <MailIcon />
                Confirm your email
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
              return verified;
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
              <h1 id="menu-heading">Tonight&apos;s order</h1>
              <label className="store-picker">
                <span>Collecting from</span>
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
            </div>

            <MenuList
              menuState={menuState}
              layout="order"
              onAdd={(sku) => changeQuantity(sku, 1)}
            />
          </section>

          <aside className="basket" aria-label="Your order">
            <div className="basket-heading">
              <h2>Your order</h2>
              <span>{itemCount === 1 ? "1 item" : `${itemCount} items`}</span>
            </div>

            {basketItems.length === 0 ? (
              <div className="empty-basket">
                <PizzaSliceIcon />
                <p>Nothing in your order yet.</p>
                <span>Add something from tonight&apos;s menu.</span>
              </div>
            ) : (
              <ul className="basket-lines">
                {basketItems.map((item) => (
                  <li key={item.sku}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatEuro.format(item.price * item.qty)}</span>
                      {item.qty >= MAX_LINE_QUANTITY ? (
                        <span className="line-limit">
                          Maximum {MAX_LINE_QUANTITY} per item
                        </span>
                      ) : null}
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
                        disabled={item.qty >= MAX_LINE_QUANTITY}
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

        <OrderHistory state={historyState} />

        <Colophon />
      </div>

      <EvidenceDrawer
        open={isDrawerOpen}
        onClose={closeDrawer}
        api={api}
        auth={auth}
        isVerified={isVerified}
        insight={insight}
      />
    </main>
  );
}

// Two ways the check can disappoint, and they need different words. The token
// refresh can fail, which is our problem; or it can succeed and still report an
// unverified address, which means the customer has not opened the link yet.
// Saying nothing in either case leaves the button looking broken.
const REFRESH_FEEDBACK = {
  "still-unverified":
    "We're not seeing it yet. Open the link in the email, then try again.",
  failed:
    "We could not check your account just now. Please try again in a moment.",
};

function VerificationNotice({ email, errorMessage, onRefresh }) {
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState(null);

  return (
    <section
      className="verification-notice"
      aria-labelledby="verification-heading"
    >
      <div className="notice-icon" aria-hidden="true">
        <MailIcon />
      </div>
      <div className="notice-copy">
        <h2 id="verification-heading">One step before your first order</h2>
        <p>
          {errorMessage ??
            `We've sent a confirmation link to ${email ?? "your inbox"}. Open it, then we'll get your order in.`}
        </p>
        <p className="notice-feedback" role="status" aria-live="polite">
          {feedback ? REFRESH_FEEDBACK[feedback] : ""}
        </p>
      </div>
      <button
        className="button button-secondary"
        type="button"
        disabled={isChecking}
        onClick={async () => {
          setIsChecking(true);
          setFeedback(null);
          try {
            // A truthy result unmounts this notice, so only the
            // still-unverified case needs to say anything.
            if (!(await onRefresh())) setFeedback("still-unverified");
          } catch {
            setFeedback("failed");
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

function OrderHistory({ state }) {
  return (
    <section className="history-section" aria-labelledby="history-heading">
      <h2 id="history-heading">Recent orders</h2>
      <OrderHistoryBody state={state} />
    </section>
  );
}

function OrderHistoryBody({ state }) {
  if (state.status === "loading") {
    return <p className="history-empty">Looking up your recent orders…</p>;
  }

  // The kitchen has the order; only the history read failed. Say that, rather
  // than showing an empty list that reads as "your order vanished".
  if (state.status === "unavailable") {
    return (
      <p className="history-empty">
        We could not load your recent orders just now. Anything you have ordered
        is safe.
      </p>
    );
  }

  if (state.orders.length === 0) {
    return (
      <p className="history-empty">
        Nothing yet. Your first order will show up here.
      </p>
    );
  }

  return (
    <ol className="history-list">
      {state.orders.map((order) => (
        <li key={order.id}>
          <div>
            <strong>{order.store}</strong>
            <code>{order.id}</code>
          </div>
          <span>{formatEuro.format(order.total)}</span>
        </li>
      ))}
    </ol>
  );
}

function InspectIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M12.5 3.5v13" />
    </svg>
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
