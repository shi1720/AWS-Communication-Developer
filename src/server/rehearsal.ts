import type {
  AgentContext,
  AgentDecision,
  ReasoningAdapter,
} from "../shared/types.js";
/** Deliberately narrow offline interpreter, always identified as rehearsal in responses. */
export class RehearsalReasoningAdapter implements ReasoningAdapter {
  async decide({ text, lot }: AgentContext) {
    const value = text
      .normalize("NFKC")
      .replace(/[’‘]/g, "\'")
      .replace(/−/g, "-")
      .toLowerCase()
      .trim();
    let decision: AgentDecision = { intent: "unknown" };
    if (
      /\b(stop|unsubscribe|opt[ -]?out|do not contact|don't contact)\b/.test(
        value,
      )
    ) {
      decision = { intent: "opt_out" };
    } else if (
      /\b(no thanks|decline|not interested|pass on|can't take|cannot take|don't want|do not want)\b/.test(
        value,
      )
    ) {
      decision = { intent: "decline" };
    } else {
      const price =
        value.match(/(?:£|gbp\s*)(\d+(?:\.\d+)?)/) ||
        value.match(/(?:at|for|do)\s+(\d+(?:\.\d+)?)\s*(?:each|per|a crate)/);
      const count =
        value.match(
          /(?:take|buy|book|reserve|want|need|yes[, ]*)\s*(\d+(?:\.\d+)?)/,
        ) || value.match(/(\d+(?:\.\d+)?)\s*crates?/);
      const quantity = /\b(the rest|all remaining|remaining stock)\b/.test(
        value,
      )
        ? lot.available
        : count
          ? Number(count[1])
          : undefined;
      const delivery = value.match(
        /(?:deliver(?:y)?(?:\s+it)?\s+)?before\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
      );
      const hour = delivery
        ? Number(delivery[1]) +
          (delivery[3] === "pm" && Number(delivery[1]) < 12 ? 12 : 0)
        : undefined;
      const deliveryBefore =
        hour !== undefined
          ? `${String(hour).padStart(2, "0")}:${delivery?.[2] || "00"}`
          : undefined;
      const firmCommitment =
        /\b(i(?:'ll| will| can| would like to)?\s+take|i\s+(?:want|need)|book|confirm|buy|reserve)\b/.test(
          value,
        ) || /^(?:take|yes[, ]|\d+\s*crates?\s*(?:at|for|£|$))/.test(value);
      const needsClarification =
        /\b(organic|allergen|safe|quality|gluten|vegan|fresh|halal|kosher|kg|kilograms?)\b/.test(
          value,
        ) ||
        /-\s*\d/.test(value) ||
        (/\b(if|provided|assuming|unless)\b/.test(value) &&
          !delivery &&
          !price);
      if (needsClarification) decision = { intent: "question" };
      else if (quantity !== undefined || price) {
        const request =
          /\b(can you|could you|would you|best price|offer me)\b/.test(value);
        const intent = firmCommitment
          ? "accept"
          : request || (price && quantity === undefined)
            ? "negotiate"
            : "question";
        decision = {
          intent,
          quantity,
          unitPrice: price ? Number(price[1]) : undefined,
          deliveryBefore,
        };
      } else if (
        /^(yes(?:,?\s+please)?|confirmed|confirm|accept|deal)[!.]?$/.test(value)
      ) {
        decision = { intent: "accept" };
      } else if (
        value.includes("?") ||
        /\b(how|what|when|available|price|delivery)\b/.test(value)
      ) {
        decision = { intent: "question" };
      }
    }
    return { decision, model: "rehearsal / deterministic interpreter" };
  }
}
