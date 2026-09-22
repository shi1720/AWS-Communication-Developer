import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Box,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Globe,
  LayoutDashboard,
  Leaf,
  Loader2,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  TrendingUp,
  Truck,
  Users,
  X,
  Zap,
  AlertCircle,
  CircleHelp,
  TerminalSquare,
  LockKeyhole,
} from "lucide-react";
import type {
  AgentResult,
  Buyer,
  Channel,
  DashboardResponse,
  Lot,
  SessionUser,
  Workspace,
} from "../shared/types";
import { api, ApiError, clockTime, money, timeLeft } from "./api";
import { Produce } from "./Produce";
import RaceProof from "./RaceProof";
import BuyerForm from "./BuyerForm";
import OperationsPanel from "./OperationsPanel";
import { Button, Modal, useDialogFocus } from "./ui";
import { AuthScreen, AccountAction } from "./AuthScreens";

type Page =
  | "overview"
  | "recoveries"
  | "conversations"
  | "buyers"
  | "impact"
  | "activity"
  | "settings";
const channelIcon = {
  whatsapp: MessageCircle,
  sms: MessageCircle,
  email: Mail,
};
const channelLabel = { whatsapp: "WhatsApp", sms: "SMS", email: "Email" };
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "recoveries", label: "Recovery desk", icon: Box },
  { id: "conversations", label: "Conversations", icon: MessageCircle },
  { id: "buyers", label: "Buyer network", icon: Users },
  { id: "impact", label: "Impact & value", icon: TrendingUp },
] as const;
function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "light" : ""}`}>
      <img src="/favicon.svg" alt="" />
      <span>
        secondcrate<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function ChannelBadge({ channel }: { channel: Channel }) {
  const Icon = channelIcon[channel];
  return (
    <span className={`channel ${channel}`}>
      <Icon size={13} />
      {channelLabel[channel]}
    </span>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span className={`status ${status}`}>
      <i />
      {status === "draft"
        ? "Ready to recover"
        : status === "recovering"
          ? "In recovery"
          : status.replaceAll("_", " ")}
    </span>
  );
}
function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span className={`avatar avatar-${index % 4}`}>
      {name
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
function Empty({
  icon: Icon = Box,
  title,
  description,
  action,
}: {
  icon?: typeof Box;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState<DashboardResponse | null>(null),
    [page, setPage] = useState<Page>("overview"),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(""),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState<"lot" | "buyer" | "how" | null>(null),
    [selectedLot, setSelectedLot] = useState<string | null>(null),
    [mobileNav, setMobileNav] = useState(false);
  const [detail, setDetail] = useState<Lot | null>(null);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | undefined>();
  const [intakeSource, setIntakeSource] = useState("");
  const [tokenAction, setTokenAction] = useState<{
    action: "verify" | "reset";
    token: string;
  } | null>(() => {
    const params = new URLSearchParams(location.search);
    const action = params.has("verify")
      ? "verify"
      : params.has("reset")
        ? "reset"
        : null;
    if (!action) return null;
    const token = params.get(action) || "";
    history.replaceState({}, "", location.pathname);
    return { action, token };
  });
  const userRef = useRef<SessionUser | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  useDialogFocus(navigationRef, () => setMobileNav(false), mobileNav);
  useEffect(() => {
    const screen = window.matchMedia("(min-width: 641px)");
    const closeOnDesktop = () => {
      if (screen.matches) setMobileNav(false);
    };
    screen.addEventListener("change", closeOnDesktop);
    return () => screen.removeEventListener("change", closeOnDesktop);
  }, []);
  const sessionGeneration = useRef(0);
  const refreshSequence = useRef(0);
  function transitionSession(next: SessionUser | null) {
    userRef.current = next;
    sessionGeneration.current++;
    refreshSequence.current++;
    setUser(next);
    setData(null);
    setError("");
    setModal(null);
    setDetail(null);
    setEditingBuyer(undefined);
    setIntakeSource("");
    setSelectedLot(null);
    setMobileNav(false);
    setSearch("");
    setToast("");
    setPage("overview");
  }
  useEffect(() => {
    let active = true;
    const generation = sessionGeneration.current;
    const controller = new AbortController();
    api<{ user: SessionUser | null }>("/session", { signal: controller.signal })
      .then((r) => {
        if (active && generation === sessionGeneration.current)
          transitionSession(r.user);
      })
      .catch(() => {
        if (active && generation === sessionGeneration.current)
          transitionSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  async function refresh() {
    const requestedUser = userRef.current;
    const generation = sessionGeneration.current;
    const sequence = ++refreshSequence.current;
    if (!requestedUser)
      throw new ApiError("Sign in to continue.", 401, "UNAUTHENTICATED");
    try {
      const d = await api<DashboardResponse>("/dashboard");
      if (generation !== sessionGeneration.current) return d;
      if (
        d.user.id !== requestedUser.id ||
        d.workspace.id !== requestedUser.workspaceId
      ) {
        transitionSession(null);
        throw new ApiError(
          "Your browser session changed. Sign in to continue.",
          401,
          "SESSION_CHANGED",
        );
      }
      if (sequence === refreshSequence.current)
        setData((previous) =>
          previous?.workspace.id === d.workspace.id &&
          previous.workspace.version > d.workspace.version
            ? previous
            : d,
        );
      return d;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        generation === sessionGeneration.current
      )
        transitionSession(null);
      throw error;
    }
  }
  useEffect(() => {
    if (user) {
      refresh().catch((e) => setError(e.message));
    } else setData(null);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  async function action(
    id: string,
    fn: () => Promise<unknown>,
    success?: string,
  ) {
    setBusy(id);
    setError("");
    try {
      await fn();
      await refresh();
      if (success) setToast(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const w = data?.workspace;
  const activeLot =
    w?.lots.find((l) => l.id === selectedLot) ||
    w?.lots.find((l) => l.status === "recovering") ||
    w?.lots.find((l) => l.status === "draft") ||
    w?.lots[0];
  function openConversations(lot?: Lot) {
    if (lot) setSelectedLot(lot.id);
    setPage("conversations");
    setDetail(null);
  }
  function launch(lot: Lot) {
    return action(
      `launch-${lot.id}`,
      async () => {
        await api(`/lots/${lot.id}/launch`, { method: "POST", body: {} });
        setSelectedLot(lot.id);
      },
      "Buyer matches checked. Offers prepared in the conversation desk.",
    );
  }
  const total = w?.orders.reduce((sum, o) => sum + o.total, 0) || 0;
  const sold = w?.orders.reduce((sum, o) => sum + o.quantity, 0) || 0;
  const available =
    w?.lots
      .filter((l) => l.status !== "closed")
      .reduce((sum, l) => sum + l.available, 0) || 0;
  const eligible =
    w?.buyers.filter((b) => b.consent && !b.optedOut).length || 0;
  const active = w?.lots.filter((l) => l.status === "recovering").length || 0;
  if (tokenAction)
    return (
      <AccountAction
        {...tokenAction}
        onDone={() => {
          setLoading(true);
          setTokenAction(null);
          api<{ user: SessionUser | null }>("/session")
            .then((result) => transitionSession(result.user))
            .catch(() => transitionSession(null))
            .finally(() => setLoading(false));
        }}
      />
    );
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <Loader2 className="spin" />
        <p>Opening your recovery desk…</p>
      </div>
    );
  if (!user) return <AuthScreen onLogin={transitionSession} />;
  const pageTitle: Record<Page, string> = {
    overview: "Overview",
    recoveries: "Recovery desk",
    conversations: "Conversations",
    buyers: "Buyer network",
    impact: "Impact & value",
    activity: "Activity log",
    settings: "Workspace settings",
  };
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="navigation-backdrop"
          aria-label="Dismiss navigation"
          tabIndex={-1}
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobileNav ? "open" : ""}`}
        ref={navigationRef}
        tabIndex={-1}
        role={mobileNav ? "dialog" : undefined}
        aria-modal={mobileNav || undefined}
        aria-label="Workspace navigation"
      >
        <button
          className="icon-button navigation-close"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        >
          <X size={20} />
        </button>
        <Brand />
        <div className="workspace-select">
          <span className="workspace-logo">
            N<span>↗</span>
          </span>
          <div>
            <strong>{w?.settings.companyName || "Your workspace"}</strong>
            <small>Wholesale workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-group-label">WORKSPACE</div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => {
                setPage(id);
                setMobileNav(false);
                setSearch("");
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "recoveries" && active > 0 && <b>{active}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-card">
            <span className="sidebar-card-icon">
              <Leaf size={19} />
            </span>
            <h4>
              Good food belongs
              <br />
              on a plate.
            </h4>
            <p>
              Every recovery starts with
              <br />
              one conversation.
            </p>
            <button
              onClick={() => {
                setMobileNav(false);
                setModal("how");
              }}
            >
              See how SecondCrate works
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`bottom-nav ${page === "activity" ? "active" : ""}`}
            onClick={() => {
              setPage("activity");
              setMobileNav(false);
            }}
          >
            <FileText size={18} />
            Activity log
          </button>
          <button
            className={`bottom-nav ${page === "settings" ? "active" : ""}`}
            onClick={() => {
              setPage("settings");
              setMobileNav(false);
            }}
          >
            <Settings2 size={18} />
            Settings
          </button>
          <div className="user-row">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>{user.isDemo ? "Demo operator" : "Workspace owner"}</small>
            </div>
            <button
              aria-label="Sign out"
              className="icon-button"
              onClick={() =>
                (async () => {
                  try {
                    await api("/auth/logout", { method: "POST", body: {} });
                    transitionSession(null);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                })()
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={mobileNav || undefined}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              aria-expanded={mobileNav}
              aria-controls="workspace-navigation"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{pageTitle[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="runtime-pill">
              <i />
              {user.isDemo ? "Demo workspace" : "Private workspace"}
            </span>
            <span className="topbar-line" />
            <button
              className="icon-button"
              aria-label="How SecondCrate works"
              onClick={() => setModal("how")}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="View activity log"
              onClick={() => setPage("activity")}
            >
              <Bell size={19} />
            </button>
            <Avatar name={user.name} />
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {!w ? (
            <div className="empty">
              <Loader2 className="spin" />
              <p>Loading your workspace…</p>
              <Button
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              {page === "overview" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        SMALL CONVERSATIONS. REAL RECOVERIES.
                      </div>
                      <h1>
                        Nothing good left behind
                        <span className="period">.</span>
                      </h1>
                      <p>Give cancelled orders a second destination.</p>
                    </div>
                    <Button onClick={() => setModal("lot")}>
                      <Plus size={17} />
                      New recovery
                    </Button>
                  </div>
                  <section className="overview-hero">
                    <div className="hero-text">
                      <span className="hero-tag">
                        <span className="tiny-dot" />
                        {activeLot?.status === "recovered"
                          ? "ANOTHER LOT, ANOTHER CHANCE"
                          : activeLot
                            ? "A GOOD LOT. A NEW OPPORTUNITY."
                            : "YOUR NEXT RECOVERY STARTS HERE"}
                      </span>
                      <h2>
                        {activeLot?.status === "recovered" ? (
                          <>
                            That’s {sold} crates
                            <br />
                            <em>back on the menu.</em>
                          </>
                        ) : (
                          <>
                            A cancellation isn’t
                            <br />
                            <em>the end of the story.</em>
                          </>
                        )}
                      </h2>
                      <p>
                        {activeLot
                          ? `${activeLot.quantity} ${activeLot.unit || "crates"} of ${activeLot.product.toLowerCase()}. A network of ready buyers. Let’s find the next destination.`
                          : "Bring a cancelled lot to the desk. SecondCrate connects your stock with the buyers who can use it."}
                      </p>
                      <div className="hero-actions">
                        <Button
                          variant="dark"
                          onClick={() =>
                            activeLot
                              ? activeLot.status === "draft"
                                ? launch(activeLot)
                                : openConversations(activeLot)
                              : setModal("lot")
                          }
                          busy={busy === `launch-${activeLot?.id}`}
                        >
                          {activeLot?.status === "draft"
                            ? "Find a second buyer"
                            : activeLot
                              ? "Open recovery"
                              : "Add your first lot"}
                          <ArrowUpRight size={18} />
                        </Button>
                        <button
                          className="text-button"
                          onClick={() => setModal("how")}
                        >
                          <Play size={13} />
                          How it works
                        </button>
                      </div>
                    </div>
                    <div className="hero-art">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <Produce />
                      <div className="hero-floating">
                        <span className="hero-floating-icon">
                          <ArrowUpRight size={19} />
                        </span>
                        <div>
                          <strong>Same good food.</strong>
                          <small>A fresh opportunity.</small>
                        </div>
                      </div>
                      <span className="art-caption">
                        LESS WASTE. MORE POSSIBILITY.
                      </span>
                    </div>
                  </section>
                  <div className="metrics-grid">
                    <Metric
                      label="Recovered order value"
                      value={money(total)}
                      detail={`${w.orders.length} confirmed ${w.orders.length === 1 ? "order" : "orders"}`}
                      icon={TrendingUp}
                      highlight
                    />
                    <Metric
                      label="Crates finding a buyer"
                      value={String(available).padStart(2, "0")}
                      detail={`${active} ${active === 1 ? "recovery" : "recoveries"} in progress`}
                      icon={Box}
                    />
                    <Metric
                      label="Crates recovered"
                      value={String(sold).padStart(2, "0")}
                      detail="Confirmed, awaiting or sent to dispatch"
                      icon={PackageCheck}
                    />
                    <Metric
                      label="Buyers in your corner"
                      value={String(eligible).padStart(2, "0")}
                      detail="Consented and ready to contact"
                      icon={Users}
                    />
                  </div>
                  <div className="overview-bottom">
                    <section className="panel recovery-panel">
                      <div className="panel-heading">
                        <div>
                          <h3>
                            Your recovery desk{" "}
                            <span className="count">
                              {
                                w.lots.filter((l) => l.status !== "closed")
                                  .length
                              }
                            </span>
                          </h3>
                          <p>A second chance, one lot at a time.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setPage("recoveries")}
                        >
                          View all
                          <ArrowRight size={15} />
                        </button>
                      </div>
                      <LotTable
                        lots={w.lots.slice(0, 4)}
                        orders={w.orders}
                        onSelect={setDetail}
                        onLaunch={launch}
                        busy={busy}
                      />
                    </section>
                    <section className="panel activity-panel">
                      <div className="panel-heading">
                        <div>
                          <h3>The latest</h3>
                          <p>Every step, accounted for.</p>
                        </div>
                        <span className="live-dot" />
                      </div>
                      <Activity events={w.events.slice(0, 4)} />
                      <button
                        className="activity-link"
                        onClick={() => setPage("activity")}
                      >
                        View activity log
                        <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                  <div className="quiet-note">
                    <ShieldCheck size={15} />
                    {user.isDemo
                      ? "A safe place to explore: all buyer profiles and deliveries in this workspace are synthetic."
                      : "You stay in control. Every commitment is checked against your price, stock and dispatch limits."}
                    <span>
                      {data?.runtime.ai === "bedrock"
                        ? "Amazon Bedrock configured"
                        : "Deterministic rehearsal engine"}
                    </span>
                  </div>
                </>
              )}
              {page === "recoveries" && (
                <>
                  <PageHeading
                    eyebrow="FROM CANCELLED TO CONFIRMED"
                    title="The recovery desk."
                    text="Every lot has a next best destination."
                    action={
                      <Button onClick={() => setModal("lot")}>
                        <Plus size={16} />
                        New recovery
                      </Button>
                    }
                  />
                  <div className="desk-summary">
                    <div>
                      <Box size={20} />
                      <strong>{w.lots.length}</strong>
                      <span>total lots</span>
                    </div>
                    <div>
                      <Clock3 size={20} />
                      <strong>{active}</strong>
                      <span>in recovery</span>
                    </div>
                    <div>
                      <PackageCheck size={20} />
                      <strong>
                        {w.lots.filter((l) => l.status === "recovered").length}
                      </strong>
                      <span>fully allocated</span>
                    </div>
                    <div>
                      <TrendingUp size={20} />
                      <strong>{money(total)}</strong>
                      <span>recovered value</span>
                    </div>
                  </div>
                  <div className="panel">
                    <div className="table-toolbar">
                      <div className="section-tabs">
                        <span className="selected">
                          All recoveries <b>{w.lots.length}</b>
                        </span>
                      </div>
                      <label className="search-input">
                        <Search size={16} />
                        <input
                          aria-label="Search recoveries"
                          placeholder="Search product or reference…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                    </div>
                    <LotTable
                      lots={w.lots.filter((l) =>
                        `${l.product} ${l.reference}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )}
                      orders={w.orders}
                      onSelect={setDetail}
                      onLaunch={launch}
                      busy={busy}
                    />
                  </div>
                  <Orders
                    workspace={w}
                    onDispatch={(id) =>
                      action(
                        `dispatch-${id}`,
                        () =>
                          api(`/orders/${id}/dispatch`, {
                            method: "POST",
                            body: {},
                          }),
                        "Order marked dispatched.",
                      )
                    }
                    busy={busy}
                  />
                </>
              )}
              {page === "conversations" && (
                <Conversations
                  workspace={w}
                  activeLot={activeLot}
                  setSelectedLot={setSelectedLot}
                  isDemo={user.isDemo}
                  onRefresh={refresh}
                  onError={setError}
                  onLaunch={launch}
                  launchBusy={busy.startsWith("launch")}
                  ai={data?.runtime.ai || "rehearsal"}
                />
              )}
              {page === "buyers" && (
                <>
                  <PageHeading
                    eyebrow="RELATIONSHIPS THAT RECOVER VALUE"
                    title="Your buyer network."
                    text="The right buyer already knows you. Meet them in their preferred channel."
                    action={
                      <Button
                        onClick={() => {
                          setEditingBuyer(undefined);
                          setModal("buyer");
                        }}
                      >
                        <Plus size={16} />
                        Add buyer
                      </Button>
                    }
                  />
                  <div className="network-banner">
                    <span className="network-art">
                      <Users size={29} />
                    </span>
                    <div>
                      <h3>A trusted network, not another marketplace.</h3>
                      <p>
                        Match category, capacity and delivery needs. Only
                        contact buyers who have opted in.
                      </p>
                    </div>
                    <span className="network-count">
                      {eligible}
                      <small>opted-in buyers</small>
                    </span>
                  </div>
                  <div className="buyer-grid">
                    {w.buyers.map((b, i) => (
                      <article className="panel buyer-card" key={b.id}>
                        <div className="buyer-card-top">
                          <Avatar name={b.name} index={i} />
                          <Status
                            status={
                              b.consent && !b.optedOut ? "connected" : "paused"
                            }
                          />
                        </div>
                        <h3>{b.name}</h3>
                        <p>{b.contact}</p>
                        <div className="buyer-tags">
                          {b.categories.map((c) => (
                            <span key={c}>{c}</span>
                          ))}
                        </div>
                        <dl>
                          <div>
                            <dt>Preferred channel</dt>
                            <dd>
                              <ChannelBadge channel={b.channel} />
                            </dd>
                          </div>
                          <div>
                            <dt>Route distance</dt>
                            <dd>{b.distanceKm} km</dd>
                          </div>
                          <div>
                            <dt>Capacity per lot</dt>
                            <dd>{b.maxCrates} crates</dd>
                          </div>
                        </dl>
                        <div className="buyer-contact">
                          <Mail size={13} />
                          {b.email}
                        </div>
                        <div className="buyer-card-actions">
                          <Button
                            variant="subtle"
                            onClick={() => {
                              setEditingBuyer(b);
                              setModal("buyer");
                            }}
                          >
                            Edit buyer
                            <ArrowRight size={14} />
                          </Button>
                          {b.consent && !b.optedOut && (
                            <Button
                              variant="subtle"
                              busy={busy === `buyer-${b.id}`}
                              onClick={() =>
                                action(
                                  `buyer-${b.id}`,
                                  () =>
                                    api(`/buyers/${b.id}`, {
                                      method: "PATCH",
                                      body: { consent: false, optedOut: true },
                                    }),
                                  "Buyer paused. No future outreach will be sent.",
                                )
                              }
                            >
                              Pause outreach
                            </Button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  {!w.buyers.length && (
                    <Empty
                      icon={Users}
                      title="Start with the buyers who trust you."
                      description="Add a buyer and record their consent to receive recovery offers."
                    />
                  )}
                </>
              )}
              {page === "impact" && <Impact workspace={w} />}
              {page === "activity" && (
                <>
                  <PageHeading
                    eyebrow="TRUST IS IN THE DETAILS"
                    title="Every action. On the record."
                    text="An operational audit trail of decisions, safeguards and delivery outcomes."
                    action={
                      <button
                        className="button secondary"
                        onClick={() => {
                          const blob = new Blob(
                            [JSON.stringify(w.events, null, 2)],
                            { type: "application/json" },
                          );
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = "secondcrate-audit.json";
                          a.click();
                          URL.revokeObjectURL(a.href);
                        }}
                      >
                        <Download size={16} />
                        Export audit
                      </button>
                    }
                  />
                  <div className="audit-intro">
                    <ShieldCheck size={22} />
                    <div>
                      <strong>AI interprets. Your rules decide.</strong>
                      <p>
                        These are recorded tool actions and outcomes. Price,
                        quantity, consent and dispatch constraints are enforced
                        in code.
                      </p>
                    </div>
                  </div>
                  <OperationsPanel
                    workspace={w}
                    isDemo={user.isDemo}
                    onRefresh={refresh}
                    onReviewSource={(source) => {
                      setIntakeSource(source);
                      setModal("lot");
                    }}
                  />
                  <div className="panel audit-panel">
                    <Activity events={w.events} full />
                    {!w.events.length && (
                      <Empty
                        title="The story starts here."
                        description="Create or launch a recovery to see its decisions and outcomes."
                      />
                    )}
                  </div>
                </>
              )}
              {page === "settings" && (
                <Settings
                  data={data!}
                  action={action}
                  busy={busy}
                  onToast={setToast}
                />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            SecondCrate <span>·</span> Every good lot deserves a buyer.
          </span>
          <span>Depot times: London</span>
          <span>
            Created by Shivam Gupta <span>·</span> 2026
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "lot" && (
        <NewLot
          initialSource={intakeSource}
          onClose={() => {
            setModal(null);
            setIntakeSource("");
          }}
          onCreated={async () => {
            setModal(null);
            await refresh();
            setPage("recoveries");
            setIntakeSource("");
            setToast("Lot added. Review it, then launch your recovery.");
          }}
        />
      )}
      {modal === "buyer" && (
        <BuyerForm
          buyer={editingBuyer}
          onClose={() => setModal(null)}
          onCreated={async () => {
            setModal(null);
            await refresh();
            setToast(
              editingBuyer
                ? "Buyer preferences saved."
                : "Buyer added to your network.",
            );
          }}
        />
      )}
      {modal === "how" && (
        <HowItWorks
          onClose={() => setModal(null)}
          onStart={() => {
            setModal(null);
            setPage("conversations");
          }}
        />
      )}
      {detail && w && (
        <LotDetail
          lot={w.lots.find((l) => l.id === detail.id) || detail}
          workspace={w}
          onClose={() => setDetail(null)}
          onLaunch={launch}
          onConversations={openConversations}
          busy={busy}
          onCloseLot={(id) =>
            action(
              `close-${id}`,
              () => api(`/lots/${id}/close`, { method: "POST", body: {} }),
              "Recovery closed. Existing orders remain on record.",
            )
          }
        />
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Box;
  highlight?: boolean;
}) {
  return (
    <article className={`metric ${highlight ? "highlight" : ""}`}>
      <div className="metric-label">
        {label}
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <p>
        {highlight && <ArrowUpRight size={13} />} {detail}
      </p>
    </article>
  );
}
function LotTable({
  lots,
  orders,
  onSelect,
  onLaunch,
  busy,
}: {
  lots: Lot[];
  orders: Workspace["orders"];
  onSelect: (l: Lot) => void;
  onLaunch: (l: Lot) => void;
  busy: string;
}) {
  return (
    <div className="table-scroll">
      <table className="lot-table">
        <thead>
          <tr>
            <th>LOT & PRODUCT</th>
            <th>STOCK</th>
            <th>DISPATCH IN</th>
            <th>STATUS</th>
            <th>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lots.map((l, i) => {
            const confirmed = orders
              .filter((o) => o.lotId === l.id)
              .reduce((s, o) => s + o.quantity, 0);
            return (
              <tr key={l.id}>
                <td>
                  <button className="product-cell" onClick={() => onSelect(l)}>
                    <span className={`produce-thumb produce-${i % 3}`}>
                      <Sprout size={24} />
                    </span>
                    <span>
                      <strong>{l.product}</strong>
                      <small>
                        {l.reference} · {l.unitKg} kg /{" "}
                        {l.unit === "crates" ? "crate" : l.unit || "crate"}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <strong>
                    {l.available}
                    <span className="muted"> / {l.quantity}</span>
                  </strong>
                  <small>{confirmed ? "remaining" : "crates available"}</small>
                </td>
                <td>
                  <span
                    className={`time-cell ${new Date(l.dispatchBy).getTime() - Date.now() < 3600000 ? "urgent" : ""}`}
                  >
                    <Clock3 size={13} />
                    {l.status === "recovered"
                      ? "Allocated"
                      : timeLeft(l.dispatchBy)}
                  </span>
                </td>
                <td>
                  <Status status={l.status} />
                </td>
                <td>
                  <button
                    className="row-action"
                    aria-label={`Open ${l.product}`}
                    onClick={() => onSelect(l)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!lots.length && (
        <Empty
          title="No lots here yet."
          description="Add a cancelled order to give it a second destination."
        />
      )}
    </div>
  );
}
function Activity({
  events,
  full = false,
}: {
  events: Workspace["events"];
  full?: boolean;
}) {
  return (
    <div className={`activity-list ${full ? "full" : ""}`}>
      {events.length ? (
        events.map((e, i) => (
          <div className="activity-item" key={e.id}>
            <span
              className={`event-icon ${e.type.includes("block") || e.type.includes("fail") ? "warning" : ""}`}
            >
              {e.actor === "agent" ? (
                <Sparkles size={14} />
              ) : e.actor === "buyer" ? (
                <MessageCircle size={14} />
              ) : e.type.includes("order") ? (
                <Check size={14} />
              ) : (
                <Box size={14} />
              )}
            </span>
            <div>
              <strong>{e.title}</strong>
              <p>{e.detail}</p>
              {full && typeof e.metadata?.sourceText === "string" && (
                <details className="audit-record">
                  <summary>View received text</summary>
                  <p>{e.metadata.sourceText}</p>
                  <small>
                    Retained for operator review. This record does not allocate
                    stock.
                  </small>
                </details>
              )}
              {full && typeof e.metadata?.evidence === "string" && (
                <details className="audit-record">
                  <summary>View operator evidence</summary>
                  <p>{e.metadata.evidence}</p>
                </details>
              )}
              <small>
                {clockTime(e.at)}{" "}
                {full &&
                  `· ${new Date(e.at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })} · ${e.actor}`}
              </small>
            </div>
            {full && <span className="event-type">{e.type}</span>}
          </div>
        ))
      ) : (
        <div className="activity-welcome">
          <span>
            <Sprout size={25} />
          </span>
          <h4>Ready for a better outcome.</h4>
          <p>
            Launch your first recovery.
            <br />
            We’ll keep the whole story here.
          </p>
        </div>
      )}
    </div>
  );
}

function Orders({
  workspace: w,
  onDispatch,
  busy,
}: {
  workspace: Workspace;
  onDispatch: (id: string) => void;
  busy: string;
}) {
  return (
    <section className="panel orders-panel">
      <div className="panel-heading">
        <div>
          <h3>
            Confirmed orders <span className="count">{w.orders.length}</span>
          </h3>
          <p>Real commitments, ready for the next stop.</p>
        </div>
        <a className="text-button" href="/api/export" download>
          <Download size={15} />
          Export CSV
        </a>
      </div>
      {w.orders.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CONFIRMATION</th>
                <th>BUYER</th>
                <th>QUANTITY</th>
                <th>VALUE</th>
                <th>FULFILMENT</th>
              </tr>
            </thead>
            <tbody>
              {w.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.confirmationCode}</strong>
                    <small>
                      {w.lots.find((l) => l.id === o.lotId)?.product}
                    </small>
                  </td>
                  <td>{w.buyers.find((b) => b.id === o.buyerId)?.name}</td>
                  <td>
                    {o.quantity} crates{" "}
                    <small>at {money(o.unitPrice)} / crate</small>
                  </td>
                  <td>
                    <strong>{money(o.total)}</strong>
                  </td>
                  <td>
                    {o.status === "dispatched" ? (
                      <Status status="dispatched" />
                    ) : (
                      <Button
                        variant="small secondary"
                        onClick={() => onDispatch(o.id)}
                        busy={busy === `dispatch-${o.id}`}
                      >
                        <Truck size={14} />
                        Mark dispatched
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={PackageCheck}
          title="Your next recovered order goes here."
          description="When a buyer accepts a valid offer, stock is allocated and an order is recorded."
        />
      )}
    </section>
  );
}

function Conversations({
  workspace: w,
  activeLot,
  setSelectedLot,
  isDemo,
  onRefresh,
  onError,
  onLaunch,
  launchBusy,
  ai,
}: {
  workspace: Workspace;
  activeLot?: Lot;
  setSelectedLot: (id: string) => void;
  isDemo: boolean;
  onRefresh: () => Promise<unknown>;
  onError: (e: string) => void;
  onLaunch: (l: Lot) => void;
  launchBusy: boolean;
  ai: string;
}) {
  const [buyerId, setBuyerId] = useState(w.buyers[0]?.id || ""),
    [text, setText] = useState(""),
    [channel, setChannel] = useState<Channel>(
      w.buyers[0]?.channel || "whatsapp",
    ),
    [sending, setSending] = useState(false),
    [result, setResult] = useState<AgentResult | null>(null),
    [showTrace, setShowTrace] = useState(true),
    [race, setRace] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  // A lost HTTP response must not turn a retry into a second allocation.
  const pendingReply = useRef<{ fingerprint: string; eventId: string } | null>(
    null,
  );
  const buyer = w.buyers.find((b) => b.id === buyerId) || w.buyers[0];
  const messages = w.messages.filter(
    (m) => m.buyerId === buyer?.id && (!m.lotId || m.lotId === activeLot?.id),
  );
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, sending]);
  async function send(value: string) {
    if (!activeLot || !buyer || !value.trim() || sending) return;
    setSending(true);
    setText("");
    const fingerprint = JSON.stringify([
      buyer.id,
      activeLot.id,
      channel,
      value.trim(),
    ]);
    if (pendingReply.current?.fingerprint !== fingerprint)
      pendingReply.current = { fingerprint, eventId: crypto.randomUUID() };
    try {
      const r = await api<{ workspace: Workspace; result: AgentResult }>(
        "/inbound",
        {
          method: "POST",
          body: {
            buyerId: buyer.id,
            lotId: activeLot.id,
            channel,
            text: value,
            eventId: pendingReply.current.eventId,
          },
        },
      );
      pendingReply.current = null;
      setResult(r.result);
      try {
        await onRefresh();
      } catch {
        onError(
          "Your reply was processed, but the latest workspace could not be loaded. Refresh the page to see the result before sending again.",
        );
      }
    } catch (e) {
      onError((e as Error).message);
      setText(value);
    } finally {
      setSending(false);
    }
  }
  const suggested = buyer?.name.includes("Olive")
    ? [
        "I can take 12 crates at £17 each.",
        "Can you do 12 crates at £10?",
        "What is the delivery deadline?",
      ]
    : buyer?.name.includes("Sunday")
      ? [
          "I’ll take 20 crates at £18 each.",
          "Could I take 50 crates?",
          "No thanks, not today.",
        ]
      : [
          "I’ll take 8 crates at £18 each.",
          "Please stop messaging me.",
          "What is the price per crate?",
        ];
  return (
    <>
      <PageHeading
        eyebrow="ONE CONVERSATION. EVERY CHANNEL."
        title="From interest to order."
        text="Meet buyers where they are. Keep the context all the way to confirmation."
        action={
          <button
            className={`button secondary ${showTrace ? "selected" : ""}`}
            onClick={() => setShowTrace(!showTrace)}
          >
            <TerminalSquare size={16} />
            {showTrace ? "Hide" : "Show"} agent activity
          </button>
        }
      />
      {isDemo && (
        <div className="studio-banner">
          <span className="studio-badge">
            <Play size={12} fill="currentColor" /> INTERACTIVE DEMO
          </span>
          <p>
            You play the buyer. SecondCrate handles the checks and the order.
          </p>
          <span>
            {ai === "bedrock"
              ? "Live Bedrock reasoning"
              : "Rehearsal reasoning"}{" "}
            · simulated delivery
          </span>
        </div>
      )}
      {!activeLot ? (
        <Empty
          title="Create a lot to start a conversation."
          description="Each offer is tied to real stock and a dispatch window."
        />
      ) : (
        <>
          {race && (
            <RaceProof
              workspace={w}
              lot={activeLot}
              onClose={() => setRace(false)}
              onRefresh={onRefresh}
            />
          )}
          <div className="conversation-lotbar">
            <div>
              <span className="lotbar-icon">
                <Box size={19} />
              </span>
              <label>
                <small>ACTIVE RECOVERY</small>
                <select
                  aria-label="Active recovery"
                  disabled={sending}
                  value={activeLot.id}
                  onChange={(e) => {
                    setSelectedLot(e.target.value);
                    setResult(null);
                    setText("");
                  }}
                >
                  {w.lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.product} · {l.reference}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="lotbar-stats">
              <span>
                <strong>{activeLot.available}</strong> / {activeLot.quantity}{" "}
                crates left
              </span>
              <span>
                Floor <strong>{money(activeLot.floorPrice)}</strong>
              </span>
              <span>
                <Clock3 size={14} />
                {timeLeft(activeLot.dispatchBy)}
              </span>
              {activeLot.status === "draft" ? (
                <Button
                  variant="small"
                  onClick={() => onLaunch(activeLot)}
                  busy={launchBusy}
                >
                  Launch recovery
                  <ArrowRight size={14} />
                </Button>
              ) : (
                <Status status={activeLot.status} />
              )}
              {isDemo &&
                activeLot.available === 8 &&
                activeLot.status === "recovering" && (
                  <Button
                    variant="small secondary"
                    onClick={() => setRace(true)}
                  >
                    <Zap size={13} />
                    Test stock lock
                  </Button>
                )}
            </div>
          </div>
          <div
            className={`conversation-layout ${showTrace ? "with-trace" : ""}`}
          >
            <aside className="conversation-buyers">
              <div className="conversation-sidebar-head">
                BUYER CONVERSATIONS <span>{w.buyers.length}</span>
              </div>
              {w.buyers.map((b, i) => {
                const recent = w.messages
                  .filter((m) => m.buyerId === b.id && m.lotId === activeLot.id)
                  .slice(-1)[0];
                const order = w.orders.find(
                  (o) => o.buyerId === b.id && o.lotId === activeLot.id,
                );
                return (
                  <button
                    key={b.id}
                    disabled={sending}
                    className={`conversation-buyer ${buyer?.id === b.id ? "selected" : ""}`}
                    onClick={() => {
                      setBuyerId(b.id);
                      setChannel(b.channel);
                      setResult(null);
                      setText("");
                    }}
                  >
                    <Avatar name={b.name} index={i} />
                    <span>
                      <strong>{b.name}</strong>
                      <small>{recent?.text || "Waiting for an offer"}</small>
                      <span className="buyer-channel-mini">
                        {channelLabel[b.channel]}
                        {order && (
                          <span className="order-mini">
                            <Check size={10} />
                            {order.quantity} confirmed
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
              <div className="conversation-aside-note">
                <ShieldCheck size={17} />
                <p>
                  Shared context.
                  <br />
                  Separate conversations.
                  <br />
                  One source of stock truth.
                </p>
              </div>
            </aside>
            <section className="chat-panel">
              <div className="chat-header">
                <div>
                  <Avatar name={buyer?.name || "Buyer"} />
                  <span>
                    <strong>{buyer?.name || "Select a buyer"}</strong>
                    <small>
                      {buyer?.contact} · {buyer?.maxCrates} crate capacity
                    </small>
                  </span>
                </div>
                {buyer && <ChannelBadge channel={channel} />}
              </div>
              <div className="chat-body">
                <div className="chat-date">
                  {new Date().toLocaleDateString("en-GB", {
                    timeZone: "Europe/London",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  · {activeLot.reference}
                </div>
                {messages.length ? (
                  messages.map((m) => (
                    <div key={m.id} className={`chat-message ${m.direction}`}>
                      <div className="message-who">
                        {m.direction === "outbound"
                          ? "SecondCrate"
                          : buyer?.contact.split(" ")[0]}
                        <span>{channelLabel[m.channel]}</span>
                      </div>
                      <div className="bubble">{m.text}</div>
                      <div className="message-meta">
                        {clockTime(m.createdAt)}
                        {m.direction === "outbound" && (
                          <>
                            <CheckCheck size={12} />
                            <span
                              className={m.status === "failed" ? "red" : ""}
                            >
                              {m.status === "simulated"
                                ? "Demo delivery"
                                : m.status}
                            </span>
                          </>
                        )}
                        {m.error && <span title={m.error}> · {m.error}</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="chat-empty">
                    <MessageCircle size={36} />
                    <h3>Every recovery starts with hello.</h3>
                    <p>
                      {activeLot.status === "draft"
                        ? "Launch this recovery to match buyers and prepare their offers."
                        : "Select a buyer and try a reply below."}
                    </p>
                  </div>
                )}
                {sending && (
                  <div className="thinking">
                    <Sparkles size={15} />
                    <span>
                      Checking the request against stock and your rules
                    </span>
                    <Loader2 size={14} className="spin" />
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              {isDemo ? (
                <div className="chat-compose">
                  <div className="compose-label">
                    <span>
                      <Play size={11} fill="currentColor" />
                      REPLY AS THE BUYER
                    </span>
                    <select
                      aria-label="Reply channel"
                      disabled={sending}
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as Channel)}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div className="suggested-replies">
                    {suggested.map((s) => (
                      <button
                        key={s}
                        disabled={sending || activeLot.status === "draft"}
                        onClick={() => send(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      send(text);
                    }}
                  >
                    <input
                      aria-label="Buyer reply"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={
                        activeLot.status === "draft"
                          ? "Launch the recovery to start…"
                          : "Ask, negotiate, or accept the offer…"
                      }
                      disabled={sending || activeLot.status === "draft"}
                      maxLength={2000}
                    />
                    <button
                      aria-label="Send buyer reply"
                      disabled={
                        !text.trim() || sending || activeLot.status === "draft"
                      }
                    >
                      <Send size={18} />
                    </button>
                  </form>
                  <small>
                    Switch channels to continue the same conversation. No real
                    messages are sent.
                  </small>
                </div>
              ) : (
                <div className="live-inbound-note">
                  <Globe size={17} /> Replies arrive through your connected AWS
                  messaging channels.
                </div>
              )}
            </section>
            {showTrace && (
              <aside className="trace-panel">
                <div className="trace-heading">
                  <span>
                    <Sparkles size={17} />
                    Agent activity
                  </span>
                  <i />
                </div>
                <div className="trace-summary">
                  <span className="eyebrow">GUARDED AUTONOMY</span>
                  <h3>
                    Conversation in.
                    <br />
                    Checked action out.
                  </h3>
                  <p>
                    {result
                      ? `Processed with ${result.model}. Every commitment passed through the same transaction checks.`
                      : "Send a buyer reply to see the checks, tools and outcome."}
                  </p>
                </div>
                <div className="trace-steps">
                  {result?.steps?.length
                    ? result.steps.map((s, i) => (
                        <div key={i} className={`trace-step ${s.status}`}>
                          <div className="trace-step-top">
                            <span>
                              {s.status === "blocked" ? (
                                <ShieldCheck size={14} />
                              ) : (
                                <Check size={14} />
                              )}
                            </span>
                            <strong>{s.tool.replaceAll("_", " ")}</strong>
                          </div>
                          <p>{s.summary}</p>
                        </div>
                      ))
                    : [
                        "Read buyer intent",
                        "Check price & delivery",
                        "Allocate available stock",
                        "Confirm across channels",
                      ].map((s, i) => (
                        <div className="trace-placeholder" key={s}>
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <p>{s}</p>
                        </div>
                      ))}
                </div>
                <div className="trace-rules">
                  <ShieldCheck size={17} />
                  <div>
                    <strong>The boundaries stay firm.</strong>
                    <p>
                      Price floor {money(activeLot.floorPrice)}
                      <br />
                      Available stock {activeLot.available} crates
                      <br />
                      Dispatch by {clockTime(activeLot.dispatchBy)}
                    </p>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Impact({ workspace: w }: { workspace: Workspace }) {
  const revenue = w.orders.reduce((s, o) => s + o.total, 0);
  const costs = w.orders.reduce(
    (s, o) =>
      s + o.quantity * (w.lots.find((l) => l.id === o.lotId)?.costPrice || 0),
    0,
  );
  const kg = w.orders.reduce(
    (s, o) =>
      s + o.quantity * (w.lots.find((l) => l.id === o.lotId)?.unitKg || 0),
    0,
  );
  const dispatched = w.orders
    .filter((o) => o.status === "dispatched")
    .reduce((s, o) => s + o.quantity, 0);
  const [price, setPrice] = useState(299),
    [rescues, setRescues] = useState(12),
    [contribution, setContribution] = useState(180),
    [handling, setHandling] = useState(40);
  const modeled = rescues * (contribution - handling) - price;
  return (
    <>
      <PageHeading
        eyebrow="BETTER OUTCOMES, MEASURED HONESTLY"
        title="Recovery that adds up."
        text="Follow the value from a buyer’s acceptance to a confirmed order."
        action={
          <a href="/api/export" download className="button secondary">
            <Download size={16} />
            Export orders
          </a>
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Recovered order value"
          value={money(revenue)}
          detail="Sum of confirmed order totals"
          icon={TrendingUp}
          highlight
        />
        <Metric
          label="Product book cost"
          value={money(costs)}
          detail="Allocated crates × book cost"
          icon={Box}
        />
        <Metric
          label="Gross product spread"
          value={money(revenue - costs)}
          detail="Before delivery, handling and software"
          icon={ArrowUpRight}
        />
        <Metric
          label="Produce allocated"
          value={`${kg} kg`}
          detail={`${dispatched} crates marked dispatched`}
          icon={Leaf}
        />
      </div>
      <div className="impact-columns">
        <section className="panel impact-breakdown">
          <div className="panel-heading">
            <div>
              <h3>Where the value comes from</h3>
              <p>Confirmed sales by recovery lot.</p>
            </div>
            <TrendingUp size={19} />
          </div>
          <div className="lot-bars">
            {w.lots.map((l) => {
              const value = w.orders
                .filter((o) => o.lotId === l.id)
                .reduce((s, o) => s + o.total, 0);
              return (
                <div key={l.id}>
                  <div>
                    <strong>{l.product}</strong>
                    <span>{money(value)}</span>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${Math.min(100, (value / (l.quantity * l.originalPrice || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {l.quantity - l.available} / {l.quantity} crates allocated ·{" "}
                    {money(l.quantity * l.originalPrice)} original order value
                  </small>
                </div>
              );
            })}
          </div>
          <div className="impact-disclaimer">
            <Leaf size={18} />
            <p>
              <strong>Allocated is a meaningful start.</strong> Food waste
              avoided is only established after fulfilled orders and a measured
              baseline. We don’t convert reservations into a carbon claim.
            </p>
          </div>
        </section>
        <section className="roi-panel">
          <span className="eyebrow">COMMERCIAL VIABILITY</span>
          <h2>
            A small recovery.
            <br />A clear return.
          </h2>
          <p>
            Explore a depot’s monthly economics.
            <br />
            These are editable assumptions, not customer results.
          </p>
          <div className="roi-controls">
            <label>
              Recoveries per month<strong>{rescues}</strong>
              <input
                type="range"
                min="1"
                max="40"
                value={rescues}
                onChange={(e) => setRescues(+e.target.value)}
              />
            </label>
            <label>
              Product spread per recovery
              <div>
                <span>£</span>
                <input
                  aria-label="Product spread per recovery"
                  type="number"
                  min="0"
                  max="10000"
                  value={contribution}
                  onChange={(e) => setContribution(+e.target.value)}
                />
              </div>
            </label>
            <label>
              Extra fulfilment per recovery
              <div>
                <span>£</span>
                <input
                  aria-label="Extra fulfilment per recovery"
                  type="number"
                  min="0"
                  max="10000"
                  value={handling}
                  onChange={(e) => setHandling(+e.target.value)}
                />
              </div>
            </label>
            <label>
              Monthly platform fee
              <div>
                <span>£</span>
                <input
                  aria-label="Monthly platform fee"
                  type="number"
                  min="0"
                  max="10000"
                  value={price}
                  onChange={(e) => setPrice(+e.target.value)}
                />
              </div>
            </label>
          </div>
          <div className="roi-result">
            <span>ILLUSTRATIVE MONTHLY CONTRIBUTION</span>
            <strong>{money(modeled)}</strong>
            <p>
              {rescues} × ({money(contribution)} − {money(handling)}) −{" "}
              {money(price)}
              <br />
              Before messaging, AI usage, tax and other overhead.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function Settings({
  data,
  action,
  busy,
  onToast,
}: {
  data: DashboardResponse;
  action: (
    id: string,
    fn: () => Promise<unknown>,
    success?: string,
  ) => Promise<void>;
  busy: string;
  onToast: (s: string) => void;
}) {
  const [wname, setWname] = useState(data.workspace.settings.companyName);
  const [opname, setOpname] = useState(data.workspace.settings.operatorName);
  const [reset, setReset] = useState(false);
  const [autoSend, setAutoSend] = useState(data.workspace.settings.autoSend);
  const [maxDiscount, setMaxDiscount] = useState(
    data.workspace.settings.maxDiscountPercent,
  );
  const runtime = data.runtime;
  return (
    <>
      <PageHeading
        eyebrow="BUILT AROUND YOUR BOUNDARIES"
        title="Your workspace. Your rules."
        text="Configure your workspace and see what is connected."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h3>Workspace details</h3>
          <p>Give your team and buyer communications a familiar identity.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(
                "settings",
                () =>
                  api("/settings", {
                    method: "PATCH",
                    body: {
                      companyName: wname,
                      operatorName: opname,
                      autoSend,
                      maxDiscountPercent: maxDiscount,
                    },
                  }),
                "Workspace details saved.",
              );
            }}
          >
            <label>
              Company name
              <input
                value={wname}
                onChange={(e) => setWname(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label>
              Operator name
              <input
                value={opname}
                onChange={(e) => setOpname(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label>
              Maximum discount from original price (%)
              <input
                type="number"
                min="0"
                max="80"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(+e.target.value)}
                required
              />
            </label>
            {!data.user.isDemo && (
              <>
                <div className="verification-status">
                  <ShieldCheck size={17} />
                  <span>
                    {data.emailVerified
                      ? "Email verified"
                      : "Email verification required before live sending"}
                  </span>
                  {!data.emailVerified && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        action(
                          "verify",
                          () =>
                            api("/auth/send-verification", {
                              method: "POST",
                              body: {},
                            }),
                          "Verification link requested. Check your workspace email.",
                        )
                      }
                      disabled={busy === "verify"}
                    >
                      Send verification
                    </button>
                  )}
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={autoSend}
                    onChange={(e) => setAutoSend(e.target.checked)}
                  />
                  <span>
                    Enable real buyer messages for this workspace. Requires a
                    verified account and server-side AWS channel provisioning.
                  </span>
                </label>
              </>
            )}
            <Button type="submit" busy={busy === "settings"}>
              Save changes
              <Check size={15} />
            </Button>
          </form>
          <div className="setting-note">
            <ShieldCheck size={17} />
            <p>
              Stock, minimum price and cutoff are set per lot. AI cannot bypass
              these rules.
            </p>
          </div>
        </section>
        <section className="panel integrations-panel">
          <h3>Your connections</h3>
          <p>Runtime configuration is managed securely on the server.</p>
          {[
            {
              name: "Amazon SES",
              description: "Order confirmations & email",
              ok: runtime.channels.email,
              icon: Mail,
            },
            {
              name: "AWS End User Messaging Social",
              description: "WhatsApp buyer conversations",
              ok: runtime.channels.whatsapp,
              icon: MessageCircle,
            },
            {
              name: "AWS End User Messaging SMS",
              description: "Text offers & replies",
              ok: runtime.channels.sms,
              icon: MessageCircle,
            },
            {
              name: "Amazon Bedrock",
              description: "Structured buyer intent & tool use",
              ok: runtime.ai === "bedrock",
              icon: Sparkles,
            },
          ].map((c) => (
            <div className="integration" key={c.name}>
              <span className="integration-icon">
                <c.icon size={20} />
              </span>
              <div>
                <strong>{c.name}</strong>
                <small>{c.description}</small>
              </div>
              <span className={`connection ${c.ok ? "connected" : ""}`}>
                {c.ok ? "Configured" : "Not connected"}
              </span>
            </div>
          ))}
          <div className="runtime-details">
            <span>
              <strong>Environment</strong>
              {runtime.mode === "demo" ? "Demo · delivery simulated" : "Live"}
            </span>
            <span>
              <strong>Data store</strong>
              {runtime.storage}
            </span>
            <span>
              <strong>AWS region</strong>
              {runtime.region || "Not configured"}
            </span>
          </div>
          <a
            href="https://github.com/shi1720/AWS-Communication-Developer/blob/main/docs/AWS_DEPLOYMENT.md"
            target="_blank"
            rel="noreferrer"
            className="text-button"
          >
            View connection guide
            <ExternalLink size={14} />
          </a>
        </section>
      </div>
      <section className="panel reset-panel">
        <div>
          <h3>Keep your operational record.</h3>
          <p>
            Download your complete workspace, including orders, conversations
            and audit history. Login credentials are excluded.
          </p>
        </div>
        <a
          href="/api/export/archive"
          className="button secondary"
          download="secondcrate-workspace.json"
        >
          <Download size={16} />
          Export workspace
        </a>
      </section>
      {data.user.isDemo && (
        <section className="panel reset-panel">
          <div>
            <h3>A clean slate for the next demo.</h3>
            <p>
              Reset this isolated sandbox to its original lots and buyer
              profiles.
            </p>
          </div>
          {reset ? (
            <div className="reset-confirm">
              <span>Remove this sandbox’s orders and conversations?</span>
              <Button
                variant="danger"
                onClick={() =>
                  action(
                    "reset",
                    async () => {
                      await api("/demo/reset", { method: "POST", body: {} });
                      setReset(false);
                    },
                    "Demo workspace reset.",
                  )
                }
                busy={busy === "reset"}
              >
                Reset this sandbox
              </Button>
              <button className="text-button" onClick={() => setReset(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setReset(true)}>
              <RefreshCw size={15} />
              Reset demo
            </Button>
          )}
        </section>
      )}
    </>
  );
}

function NewLot({
  initialSource = "",
  onClose,
  onCreated,
}: {
  initialSource?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [source, setSource] = useState(initialSource),
    [extracting, setExtracting] = useState(false),
    [draft, setDraft] = useState<Partial<Lot>>({
      product: "",
      category: "produce",
      quantity: 40,
      unitKg: 5,
      originalPrice: 24,
      offerPrice: 18,
      floorPrice: 16,
      costPrice: 12,
      description: "",
    });
  const localDate = (offset: number) => {
    const d = new Date(Date.now() + offset * 3600000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (extracting || busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("/lots", {
        method: "POST",
        body: {
          ...draft,
          sourceText: source,
          dispatchBy: new Date(String(f.get("dispatchBy"))).toISOString(),
          deliveryBy: new Date(String(f.get("deliveryBy"))).toISOString(),
          safetyAttested: f.get("safety") === "on",
        },
      });
      await onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function extract() {
    setExtracting(true);
    setError("");
    try {
      const r = await api<{ draft: Partial<Lot> }>("/lots/extract", {
        method: "POST",
        body: { text: source },
      });
      setDraft((p) => ({
        ...p,
        ...Object.fromEntries(
          Object.entries(r.draft).filter(
            ([key, value]) =>
              value !== undefined &&
              [
                "product",
                "category",
                "quantity",
                "unitKg",
                "originalPrice",
                "offerPrice",
                "floorPrice",
              ].includes(key),
          ),
        ),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  }
  return (
    <Modal
      title="Give a lot a second chance."
      subtitle="Set the boundaries. SecondCrate will find the conversation."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="lot-form">
        <div className="intake-box">
          <div>
            <Mail size={19} />
            <strong>Start with a cancellation</strong>
            <span>Optional</span>
          </div>
          <textarea
            aria-label="Cancellation email text"
            placeholder="Paste the cancellation email here, or enter the lot details below…"
            value={source}
            disabled={extracting || busy}
            onChange={(e) => setSource(e.target.value)}
            maxLength={10000}
          />
          <Button
            variant="small secondary"
            onClick={extract}
            disabled={source.trim().length < 10 || busy}
            busy={extracting}
          >
            <Sparkles size={14} />
            Extract a draft
          </Button>
          <small>Always review extracted details before releasing stock.</small>
        </div>
        <fieldset
          className="form-grid lot-fields"
          disabled={extracting || busy}
        >
          <label className="span-2">
            Product
            <input
              value={draft.product || ""}
              onChange={(e) => setDraft({ ...draft, product: e.target.value })}
              placeholder="e.g. Cherry tomatoes"
              required
              maxLength={120}
            />
          </label>
          <label>
            Category
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              <option value="produce">Produce</option>
              <option value="bakery">Bakery</option>
              <option value="dairy">Dairy</option>
              <option value="pantry">Pantry</option>
            </select>
          </label>
          <label>
            Quantity (crates)
            <input
              type="number"
              value={draft.quantity}
              onChange={(e) =>
                setDraft({ ...draft, quantity: +e.target.value })
              }
              min="1"
              max="10000"
              required
            />
          </label>
          <label>
            Weight per crate (kg)
            <input
              type="number"
              value={draft.unitKg}
              onChange={(e) => setDraft({ ...draft, unitKg: +e.target.value })}
              min="0.1"
              max="1000"
              step="0.1"
              required
            />
          </label>
          {(
            [
              { key: "originalPrice", label: "Original price / crate (£)" },
              { key: "offerPrice", label: "Opening offer / crate (£)" },
              { key: "floorPrice", label: "Minimum price / crate (£)" },
              { key: "costPrice", label: "Book cost / crate (£)" },
            ] as const
          ).map(({ key, label }) => (
            <label key={key}>
              {label}
              <input
                type="number"
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: +e.target.value })}
                min="0.01"
                max="100000"
                step="0.01"
                required
              />
            </label>
          ))}
          <label>
            Dispatch cutoff
            <input
              name="dispatchBy"
              type="datetime-local"
              defaultValue={localDate(2)}
              required
            />
          </label>
          <label>
            Delivery available by
            <input
              name="deliveryBy"
              type="datetime-local"
              defaultValue={localDate(3)}
              required
            />
          </label>
          <p className="form-timezone-note span-2">
            Enter dates in your device time zone (
            {Intl.DateTimeFormat().resolvedOptions().timeZone}). Saved dispatch
            and delivery times are shown in London time.
          </p>
          <label className="span-2">
            Product and handling notes
            <textarea
              value={draft.description || ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Variety, pack specification, known handling requirements…"
              maxLength={2000}
            />
          </label>
        </fieldset>
        <label className="checkbox-label">
          <input type="checkbox" name="safety" required />
          <span>
            I have verified this quantity is available, released for sale and
            suitable for the stated delivery window. SecondCrate does not assess
            food safety.
          </span>
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={extracting}>
            Create recovery
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function LotDetail({
  lot: l,
  workspace: w,
  onClose,
  onLaunch,
  onConversations,
  onCloseLot,
  busy,
}: {
  lot: Lot;
  workspace: Workspace;
  onClose: () => void;
  onLaunch: (l: Lot) => void;
  onConversations: (l: Lot) => void;
  onCloseLot: (id: string) => void;
  busy: string;
}) {
  const orders = w.orders.filter((o) => o.lotId === l.id);
  return (
    <Modal
      title={l.product}
      subtitle={`${l.reference} · ${l.source || "Operator intake"}`}
      onClose={onClose}
      wide
    >
      <div className="lot-detail">
        <div className="lot-detail-top">
          <div className="detail-illustration">
            <Produce compact />
          </div>
          <div>
            <Status status={l.status} />
            <h2>
              {l.available}
              <span> / {l.quantity} crates</span>
            </h2>
            <p>available for a second destination</p>
            <div className="stock-meter">
              <span
                style={{
                  width: `${((l.quantity - l.available) / l.quantity) * 100}%`,
                }}
              />
            </div>
            <small>
              {l.quantity - l.available} crates allocated · {l.unitKg} kg per
              crate
            </small>
          </div>
        </div>
        <div className="detail-stats">
          <div>
            <span>Opening offer</span>
            <strong>
              {money(l.offerPrice)}
              <small>/ crate</small>
            </strong>
          </div>
          <div>
            <span>Minimum price</span>
            <strong>
              {money(l.floorPrice)}
              <small>/ crate</small>
            </strong>
          </div>
          <div>
            <span>Dispatch cutoff · London</span>
            <strong>{clockTime(l.dispatchBy)}</strong>
          </div>
          <div>
            <span>Delivery by · London</span>
            <strong>{clockTime(l.deliveryBy)}</strong>
          </div>
        </div>
        {l.description && (
          <div className="detail-notes">
            <h4>Product & handling notes</h4>
            <p>{l.description}</p>
          </div>
        )}
        <div className="detail-notes">
          <h4>Source note</h4>
          <p>{l.sourceText || "Manually verified stock release."}</p>
        </div>
        <div className="attestation">
          <ShieldCheck size={17} />
          {l.safetyAttested
            ? "Stock release and product suitability verified by the operator."
            : "Stock release still needs operator verification."}
        </div>
        {orders.length > 0 && (
          <div className="detail-orders">
            <h4>Confirmed buyers</h4>
            {orders.map((o) => (
              <div key={o.id}>
                <span>{w.buyers.find((b) => b.id === o.buyerId)?.name}</span>
                <span>{o.quantity} crates</span>
                <strong>{money(o.total)}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          {l.status !== "closed" && (
            <Button
              variant="subtle"
              onClick={() => onCloseLot(l.id)}
              busy={busy === `close-${l.id}`}
            >
              Close recovery
            </Button>
          )}
          <Button
            onClick={() =>
              l.status === "draft" ? onLaunch(l) : onConversations(l)
            }
            busy={busy === `launch-${l.id}`}
          >
            {l.status === "draft"
              ? "Find a second buyer"
              : "Open conversations"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function HowItWorks({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <Modal
      title="A better ending starts here."
      subtitle="SecondCrate turns a cancelled order into a coordinated recovery."
      onClose={onClose}
      wide
    >
      <div className="how-content">
        <div className="how-story">
          <Produce />
          <div>
            <span className="eyebrow">THE 40-CRATE CHALLENGE</span>
            <h2>
              The truck leaves soon.
              <br />
              The tomatoes are still good.
            </h2>
            <p>
              A restaurant cancels. Instead of a phone tree, SecondCrate works
              with the buyers you already trust.
            </p>
          </div>
        </div>
        <div className="how-steps">
          {[
            {
              n: "01",
              icon: Box,
              title: "Release the lot",
              text: "Verify the stock. Set the minimum price and dispatch window.",
            },
            {
              n: "02",
              icon: MessageCircle,
              title: "Find the conversation",
              text: "Match opted-in buyers. Continue naturally across WhatsApp, SMS and email.",
            },
            {
              n: "03",
              icon: ShieldCheck,
              title: "Keep every promise",
              text: "Check requests against real stock. Allocate once. Confirm the order.",
            },
          ].map((s) => (
            <div key={s.n}>
              <span>{s.n}</span>
              <s.icon size={22} />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
        <div className="how-disclosure">
          <Sparkles size={17} />
          <p>
            The interactive demo uses synthetic buyers and simulated messaging.
            AWS integrations are configured separately; connection status is
            always visible in Settings.
          </p>
        </div>
        <div className="modal-actions">
          <Button onClick={onStart}>
            Try a buyer conversation
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
