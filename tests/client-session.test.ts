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
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  history.replaceState({}, "", "/");
  mockedApi.mockReset();
});

describe("session transitions protect workspace data", () => {
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
