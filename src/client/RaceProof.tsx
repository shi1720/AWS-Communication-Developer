import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { AgentResult, Lot, Workspace } from "../shared/types";
import { api, money } from "./api";
import { Modal } from "./ui";
export default function RaceProof({
  workspace,
  lot: initialLot,
  onClose,
  onRefresh,
}: {
  workspace: Workspace;
  lot: Lot;
  onClose: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  const [lot] = useState(initialLot);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<
    { name: string; result?: AgentResult; error?: string }[]
  >([]);
  const [verified, setVerified] = useState<Workspace | null>(null);
  const [candidates] = useState(() =>
    workspace.buyers
      .filter(
        (b) =>
          b.consent &&
          !b.optedOut &&
          b.maxCrates >= lot.available &&
          workspace.offers.some(
            (o) =>
              o.buyerId === b.id &&
              o.lotId === lot.id &&
              ["sent", "negotiating"].includes(o.status),
          ),
      )
      .slice(0, 2),
  );
  async function run() {
    setRunning(true);
    const results = await Promise.allSettled(
      candidates.map((b) =>
        api<{ workspace: Workspace; result: AgentResult }>("/inbound", {
          method: "POST",
          body: {
            buyerId: b.id,
            lotId: lot.id,
            channel: b.channel,
            text: `I will take ${lot.available} crates at £${lot.offerPrice} each.`,
            eventId: crypto.randomUUID(),
          },
        }),
      ),
    );
    setOutcomes(
      results.map((r, i) =>
        r.status === "fulfilled"
          ? { name: candidates[i].name, result: r.value.result }
          : { name: candidates[i].name, error: (r.reason as Error).message },
      ),
    );
    try {
      const state = await api<{ workspace: Workspace }>("/dashboard");
      setVerified(state.workspace);
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }
  const current = verified?.lots.find((l) => l.id === lot.id);
  const total = verified?.orders
    .filter((o) => o.lotId === lot.id)
    .reduce((s, o) => s + o.quantity, 0);
  return (
    <Modal
      title="One lot. Two buyers. One truth."
      subtitle="A real concurrency test inside this demo workspace."
      onClose={() => {
        if (!running) onClose();
      }}
      wide
    >
      <div className="race-content">
        <div className="race-hero">
          <span>
            <Zap size={30} />
          </span>
          <div>
            <strong>{lot.available} crates</strong>
            <p>
              Two buyers each request the entire remaining stock,
              simultaneously.
            </p>
          </div>
        </div>
        <div className="race-buyers">
          {candidates.map((b, i) => (
            <div key={b.id}>
              <span>REQUEST {i + 1}</span>
              <h3>{b.name}</h3>
              <p>
                “I’ll take {lot.available} crates at {money(lot.offerPrice)}{" "}
                each.”
              </p>
            </div>
          ))}
        </div>
        <div className="race-disclosure">
          <ShieldCheck size={18} />
          <p>
            This sends two parallel API requests and creates actual sandbox
            orders. The database version check must allow at most one complete
            allocation.
          </p>
        </div>
        {error && (
          <div className="form-error" role="alert">
            Could not reload persisted results: {error}. Open the recovery to
            inspect the saved state.
          </div>
        )}
        {outcomes.map((o, i) => (
          <div className="race-outcome" key={i}>
            <strong>{o.name}</strong>
            <p>{o.result?.reply || o.error}</p>
            {o.result?.steps
              .filter(
                (s) => s.tool === "allocate_stock" || s.status === "blocked",
              )
              .map((s, j) => (
                <small key={j}>{s.summary}</small>
              ))}
          </div>
        ))}
        {verified && (
          <div
            className={`race-verdict ${current?.available === 0 && total === lot.quantity ? "passed" : "attention"}`}
          >
            <CheckCircle2 size={23} />
            <div>
              <strong>
                {current?.available === 0 && total === lot.quantity
                  ? "Stock integrity verified"
                  : "Inspect the recorded outcomes"}
              </strong>
              <p>
                {total} / {lot.quantity} total crates allocated.{" "}
                {current?.available} remain. Calculated from persisted orders
                after both responses.
              </p>
            </div>
          </div>
        )}
        <div className="modal-actions">
          {outcomes.length ? (
            <button className="button" onClick={onClose}>
              Back to the recovery
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="button"
              onClick={run}
              disabled={running || candidates.length !== 2}
            >
              {running ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Zap size={16} />
              )}
              Send both requests simultaneously
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
