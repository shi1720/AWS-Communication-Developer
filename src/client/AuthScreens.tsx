import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import type { SessionUser } from "../shared/types";
import { api } from "./api";
import { Produce } from "./Produce";

export function AuthScreen({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(mode);
    const form = new FormData(e.currentTarget);
    try {
      if (mode === "forgot") {
        const r = await api<{ message: string }>("/auth/forgot-password", {
          method: "POST",
          body: { email: form.get("email") },
        });
        setNotice(r.message);
      } else {
        const r = await api<{ user: SessionUser }>(`/auth/${mode}`, {
          method: "POST",
          body: Object.fromEntries(form),
        });
        onLogin(r.user);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function demo() {
    setError("");
    setBusy("demo");
    try {
      onLogin(
        (
          await api<{ user: SessionUser }>("/auth/demo", {
            method: "POST",
            body: {},
          })
        ).user,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function change(next: typeof mode) {
    setMode(next);
    setError("");
    setNotice("");
  }
  return (
    <div className="login">
      <div className="login-story">
        <div className="brand light">
          <img src="/favicon.svg" alt="" />
          <span>
            secondcrate<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="story-main">
          <span className="eyebrow pale">
            <span className="tiny-dot" /> A SECOND DESTINATION. A BETTER
            OUTCOME.
          </span>
          <h1>
            Good food.
            <br />
            Wrong destination.
            <br />
            <em>Let’s fix that.</em>
          </h1>
          <p>
            Turn cancelled wholesale orders into recovered sales. One lot. The
            right buyers. A conversation that gets it there.
          </p>
          <div className="story-art">
            <Produce />
            <span className="floating-tag">
              <CheckCircle2 size={17} /> Another order, recovered.
            </span>
          </div>
        </div>
        <div className="login-footer">
          <span>Built by Shivam Gupta</span>
          <span>AWS CDS Hackathon · 2026</span>
        </div>
      </div>
      <div className="login-form-side">
        <span className="login-top">
          THE RECOVERY DESK FOR FOOD WHOLESALERS
        </span>
        <div className="login-form">
          <span className="small-logo">
            <Sprout size={27} />
          </span>
          <h2>
            {mode === "login"
              ? "A fresh start for every lot."
              : mode === "register"
                ? "Make room for better outcomes."
                : "Let’s get you back in."}
          </h2>
          <p>
            {mode === "login"
              ? "Welcome to SecondCrate. Your next recovered order starts here."
              : mode === "register"
                ? "Create your private workspace and bring your buyer network."
                : "Request a secure reset link for your workspace email."}
          </p>
          {mode !== "forgot" && (
            <>
              <button
                className="button demo-entry"
                onClick={demo}
                disabled={!!busy}
              >
                {busy === "demo" ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
                Explore the interactive demo
                <ArrowRight size={18} />
              </button>
              <div className="demo-note">
                <ShieldCheck size={14} /> Private sandbox. Sample buyers. No
                messages sent.
              </div>
              <div className="divider">
                <span>
                  or{" "}
                  {mode === "login"
                    ? "sign in to your workspace"
                    : "create an account"}
                </span>
              </div>
            </>
          )}
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Your name
                <input
                  autoComplete="name"
                  name="name"
                  placeholder="Shivam Gupta"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
            )}
            <label>
              Work email
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@yourcompany.com"
                required
                maxLength={254}
              />
            </label>
            {mode !== "forgot" && (
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "login"
                      ? "Enter your password"
                      : "12+ characters, a letter and a number"
                  }
                  required
                  minLength={mode === "register" ? 12 : 1}
                  maxLength={128}
                  pattern={
                    mode === "register"
                      ? "(?=.*[A-Za-z])(?=.*[0-9]).{12,128}"
                      : undefined
                  }
                />
              </label>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="forgot-link"
                onClick={() => change("forgot")}
              >
                Forgot your password?
              </button>
            )}
            {error && (
              <div className="form-error" role="alert">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
                <CheckCircle2 size={16} />
                {notice}
              </div>
            )}
            <button type="submit" className="button full" disabled={!!busy}>
              {busy === mode && <Loader2 size={16} className="spin" />}
              {mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create workspace"
                  : "Send reset link"}
              <ArrowRight size={16} />
            </button>
          </form>
          {mode === "forgot" ? (
            <p className="auth-switch">
              <button onClick={() => change("login")}>
                <ArrowLeft size={12} /> Back to sign in
              </button>
            </p>
          ) : (
            <p className="auth-switch">
              {mode === "login"
                ? "New to SecondCrate?"
                : "Already have a workspace?"}{" "}
              <button
                onClick={() => change(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}
          <div className="trust-row">
            <LockKeyhole size={14} /> Secure sessions<span>·</span>
            <span>Your data, your workspace</span>
          </div>
        </div>
        <div className="login-bottom">
          Less chasing. More closing. Nothing good left behind.
        </div>
      </div>
    </div>
  );
}

export function AccountAction({
  action,
  token,
  onDone,
}: {
  action: "verify" | "reset";
  token: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api(`/auth/${action === "verify" ? "verify" : "reset-password"}`, {
        method: "POST",
        body: {
          token,
          ...(action === "reset" ? { password: form.get("password") } : {}),
        },
      });
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-action">
      <div className="brand">
        <img src="/favicon.svg" alt="" />
        <span>
          secondcrate<span className="brand-dot">.</span>
        </span>
      </div>
      <section className="panel">
        <span className="account-icon">
          {success ? <CheckCircle2 size={28} /> : <LockKeyhole size={28} />}
        </span>
        <h1>
          {success
            ? action === "verify"
              ? "Your email is verified."
              : "Your password is reset."
            : action === "verify"
              ? "Verify your workspace email."
              : "A fresh start for your password."}
        </h1>
        <p>
          {success
            ? "You’re ready to return to your workspace."
            : "The secure link is valid for one hour and can be used once."}
        </p>
        {!success && (
          <form onSubmit={submit}>
            {action === "reset" && (
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="12+ characters, a letter and a number"
                  minLength={12}
                  maxLength={128}
                  pattern="(?=.*[A-Za-z])(?=.*[0-9]).{12,128}"
                  required
                />
              </label>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button full" disabled={busy}>
              {busy && <Loader2 className="spin" size={16} />}
              {action === "verify" ? "Verify my email" : "Save new password"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        <button className={success ? "button" : "text-button"} onClick={onDone}>
          {success ? "Return to SecondCrate" : "Back to sign in"}
          <ArrowRight size={15} />
        </button>
      </section>
    </main>
  );
}
