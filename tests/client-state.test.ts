// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Modal } from "../src/client/ui";
import RaceProof from "../src/client/RaceProof";
import BuyerForm from "../src/client/BuyerForm";
import { createWorkspace } from "../src/server/seed";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;
function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  return root;
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

describe("operator interaction state", () => {
  it("keeps keyboard focus in a dialog when a parent refresh changes the close callback", async () => {
    const view = mount();
    const input = createElement("input", { "aria-label": "Buyer name" });
    await act(async () =>
      view.render(
        createElement(Modal, {
          title: "Edit buyer",
          onClose: vi.fn(),
          children: input,
        }),
      ),
    );
    const field = container.querySelector("input")!;
    field.focus();
    await act(async () =>
      view.render(
        createElement(Modal, {
          title: "Edit buyer",
          onClose: vi.fn(),
          children: input,
        }),
      ),
    );
    expect(document.activeElement).toBe(field);
  });
  it("preserves the displayed race's starting stock and two buyers after the workspace refreshes", async () => {
    const workspace = createWorkspace("Demo", true);
    workspace.lots[0].available = 8;
    workspace.lots[0].status = "recovering";
    workspace.offers = workspace.buyers.slice(0, 2).map((b, i) => ({
      id: `o${i}`,
      lotId: workspace.lots[0].id,
      buyerId: b.id,
      quantity: 8,
      unitPrice: 18,
      status: "sent" as const,
      createdAt: new Date().toISOString(),
    }));
    const view = mount();
    const callbacks = {
      onClose: vi.fn(),
      onRefresh: vi.fn().mockResolvedValue(undefined),
    };
    await act(async () =>
      view.render(
        createElement(RaceProof, {
          workspace,
          lot: workspace.lots[0],
          ...callbacks,
        }),
      ),
    );
    const next = structuredClone(workspace);
    next.lots[0].available = 0;
    next.lots[0].status = "recovered";
    next.offers = [];
    await act(async () =>
      view.render(
        createElement(RaceProof, {
          workspace: next,
          lot: next.lots[0],
          ...callbacks,
        }),
      ),
    );
    expect(container.querySelector(".race-hero strong")?.textContent).toBe(
      "8 crates",
    );
    expect(container.querySelectorAll(".race-buyers>div")).toHaveLength(2);
  });
  it("requires consent to be recorded again when changing a buyer's outreach channel", async () => {
    const buyer = createWorkspace("Demo", true).buyers[0];
    const view = mount();
    await act(async () =>
      view.render(
        createElement(BuyerForm, {
          buyer,
          onClose: vi.fn(),
          onCreated: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    );
    const select = container.querySelector("select")!;
    expect(
      container.querySelector<HTMLInputElement>(".checkbox-label input")!
        .checked,
    ).toBe(true);
    await act(async () => {
      select.value = "email";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(
      container.querySelector<HTMLInputElement>(".checkbox-label input")!
        .checked,
    ).toBe(false);
    expect(
      container.querySelector<HTMLInputElement>(
        'input[placeholder="Opt-in source, date and agreed channel"]',
      )!.value,
    ).toBe("");
  });
});
