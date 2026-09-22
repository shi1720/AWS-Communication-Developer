// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/client/App";
import BuyerForm from "../src/client/BuyerForm";
import { api, ApiError } from "../src/client/api";
import { createWorkspace } from "../src/server/seed";
import type { DashboardResponse, SessionUser } from "../src/shared/types";

vi.mock("../src/client/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/client/api")>()),
  api: vi.fn(),
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;
const mockedApi = vi.mocked(api);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function fixture(name: string): DashboardResponse {
  const workspace = createWorkspace(name, true);
  workspace.settings.companyName = name;
  const user: SessionUser = {
    id: `user-${name}`,
    name,
    email: `${name.toLowerCase()}@example.com`,
    workspaceId: workspace.id,
    isDemo: true,
  };
  return {
    workspace,
    user,
    emailVerified: false,
    runtime: {
      mode: "demo",
      ai: "rehearsal",
      storage: "memory",
      channels: { email: false, sms: false, whatsapp: false },
      region: "eu-west-2",
    },
  };
}
async function mount(element: ReactNode = createElement(App)) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(element);
  });
}
async function click(selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  await act(async () => {
    button!.click();
  });
}
async function clickText(text: string) {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((element) => element.textContent?.trim() === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  history.replaceState({}, "", "/");
  mockedApi.mockReset();
});

describe("session transitions protect workspace data", () => {
  it("requires draft extraction to finish before the operator edits or creates a lot", async () => {
    const current = fixture("Intake Depot");
    const extraction = deferred<{
      draft: { product: string; quantity: number };
    }>();
    mockedApi.mockImplementation(((path: string) => {
      if (path === "/session") return Promise.resolve({ user: current.user });
      if (path === "/dashboard") return Promise.resolve(current);
      if (path === "/lots/extract") return extraction.promise;
      throw new Error(`Unexpected request ${path}`);
    }) as typeof api);
    await mount();
    await clickText("New recovery");
    const source = container.querySelector<HTMLTextAreaElement>(
      '[aria-label="Cancellation email text"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(source, "Cancelled: 12 crates of peppers, 5 kg each.");
      source.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await clickText("Extract a draft");
    expect(
      container.querySelector<HTMLFieldSetElement>(".lot-fields")?.disabled,
    ).toBe(true);
    expect(source.disabled).toBe(true);
    expect(
      container.querySelector<HTMLButtonElement>(
        '.lot-form button[type="submit"]',
      )?.disabled,
    ).toBe(true);
    expect(container.textContent).toContain(
      "Enter dates in your device time zone",
    );
    await act(async () =>
      extraction.resolve({ draft: { product: "Peppers", quantity: 12 } }),
    );
    expect(
      container.querySelector<HTMLFieldSetElement>(".lot-fields")?.disabled,
    ).toBe(false);
    expect(
      container.querySelector<HTMLInputElement>(
        'input[placeholder="e.g. Cherry tomatoes"]',
      )?.value,
    ).toBe("Peppers");
  });
  it("closes mobile navigation on Settings selection and supports backdrop and Escape dismissal", async () => {
    const current = fixture("Mobile Depot");
    mockedApi.mockImplementation(((path: string) =>
      Promise.resolve(
        path === "/session" ? { user: current.user } : current,
      )) as typeof api);
    await mount();
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Open navigation"]',
    )!;
    trigger.focus();
    await click('[aria-label="Open navigation"]');
    expect(
      container.querySelector('[role="dialog"]')?.getAttribute("aria-label"),
    ).toBe("Workspace navigation");
    expect(document.body.style.overflow).toBe("hidden");
    await clickText("Settings");
    expect(container.querySelector(".sidebar.open")).toBeNull();
    expect(container.textContent).toContain("Your workspace. Your rules.");
    expect(document.activeElement).toBe(trigger);
    await click('[aria-label="Open navigation"]');
    await click('[aria-label="Dismiss navigation"]');
    expect(container.querySelector(".sidebar.open")).toBeNull();
    await click('[aria-label="Open navigation"]');
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(container.querySelector(".sidebar.open")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
  it("reuses the inbound event ID after a lost response and does not restore a processed reply after refresh fails", async () => {
    const current = fixture("Recovery Depot");
    current.workspace.lots[0].status = "recovering";
    const requests: Array<Record<string, unknown>> = [];
    let processed = false;
    mockedApi.mockImplementation(((
      path: string,
      options?: { body?: unknown },
    ) => {
      if (path === "/session") return Promise.resolve({ user: current.user });
      if (path === "/dashboard")
        return processed
          ? Promise.reject(new Error("Connection interrupted"))
          : Promise.resolve(current);
      if (path === "/inbound") {
        requests.push(options?.body as Record<string, unknown>);
        if (requests.length === 1)
          return Promise.reject(new Error("Response lost"));
        processed = true;
        return Promise.resolve({
          workspace: current.workspace,
          result: { model: "test", steps: [] },
        });
      }
      throw new Error(`Unexpected request ${path}`);
    }) as typeof api);
    await mount();
    await clickText("Conversations");
    const reply = "I can take 12 crates at £17 each.";
    await clickText(reply);
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Buyer reply"]')
        ?.value,
    ).toBe(reply);
    await click('[aria-label="Send buyer reply"]');
    expect(requests).toHaveLength(2);
    expect(requests[1].eventId).toBe(requests[0].eventId);
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Buyer reply"]')
        ?.value,
    ).toBe("");
    expect(container.textContent).toContain(
      "Your reply was processed, but the latest workspace could not be loaded.",
    );
  });
  it("ignores a dashboard response from the previous account after logout and a new login", async () => {
    const alpha = fixture("Alpha Depot");
    const beta = fixture("Beta Depot");
    const stale = deferred<DashboardResponse>();
    let dashboards = 0;
    mockedApi.mockImplementation(((path: string) => {
      if (path === "/session") return Promise.resolve({ user: alpha.user });
      if (path === "/auth/logout") return Promise.resolve({ ok: true });
      if (path === "/auth/demo") return Promise.resolve({ user: beta.user });
      if (path === "/dashboard")
        return dashboards++ === 0 ? stale.promise : Promise.resolve(beta);
      throw new Error(`Unexpected request ${path}`);
    }) as typeof api);
    await mount();
    await click('[aria-label="Sign out"]');
    await click(".demo-entry");
    expect(container.textContent).toContain("Beta Depot");
    await act(async () => stale.resolve(alpha));
    expect(container.textContent).toContain("Beta Depot");
    expect(container.textContent).not.toContain("Alpha Depot");
  });
  it("returns to sign-in after password reset invalidates the current session", async () => {
    const current = fixture("Current Depot");
    let sessions = 0;
    history.replaceState({}, "", "/?reset=a-valid-reset-token-for-test");
    mockedApi.mockImplementation(((path: string) => {
      if (path === "/session")
        return Promise.resolve({
          user: sessions++ === 0 ? current.user : null,
        });
      if (path === "/dashboard") return Promise.resolve(current);
      if (path === "/auth/reset-password") return Promise.resolve({ ok: true });
      throw new Error(`Unexpected request ${path}`);
    }) as typeof api);
    await mount();
    expect(container.textContent).toContain("A fresh start for your password.");
    await act(async () => {
      const password = container.querySelector<HTMLInputElement>(
        'input[name="password"]',
      )!;
      password.value = "New-password-123";
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(container.textContent).toContain("Your password is reset.");
    await click(".account-action section > button");
    expect(container.textContent).toContain("Sign in");
    expect(container.querySelector('[aria-label="Sign out"]')).toBeNull();
    expect(container.textContent).not.toContain("Current Depot");
  });
  it("clears the authenticated view when the server rejects an expired session", async () => {
    const current = fixture("Expired Depot");
    mockedApi.mockImplementation(((path: string) =>
      path === "/session"
        ? Promise.resolve({ user: current.user })
        : Promise.reject(
            new ApiError("Sign in to continue.", 401, "UNAUTHENTICATED"),
          )) as typeof api);
    await mount();
    expect(container.querySelector(".login")).not.toBeNull();
    expect(container.querySelector('[aria-label="Sign out"]')).toBeNull();
  });
  it("retains the categories of existing title-case seed records when editing a buyer", async () => {
    const buyer = createWorkspace("Demo", true).buyers[0];
    await mount(
      createElement(BuyerForm, {
        buyer,
        onClose: vi.fn(),
        onCreated: vi.fn().mockResolvedValue(undefined),
      }),
    );
    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="category"][value="produce"]',
      )?.checked,
    ).toBe(true);
  });
  it("clears consent when an existing buyer phone is edited", async () => {
    const buyer = createWorkspace("Demo", true).buyers[0];
    await mount(
      createElement(BuyerForm, {
        buyer,
        onClose: vi.fn(),
        onCreated: vi.fn().mockResolvedValue(undefined),
      }),
    );
    const phone = container.querySelector<HTMLInputElement>(
      'input[name="phone"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(phone, "+447700900999");
      phone.dispatchEvent(new Event("input", { bubbles: true }));
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
