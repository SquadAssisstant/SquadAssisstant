"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Prefill username if cookie exists
    const m = document.cookie.match(/(?:^|;\s*)sa_last_user=([^;]+)/);
    if (m?.[1]) setUsername(decodeURIComponent(m[1]));
  }, []);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { username, password, rememberDevice }
          : { username, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ?? "Something went wrong.");
        return;
      }

      if (mode === "register") {
        setMsg("Profile created. Now log in.");
        setMode("login");
        setPassword("");
        return;
      }

      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-fuchsia-500/25 bg-black/60 backdrop-blur p-6 shadow-[0_0_60px_rgba(168,85,247,.14)]">
        <div className="text-xl font-semibold tracking-[0.35em] text-fuchsia-200">SQUAD ASSISTANT</div>

        <div className="mt-6 flex gap-2">
          <button
            className={`flex-1 rounded-2xl border px-3 py-2 text-xs uppercase tracking-widest ${
              mode === "login" ? "border-cyan-400/30 text-cyan-200" : "border-slate-700/50 text-slate-300"
            }`}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={`flex-1 rounded-2xl border px-3 py-2 text-xs uppercase tracking-widest ${
              mode === "register" ? "border-cyan-400/30 text-cyan-200" : "border-slate-700/50 text-slate-300"
            }`}
            onClick={() => setMode("register")}
            type="button"
          >
            Create
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">Username</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-black/40 px-4 py-3 text-slate-100 outline-none focus:border-fuchsia-400/40"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">Password</label>
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-black/40 px-4 py-3 text-slate-100 outline-none focus:border-fuchsia-400/40"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>

          {mode === "login" ? (
            <label className="flex items-center gap-2 text-xs text-slate-300/80">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              Remember this device
            </label>
          ) : null}

          {msg ? (
            <div className="rounded-2xl border border-slate-700/50 bg-black/30 p-3 text-xs text-slate-200/80">
              {msg}
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="w-full rounded-2xl border border-cyan-400/25 bg-cyan-950/15 px-4 py-3 text-xs uppercase tracking-widest text-cyan-200/90 hover:border-cyan-300/35 transition disabled:opacity-50"
          >
            {busy ? "..." : mode === "login" ? "Enter" : "Create Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
