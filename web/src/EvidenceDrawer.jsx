import { useEffect, useRef, useState } from "react";

import { formatEuro, formatTimestamp, providerName } from "./lib/format.js";
import { decodeToken, expiryStatus } from "./lib/tokens.js";

// Behind the counter: the session and the derived marketing profile, read from
// the live tenant and the live API, beside the order they describe. It is
// deliberately not part of the customer journey — a hungry person ordering a
// pizza never opens this — but it lives in the same page as the journey so the
// two can be looked at together rather than alternately.

const TABS = [
  { id: "session", label: "Session" },
  { id: "insight", label: "Insight" },
];

const EMAIL_VERIFIED_CLAIM = "https://pizza42.com/email_verified";
const ORDERS_CLAIM = "https://pizza42.com/orders";
const CUSTOMER_PROFILE_CLAIM = "https://pizza42.com/customer_profile";

export function EvidenceDrawer({ open, onClose, auth, isVerified, insight }) {
  const [tab, setTab] = useState("session");
  const [tokens, setTokens] = useState({ status: "loading" });
  const panelRef = useRef(null);

  // Re-read on every open. The access token changes when the customer confirms
  // their email, and a stale copy here would misreport the one claim this whole
  // panel exists to show honestly.
  useEffect(() => {
    if (!open) return undefined;
    let active = true;

    auth
      .getRawTokens()
      .then((raw) => active && setTokens({ status: "ready", ...raw }))
      .catch(() => active && setTokens({ status: "error" }));

    return () => {
      active = false;
    };
  }, [open, auth]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <aside
      className="drawer"
      ref={panelRef}
      tabIndex={-1}
      aria-label="Behind the counter"
    >
      <header className="drawer-header">
        <h2>Behind the counter</h2>
        <button
          className="drawer-close"
          type="button"
          onClick={onClose}
          aria-label="Close behind the counter"
        >
          <CloseIcon />
        </button>
      </header>

      <TabList tab={tab} onChange={setTab} />

      <div
        className="drawer-body"
        id={`drawer-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`drawer-tab-${tab}`}
      >
        {tab === "session" ? (
          <SessionTab
            tokens={tokens}
            idTokenClaims={auth.idTokenClaims}
            isVerified={isVerified}
          />
        ) : null}
        {tab === "insight" ? <InsightTab insight={insight} /> : null}
      </div>
    </aside>
  );
}

function TabList({ tab, onChange }) {
  const refs = useRef([]);

  // Arrow keys move between tabs, which is what a tablist promises the moment
  // it claims the role. Without this the roles are a lie told to a screen
  // reader.
  function onKeyDown(event) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = TABS.findIndex((candidate) => candidate.id === tab);
    const next = TABS[(index + step + TABS.length) % TABS.length];
    onChange(next.id);
    refs.current[TABS.indexOf(next)]?.focus();
  }

  return (
    <div className="drawer-tabs" role="tablist">
      {TABS.map((candidate, index) => (
        <button
          key={candidate.id}
          id={`drawer-tab-${candidate.id}`}
          ref={(node) => {
            refs.current[index] = node;
          }}
          role="tab"
          type="button"
          aria-selected={candidate.id === tab}
          aria-controls={`drawer-panel-${candidate.id}`}
          tabIndex={candidate.id === tab ? 0 : -1}
          className={candidate.id === tab ? "is-current" : undefined}
          onClick={() => onChange(candidate.id)}
          onKeyDown={onKeyDown}
        >
          {candidate.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Session -- */

const CLAIM_ROWS = [
  { key: "iss", label: "Issuer" },
  { key: "aud", label: "Audience" },
  { key: "exp", label: "Expires" },
  { key: "scope", label: "Scope" },
  { key: EMAIL_VERIFIED_CLAIM, label: "Email confirmed" },
  { key: ORDERS_CLAIM, label: "Order history" },
  { key: CUSTOMER_PROFILE_CLAIM, label: "Customer profile" },
];

function SessionTab({ tokens, idTokenClaims, isVerified }) {
  const nowMs = useNow(1000);

  if (tokens.status === "loading") {
    return <p className="drawer-note">Reading the current session…</p>;
  }

  if (tokens.status === "error") {
    return (
      <p className="drawer-note">
        The session could not be read. Sign in again and reopen this panel.
      </p>
    );
  }

  const accessClaims = decodeToken(tokens.accessToken);
  const idClaims = decodeToken(tokens.idToken) ?? idTokenClaims ?? {};

  return (
    <>
      <section className="drawer-section">
        <h3>Who is signed in</h3>
        <dl className="drawer-facts">
          <div>
            <dt>Subject</dt>
            <dd>
              <code>{idClaims.sub ?? "—"}</code>
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{idClaims.email ?? "—"}</dd>
          </div>
          <div>
            <dt>Signed in with</dt>
            <dd>{providerName(String(idClaims.sub ?? "").split("|")[0])}</dd>
          </div>
          <div>
            <dt>Email confirmed</dt>
            <dd>
              <StatePill tone={isVerified ? "live" : "warning"}>
                {isVerified ? "Yes" : "Not yet"}
              </StatePill>
            </dd>
          </div>
        </dl>
      </section>

      <section className="drawer-section">
        <h3>What each token says</h3>

        <table className="claim-table">
          <thead>
            <tr>
              <th scope="col">Claim</th>
              <th scope="col">ID token</th>
              <th scope="col">Access token</th>
            </tr>
          </thead>
          <tbody>
            {CLAIM_ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>
                  <ClaimValue
                    claim={row.key}
                    value={idClaims?.[row.key]}
                    nowMs={nowMs}
                  />
                </td>
                <td>
                  <ClaimValue
                    claim={row.key}
                    value={accessClaims?.[row.key]}
                    nowMs={nowMs}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="drawer-actions">
          <CopyButton label="Copy access token" value={tokens.accessToken} />
          <CopyButton label="Copy ID token" value={tokens.idToken} />
        </div>
      </section>
    </>
  );
}

function ClaimValue({ claim, value, nowMs }) {
  if (value === undefined || value === null) {
    return <span className="claim-absent">not present</span>;
  }

  if (claim === "exp") {
    const status = expiryStatus({ exp: value }, nowMs);
    return (
      <StatePill tone={status.expired ? "danger" : "live"}>
        {status.label}
      </StatePill>
    );
  }

  if (typeof value === "boolean") {
    return (
      <StatePill tone={value ? "live" : "warning"}>{String(value)}</StatePill>
    );
  }

  if (Array.isArray(value)) {
    // An audience list is worth reading in full; an order history is worth
    // counting. Printing forty orders here would bury the row that matters.
    if (claim === ORDERS_CLAIM) {
      return (
        <span>
          {value.length} {value.length === 1 ? "order" : "orders"}
        </span>
      );
    }
    return (
      <span className="claim-stack">
        {value.map((entry) => (
          <code key={String(entry)}>{String(entry)}</code>
        ))}
      </span>
    );
  }

  if (typeof value === "object") {
    return <span>{Object.keys(value).length} traits</span>;
  }

  return <code className="claim-scalar">{String(value)}</code>;
}

/* -------------------------------------------------------------- Insight -- */

// Only ever used to draw the progress bar. The segment *name* always comes from
// the server payload, so if these thresholds ever drift from the Action and the
// API, the badge stays right and only the bar is wrong.
const SEGMENT_LADDER = [
  { name: "New Customer", from: 0 },
  { name: "Occasional", from: 1 },
  { name: "Returning Regular", from: 4 },
  { name: "Loyal Regular", from: 10 },
];

const TRAIT_ROWS = [
  { key: "customer_segment", label: "Segment" },
  { key: "order_count", label: "Orders" },
  { key: "favourite_item", label: "Favourite item" },
  { key: "favourite_store", label: "Favourite store" },
  { key: "last_item_ordered", label: "Last item ordered" },
  { key: "last_order_at", label: "Last order" },
  { key: "average_order_value", label: "Average order" },
  { key: "identity_provider", label: "Signed in with" },
];

function formatTrait(key, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "average_order_value") return formatEuro.format(Number(value));
  if (key === "last_order_at") return formatTimestamp(value);
  if (key === "identity_provider") return providerName(value);
  return String(value);
}

function InsightTab({ insight }) {
  const {
    claimedProfile,
    liveProfile,
    marketingStatus,
    claimedOrderCount,
    liveOrderCount,
    event,
  } = insight;

  const current = liveProfile ?? claimedProfile ?? {};
  const orderCount = Number(current.order_count ?? 0);
  const nextTier = SEGMENT_LADDER.find((tier) => tier.from > orderCount);
  const currentTier =
    [...SEGMENT_LADDER].reverse().find((tier) => tier.from <= orderCount) ??
    SEGMENT_LADDER[0];
  const span = nextTier ? nextTier.from - currentTier.from : 0;
  const progress = span
    ? Math.min(100, Math.round(((orderCount - currentTier.from) / span) * 100))
    : 100;

  const divergent = TRAIT_ROWS.filter(
    ({ key }) =>
      liveProfile &&
      claimedProfile &&
      JSON.stringify(liveProfile[key] ?? null) !==
        JSON.stringify(claimedProfile[key] ?? null),
  );

  return (
    <>
      <section className="drawer-section">
        <h3>Marketing profile</h3>
        {marketingStatus === "unavailable" ? (
          <p className="drawer-note">
            The destination did not answer, so these traits are the ID token
            copy from the last sign-in. Ordering is unaffected.
          </p>
        ) : null}

        <div className="segment-card">
          <StatePill tone="flame">
            {current.customer_segment ?? "New Customer"}
          </StatePill>
          <p className="segment-count">
            {orderCount} {orderCount === 1 ? "order" : "orders"} on file
          </p>
          <div
            className="segment-bar"
            role="img"
            aria-label={
              nextTier
                ? `${nextTier.from - orderCount} more orders to ${nextTier.name}`
                : "Highest segment reached"
            }
          >
            <span style={{ inlineSize: `${progress}%` }} />
          </div>
          <p className="segment-next">
            {nextTier
              ? `${nextTier.from - orderCount} more to ${nextTier.name}`
              : "Highest segment reached"}
          </p>
        </div>

        <dl className="drawer-facts is-wide">
          {TRAIT_ROWS.map(({ key, label }) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{formatTrait(key, current[key])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="drawer-section">
        <h3>Action and API, side by side</h3>
        <p className="drawer-note">
          Left: derived by the Post-Login Action and signed into the ID token.
          Right: derived by the API from the live profile. Shared fixtures
          assert the two implementations agree.
        </p>

        <table className="claim-table is-compact">
          <thead>
            <tr>
              <th scope="col">Trait</th>
              <th scope="col">At sign-in</th>
              <th scope="col">Now</th>
            </tr>
          </thead>
          <tbody>
            {TRAIT_ROWS.map(({ key, label }) => {
              const claimed = claimedProfile?.[key] ?? null;
              const live = liveProfile?.[key] ?? null;
              const differs =
                liveProfile &&
                claimedProfile &&
                JSON.stringify(claimed) !== JSON.stringify(live);
              return (
                <tr key={key} className={differs ? "is-divergent" : undefined}>
                  <th scope="row">{label}</th>
                  <td>{formatTrait(key, claimed)}</td>
                  <td>{liveProfile ? formatTrait(key, live) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className={`match-card is-${divergent.length ? "drift" : "yes"}`}>
          <strong>
            {divergent.length
              ? `${divergent.length} ${divergent.length === 1 ? "trait has" : "traits have"} moved since sign-in`
              : "Both sides agree"}
          </strong>
          <p>
            {divergent.length
              ? "Expected. The ID token describes sign-in, not what happened after it. Signing in again realigns them."
              : "Nothing has changed on this account since the token was issued."}
          </p>
        </div>

        <dl className="drawer-facts">
          <div>
            <dt>Orders in this ID token</dt>
            <dd>{claimedOrderCount}</dd>
          </div>
          <div>
            <dt>Orders on file now</dt>
            <dd>{liveOrderCount ?? "Unavailable"}</dd>
          </div>
        </dl>
      </section>

      <section className="drawer-section">
        <h3>Outbound payload</h3>
        <p className="drawer-note">
          A simulated Segment <code>identify</code> event. Traits are derived
          server-side from the token subject.
        </p>
        <pre
          className="drawer-payload"
          aria-label="Simulated marketing payload"
        >
          {JSON.stringify(event ?? { traits: current }, null, 2)}
        </pre>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- Parts -- */

function StatePill({ tone, children }) {
  return <span className={`state-pill is-${tone}`}>{children}</span>;
}

function CopyButton({ label, value }) {
  const [state, setState] = useState("idle");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value ?? "");
      setState("copied");
    } catch {
      // Clipboard access needs a secure context and can be refused outright.
      // Say so rather than appearing to have done nothing.
      setState("blocked");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      className="drawer-copy"
      type="button"
      onClick={copy}
      disabled={!value}
    >
      {state === "copied" ? "Copied" : state === "blocked" ? "Blocked" : label}
    </button>
  );
}

// A ticking clock, mounted only while the panel that needs it is open, so the
// expiry countdown is live without the storefront re-rendering once a second.
// The claim table is laid out on fixed columns so that a countdown changing
// width cannot resize a column and reflow every row around it.
function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}
