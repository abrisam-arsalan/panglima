"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
        window.location.href = next;
        return;
      }
      setError(data.error ?? "Login gagal");
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="auth-logo" src="/assets/logo.png" alt="Logo SMPN 5 Tegal" />
        <h1>Portal Panglima</h1>
        <p className="auth-sub">
          SMP Negeri 5 Tegal — satu login untuk semua.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="username">NISN / NIP / Username</label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="NISN, NIP, atau username…"
            required
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="password">PIN / Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Memproses…" : "Masuk"}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="auth-hint">Lupa PIN? Hubungi wali kelas atau TU.</p>
      </form>
    </div>
  );
}
