"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, rememberDevice }),
    });

    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setMsg(data?.error ?? `Register failed (${res.status})`);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>SquadAssistant — Register</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            style={{ padding: 10, border: "1px solid #444", borderRadius: 10 }}
            required
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              style={{ padding: 10, border: "1px solid #444", borderRadius: 10, flex: 1 }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              style={{ padding: "10px 12px", border: "1px solid #444", borderRadius: 10 }}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
          />
          <span>Remember device</span>
        </label>

        <button
          disabled={loading}
          type="submit"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #444" }}
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <a href="/login" style={{ textDecoration: "underline" }}>
          Back to login
        </a>

        {msg ? <div style={{ padding: 10, border: "1px solid #444", borderRadius: 10 }}>{msg}</div> : null}
      </form>
    </div>
  );
}
