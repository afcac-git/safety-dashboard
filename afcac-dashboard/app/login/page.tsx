"use client";
import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function LoginForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/admin";
  const { t } = useLanguage();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("loginFailed"));
      } else {
        window.location.href = redirect;
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Language switcher at the top */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <LanguageSwitcher />
        </div>

        <div className="login-logo">
          <img src="/afcac_logo.png" alt="AFCAC Logo" />
        </div>
        <div className="login-title">{t("loginTitle")}</div>
        <div className="login-sub">{t("loginSub")}</div>

        {error && <div className="error-msg">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">{t("labelUsername")}</label>
            <input
              id="username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("placeholderUsername")}
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">{t("labelPassword")}</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "var(--ink3)" }}>
          <Link href="/" style={{ color: "var(--forest2)", textDecoration: "none" }}>
            {t("backToDashboard")}
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page"><div className="login-card">Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
