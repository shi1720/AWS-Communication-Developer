import { useState, type FormEvent } from "react";
import { AlertCircle, Check, Mail, RefreshCw } from "lucide-react";
import type { Workspace, Message } from "../shared/types";
import { api, clockTime } from "./api";
import { Button, Modal } from "./ui";

export default function OperationsPanel({
  workspace: w,
  isDemo,
  onRefresh,
  onReviewSource,
}: {
  workspace: Workspace;
  isDemo: boolean;
  onRefresh: () => Promise<unknown>;
  onReviewSource: (source: string) => void;
}) {
  const [selected, setSelected] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [outcome, setOutcome] = useState<"sent" | "failed">("sent");
  const unknown = w.messages.filter(
    (m) => m.direction === "outbound" && m.status === "unknown",
  );
  const queued = w.messages.filter((m) => m.status === "queued");
  const sources = w.events.filter(
    (e) =>
      e.type === "cancellation_received" &&
      typeof e.metadata?.sourceText === "string" &&
      !w.lots.some((l) => l.sourceText === e.metadata!.sourceText),
  );
  async function drain() {
    setBusy(true);
    setError("");
    setResult("");
    try {
      await api("/outbox/flush", { method: "POST", body: {} });
      await onRefresh();
      setResult(
        "Queued messages processed. Check individual delivery states below.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reconcile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api(`/messages/${selected.id}/reconcile`, {
        method: "POST",
        body: {
          outcome,
          evidence: f.get("evidence"),
          ...(outcome === "sent" ? { providerId: f.get("providerId") } : {}),
        },
      });
      await onRefresh();
      setSelected(null);
      setResult("Operator reconciliation recorded in the audit trail.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {(sources.length > 0 || unknown.length > 0 || queued.length > 0) && (
        <section className="panel operations-panel">
          <div className="panel-heading">
            <div>
              <h3>Needs your attention</h3>
              <p>Review incoming sources and message outcomes before acting.</p>
            </div>
            <AlertCircle size={22} />
          </div>
          {sources.map((e) => (
            <div className="operations-row" key={e.id}>
              <Mail size={19} />
              <div>
                <strong>{e.detail}</strong>
                <p>
                  Cancellation received · {clockTime(e.at)} London · stock
                  release still required
                </p>
              </div>
              <Button
                variant="small secondary"
                onClick={() => onReviewSource(String(e.metadata!.sourceText))}
              >
                Review source
              </Button>
            </div>
          ))}
          {unknown.map((m) => (
            <div className="operations-row" key={m.id}>
              <AlertCircle size={19} />
              <div>
                <strong>
                  {w.buyers.find((b) => b.id === m.buyerId)?.name || "Buyer"} ·
                  send outcome unknown
                </strong>
                <p>
                  {m.channel} · {clockTime(m.createdAt)} London · check provider
                  records before resolving
                </p>
              </div>
              {!isDemo && (
                <Button
                  variant="small secondary"
                  onClick={() => {
                    setSelected(m);
                    setOutcome("sent");
                    setError("");
                  }}
                >
                  Reconcile
                </Button>
              )}
            </div>
          ))}
          {queued.length > 0 && (
            <div className="operations-row">
              <RefreshCw size={19} />
              <div>
                <strong>{queued.length} queued messages</strong>
                <p>All consent, sending and channel checks still apply.</p>
              </div>
              <Button variant="small secondary" onClick={drain} busy={busy}>
                Process queue
              </Button>
            </div>
          )}
        </section>
      )}
      {result && (
        <div className="attestation" role="status">
          <Check size={17} />
          {result}
        </div>
      )}
      {error && !selected && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {selected && (
        <Modal
          title="Resolve an uncertain send."
          subtitle="Use provider records to establish what happened. This action never resends the message."
          onClose={() => setSelected(null)}
        >
          <form className="buyer-form" onSubmit={reconcile}>
            <div className="detail-notes">
              <p>{selected.text}</p>
            </div>
            <label>
              Confirmed provider outcome
              <select
                value={outcome}
                onChange={(e) =>
                  setOutcome(e.target.value as "sent" | "failed")
                }
              >
                <option value="sent">Provider accepted the message</option>
                <option value="failed">
                  Provider confirms the send failed
                </option>
              </select>
            </label>
            {outcome === "sent" && (
              <label>
                Provider message ID
                <input
                  name="providerId"
                  required
                  minLength={1}
                  maxLength={256}
                  placeholder="Exact ID from the provider event or record"
                />
              </label>
            )}
            <label>
              Evidence reference
              <textarea
                name="evidence"
                required
                minLength={20}
                maxLength={2000}
                placeholder="Record reference, outcome and time checked. Do not paste credentials or personal data."
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" required />
              <span>
                I have checked the external provider record. This will be
                recorded as my operator report; SecondCrate does not
                independently verify this evidence.
              </span>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Record outcome
                <Check size={15} />
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
