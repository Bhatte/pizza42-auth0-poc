import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { formatEuro, formatTimestamp, providerName } from "./lib/format.js";
import { PROBES, curlFor, isAvailable, runProbe } from "./lib/probes.js";
import { audienceList, decodeToken, expiryStatus } from "./lib/tokens.js";

// Behind the counter: everything a reviewer would otherwise open four other
// windows to see. It is deliberately not part of the customer journey — a
// hungry person ordering a pizza never opens this — but it lives in the same
// page as the journey, so the evidence and the thing it is evidence *of* can be
// looked at together rather than alternately.

const TABS = [
  { id: "session", label: "Session" },
  { id: "probes", label: "Prove it" },
  { id: "insight", label: "Insight" },
  { id: "network", label: "Network" },
];

const EMAIL_VERIFIED_CLAIM = "https://pizza42.com/email_verified";
const ORDERS_CLAIM = "https://pizza42.com/orders";
const CUSTOMER_PROFILE_CLAIM = "https://pizza42.com/customer_profile";

export function EvidenceDrawer({
  open,
  onClose,
  api,
  auth,
  isVerified,
  store,
  insight,
}) {
  const [tab, setTab] = useState("session");
  const [tokens, setTokens] = useState({ status: "loading" });
  const [meta, setMeta] = useState({ status: "loading" });
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
    let active = true;

    api
      .getMeta()
      .then((data) => active && setMeta({ status: "ready", data }))
      .catch(() => active && setMeta({ status: "error" }));

    return () => {
      active = false;
    };
  }, [open, api]);

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
        <div>
          <h2>Behind the counter</h2>
          <p>
            The evidence a reviewer would otherwise gather from four other
            windows, gathered here instead.
          </p>
        </div>
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
            meta={meta}
            idTokenClaims={auth.idTokenClaims}
            isVerified={isVerified}
          />
        ) : null}
        {tab === "probes" ? (
          <ProbesTab
            api={api}
            tokens={tokens}
            store={store}
            isVerified={isVerified}
          />
        ) : null}
        {tab === "insight" ? <InsightTab insight={insight} /> : null}
        {tab === "network" ? <NetworkTab log={api.log} /> : null}
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
  {
    key: "iss",
    label: "Issuer",
    note: "Which tenant minted this. A perfectly signed token from any other issuer is still refused.",
  },
  {
    key: "aud",
    label: "Audience",
    note: "Who the token is addressed to. This one field is why an ID token cannot authorise an API call.",
  },
  {
    key: "exp",
    label: "Expires",
    note: "Re-checked on every single request. Nothing here is a long-lived key.",
  },
  {
    key: "scope",
    label: "Scope",
    note: "The operations this credential permits. Checked per route, not once at the door.",
  },
  {
    key: EMAIL_VERIFIED_CLAIM,
    label: "Email confirmed",
    note: "Written into both tokens by the Post-Login Action. The API reads it from the access token it verified itself.",
  },
  {
    key: ORDERS_CLAIM,
    label: "Order history",
    note: "The full history, copied in at login. On the ID token only — an API has no business being told this by its caller.",
  },
  {
    key: CUSTOMER_PROFILE_CLAIM,
    label: "Customer profile",
    note: "Traits derived by the Action at login, for the marketing destination.",
  },
];

function SessionTab({ tokens, meta, idTokenClaims, isVerified }) {
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
  const apiAudience = meta.status === "ready" ? meta.data.audience : null;
  const tokenAudiences = audienceList(accessClaims?.aud);
  const audienceAgrees = apiAudience
    ? tokenAudiences.includes(apiAudience)
    : null;

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
        <p className="drawer-note">
          Decoded here for reading only. Decoding is not verification: the API
          re-reads every one of these values from a signature it checks itself,
          so nothing shown on this page is trusted by anything.
        </p>

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
                <th scope="row">
                  <span>{row.label}</span>
                  <small>{row.note}</small>
                </th>
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
        <p className="drawer-note">
          Copied so a sceptic can make their own request, or decode it with
          their own tools, rather than take this page&apos;s word for it. Both
          are short-lived bearer credentials: treat a copied one the way you
          would a password.
        </p>
      </section>

      <section className="drawer-section">
        <h3>What the API enforces</h3>
        {meta.status === "error" ? (
          <p className="drawer-note">
            The API did not answer its configuration read-back.
          </p>
        ) : null}
        {meta.status === "ready" ? (
          <>
            {audienceAgrees === null ? null : (
              <div className={`match-card is-${audienceAgrees ? "yes" : "no"}`}>
                <strong>
                  {audienceAgrees
                    ? "Audience agrees"
                    : "Audience does not agree"}
                </strong>
                <p>
                  The token is addressed to{" "}
                  <code>{tokenAudiences[0] ?? "—"}</code> and this deployment
                  accepts <code>{apiAudience}</code>.
                </p>
              </div>
            )}
            <dl className="drawer-facts">
              <div>
                <dt>Issuer accepted</dt>
                <dd>
                  <code>{meta.data.issuer ?? "—"}</code>
                </dd>
              </div>
              <div>
                <dt>Signing algorithm</dt>
                <dd>
                  <code>{meta.data.token_signing_alg}</code>
                </dd>
              </div>
              <div>
                <dt>Confirmed email required on</dt>
                <dd>
                  <code>
                    {(meta.data.verified_email_enforced_on ?? []).join(", ")}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Quantity ceiling</dt>
                <dd>
                  {meta.data.max_line_quantity} per line,{" "}
                  {meta.data.max_order_lines} lines
                </dd>
              </div>
            </dl>
            <table className="claim-table is-compact">
              <thead>
                <tr>
                  <th scope="col">Operation</th>
                  <th scope="col">Scope required</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(meta.data.required_scopes ?? {}).map(
                  ([operation, scopes]) => (
                    <tr key={operation}>
                      <th scope="row">
                        <code>{operation}</code>
                      </th>
                      <td>
                        <code>{scopes.join(" ")}</code>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <p className="drawer-note">
              Read live from the deployed API, not typed into this page. Every
              value is already visible in any token the tenant issues, so none
              of it is secret. What it saves is opening a tenant dashboard to
              confirm the two halves agree.
            </p>
          </>
        ) : null}
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

/* --------------------------------------------------------------- Probes -- */

function ProbesTab({ api, tokens, store, isVerified }) {
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const context = useMemo(() => ({ verified: isVerified }), [isVerified]);
  const ready = tokens.status === "ready";

  const run = useCallback(
    async (probe) => {
      setResults((current) => ({
        ...current,
        [probe.id]: { state: "running" },
      }));
      try {
        const result = await runProbe(probe, {
          baseUrl: api.baseUrl,
          accessToken: tokens.accessToken,
          idToken: tokens.idToken,
          store,
          fetchRequest: api.request,
        });
        setResults((current) => ({
          ...current,
          [probe.id]: { state: "done", ...result },
        }));
      } catch (error) {
        // The request never reached the API. That is itself a finding — a CORS
        // or policy refusal looks exactly like this — so name it rather than
        // showing an empty card.
        setResults((current) => ({
          ...current,
          [probe.id]: {
            state: "blocked",
            failure: error?.message ?? "The request could not be sent.",
          },
        }));
      }
    },
    [api, tokens, store],
  );

  async function runAll() {
    setBusy(true);
    // Sequential on purpose: eight parallel requests make the network log
    // unreadable at exactly the moment somebody is reading it.
    for (const probe of PROBES) {
      if (isAvailable(probe, context)) await run(probe);
    }
    setBusy(false);
  }

  const groups = useMemo(() => {
    const byGroup = new Map();
    for (const probe of PROBES) {
      if (!byGroup.has(probe.group)) byGroup.set(probe.group, []);
      byGroup.get(probe.group).push(probe);
    }
    return [...byGroup.entries()];
  }, []);

  return (
    <>
      <section className="drawer-section">
        <h3>Requests designed to be refused</h3>
        <p className="drawer-note">
          These run against the deployed API from this page, so the status and
          body below are the real ones. Every probe is a rejection: each is
          refused in the authentication, verification or schema layer, all of
          which sit in front of the profile write. Running the whole set changes
          nothing and stores nothing.
        </p>
        <div className="drawer-actions">
          <button
            className="drawer-run-all"
            type="button"
            onClick={runAll}
            disabled={!ready || busy}
          >
            {busy ? "Running…" : "Run all"}
          </button>
          {ready ? null : <span className="drawer-note">Reading session…</span>}
        </div>
      </section>

      {groups.map(([group, probes]) => (
        <section className="drawer-section" key={group}>
          <h3>{group}</h3>
          <ul className="probe-list">
            {probes.map((probe) => (
              <Probe
                key={probe.id}
                probe={probe}
                store={store}
                available={isAvailable(probe, context)}
                result={results[probe.id]}
                onRun={() => run(probe)}
                disabled={!ready || busy}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Probe({ probe, store, available, result, onRun, disabled }) {
  const command = curlFor(probe, store);

  return (
    <li className={`probe${available ? "" : " is-unavailable"}`}>
      <div className="probe-head">
        <div>
          <strong>{probe.title}</strong>
          <code className="probe-target">
            {probe.method} {probe.path}
          </code>
        </div>
        <button type="button" onClick={onRun} disabled={disabled || !available}>
          {result?.state === "running" ? "…" : "Run"}
        </button>
      </div>

      <p className="probe-proves">{probe.proves}</p>

      <p className="probe-expect">
        Expects <code>{probe.expect.status}</code>
        {probe.expect.error ? (
          <>
            {" "}
            <code>{probe.expect.error}</code>
          </>
        ) : null}
      </p>

      {available ? null : (
        <p className="drawer-note">{probe.unavailableBecause}</p>
      )}

      {result?.state === "done" ? (
        <div className="probe-result">
          <div className="probe-result-head">
            <StatePill tone={result.matched ? "live" : "danger"}>
              {result.matched ? "As expected" : "Unexpected"}
            </StatePill>
            <code>{result.status}</code>
            <span>{result.ms} ms</span>
          </div>
          <pre>{JSON.stringify(result.body, null, 2)}</pre>
        </div>
      ) : null}

      {result?.state === "blocked" ? (
        <div className="probe-result">
          <div className="probe-result-head">
            <StatePill tone="danger">Never reached the API</StatePill>
          </div>
          <p className="drawer-note">{result.failure}</p>
        </div>
      ) : null}

      <details className="probe-curl">
        <summary>Run it yourself</summary>
        <pre>{command}</pre>
        <CopyButton label="Copy command" value={command} />
      </details>
    </li>
  );
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
        <h3>What marketing would see</h3>
        {marketingStatus === "unavailable" ? (
          <p className="drawer-note">
            The destination did not answer, so these traits are the ones carried
            in the ID token from the last sign-in. Ordering is unaffected, which
            is the whole reason the destination is kept off the checkout path.
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
        <h3>Computed twice, on purpose</h3>
        <p className="drawer-note">
          The left column was computed by the Post-Login Action and signed into
          the ID token at sign-in. The right column was computed by the API from
          the profile a moment ago. The same rules run in both places, and a
          shared set of fixtures asserts they agree.
        </p>

        <table className="claim-table is-compact">
          <thead>
            <tr>
              <th scope="col">Trait</th>
              <th scope="col">At sign-in</th>
              <th scope="col">Right now</th>
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
              ? "This is the expected behaviour, not a fault. An ID token is a signed statement about who someone was at sign-in, so it cannot describe an order placed since. Sign in again and the two columns match."
              : "Nothing has happened to this account since the token was issued, so the signed statement and the live profile say the same thing."}
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
        <h3>The outbound payload</h3>
        <p className="drawer-note">
          A simulated Segment <code>identify</code> event. Nothing is delivered
          to a real campaign tool, and the traits are derived server-side from
          the token subject, so a browser cannot supply its own.
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

/* -------------------------------------------------------------- Network -- */

function NetworkTab({ log }) {
  const entries = useSyncExternalStore(log.subscribe, log.getSnapshot);

  return (
    <section className="drawer-section">
      <h3>Everything this page has sent</h3>
      <p className="drawer-note">
        Recorded as each call is made. Token values are never kept — an entry
        records which credential was presented, because a log of bearer tokens
        is a log of credentials.
      </p>

      {entries.length === 0 ? (
        <p className="drawer-note">Nothing recorded yet.</p>
      ) : (
        <>
          <table className="claim-table is-compact network-table">
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Presented</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row">
                    <code>
                      {entry.method} {entry.path}
                    </code>
                  </th>
                  <td>
                    <span className={`credential is-${credentialTone(entry)}`}>
                      {entry.credential}
                    </span>
                  </td>
                  <td>
                    <StatePill tone={statusTone(entry)}>
                      {entry.status ?? entry.failure ?? "no response"}
                    </StatePill>
                    <span className="network-ms">{entry.ms} ms</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="drawer-actions">
            <button
              className="drawer-run-all"
              type="button"
              onClick={log.clear}
            >
              Clear
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function credentialTone(entry) {
  if (entry.credential === "none") return "none";
  if (entry.credential === "access token") return "access";
  return "other";
}

function statusTone(entry) {
  if (!entry.status) return "danger";
  if (entry.status < 300) return "live";
  if (entry.status < 500) return "warning";
  return "danger";
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
