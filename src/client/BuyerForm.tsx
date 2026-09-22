import { useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import type { Buyer, Channel } from "../shared/types";
import { api } from "./api";
import { Button, Modal } from "./ui";

export default function BuyerForm({
  buyer,
  onClose,
  onCreated,
}: {
  buyer?: Buyer;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState<Channel>(buyer?.channel || "email");
  const [consent, setConsent] = useState(!!buyer?.consent && !buyer.optedOut);
  // Re-enabling a suppressed contact requires a new recorded source, not a generic confirmation.
  const [consentSource, setConsentSource] = useState(
    buyer?.consent && !buyer.optedOut ? buyer.consentSource || "" : "",
  );
  function contactChanged() {
    if (buyer) {
      setConsent(false);
      setConsentSource("");
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const categories = f.getAll("category").map(String);
    if (!categories.length) {
      setError("Choose at least one buying category.");
      setBusy(false);
      return;
    }
    try {
      await api(buyer ? `/buyers/${buyer.id}` : "/buyers", {
        method: buyer ? "PATCH" : "POST",
        body: {
          name: f.get("name"),
          contact: f.get("contact"),
          email: f.get("email"),
          phone: f.get("phone"),
          channel,
          maxCrates: Number(f.get("maxCrates")),
          distanceKm: Number(f.get("distanceKm")),
          deliveryBefore: f.get("deliveryBefore"),
          categories,
          consent,
          optedOut: !consent,
          consentSource: consentSource.trim(),
          ...(consent
            ? {
                consentAt:
                  buyer?.consent &&
                  !buyer.optedOut &&
                  buyer.channel === channel &&
                  buyer.email === f.get("email") &&
                  buyer.phone === f.get("phone") &&
                  buyer.consentSource === consentSource
                    ? buyer.consentAt || new Date().toISOString()
                    : new Date().toISOString(),
              }
            : {}),
        },
      });
      await onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        buyer ? "A relationship, kept current." : "Add a buyer to your corner."
      }
      subtitle="Record buying preferences and permission for the selected channel."
      onClose={onClose}
    >
      <form className="buyer-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="span-2">
            Business name
            <input
              name="name"
              defaultValue={buyer?.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            Contact name
            <input
              name="contact"
              defaultValue={buyer?.contact}
              required
              maxLength={100}
            />
          </label>
          <label>
            Preferred channel
            <select
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as Channel);
                setConsent(false);
                setConsentSource("");
              }}
            >
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label>
            Email {channel !== "email" && "(optional)"}
            <input
              type="email"
              name="email"
              defaultValue={buyer?.email || ""}
              onChange={contactChanged}
              required={channel === "email"}
              maxLength={254}
            />
          </label>
          <label>
            Phone {channel === "email" && "(optional)"}
            <input
              name="phone"
              defaultValue={buyer?.phone || ""}
              onChange={contactChanged}
              placeholder="+44…"
              pattern="\+[1-9][0-9]{7,14}"
              required={channel !== "email"}
            />
          </label>
          <fieldset className="category-fieldset span-2">
            <legend>Buying categories</legend>
            <div>
              {["produce", "bakery", "dairy", "pantry"].map((category) => (
                <label key={category}>
                  <input
                    type="checkbox"
                    name="category"
                    value={category}
                    defaultChecked={
                      buyer
                        ? buyer.categories.some(
                            (value) => value.toLowerCase() === category,
                          )
                        : category === "produce"
                    }
                  />
                  {category}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Capacity per lot (crates)
            <input
              type="number"
              name="maxCrates"
              min="1"
              max="10000"
              defaultValue={buyer?.maxCrates || 20}
              required
            />
          </label>
          <label>
            Route distance (km)
            <input
              type="number"
              name="distanceKm"
              min="0"
              max="500"
              step="0.1"
              defaultValue={buyer?.distanceKm ?? 5}
              required
            />
          </label>
          <label>
            Delivery deadline (London)
            <input
              type="time"
              name="deliveryBefore"
              defaultValue={buyer?.deliveryBefore || "18:00"}
              required
            />
          </label>
          <label className="span-2">
            Consent record
            <input
              value={consentSource}
              onChange={(e) => setConsentSource(e.target.value)}
              required={consent}
              maxLength={500}
              placeholder="Opt-in source, date and agreed channel"
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            This buyer has explicitly agreed to receive surplus offers through{" "}
            {channel === "whatsapp"
              ? "WhatsApp"
              : channel === "sms"
                ? "SMS"
                : "email"}
            . Unchecked keeps outreach paused.
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
          <Button type="submit" busy={busy}>
            {buyer ? "Save buyer" : "Add buyer"}
            {buyer ? <Check size={15} /> : <Plus size={15} />}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
