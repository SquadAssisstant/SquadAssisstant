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

  async function submit(e: React.FormEvent) {
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
    <div className="min-h-screen bg-black text-slate-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-950/40 p-5">
        <div className="text-lg font-semibold tracking-widest text-fuchsia-200">REGISTER</div>

        <label className="mt-4 block text-xs uppercase tracking-widest text-slate-400">Username</label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-700/60 bg-black/40 p-3"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label className="mt-4 block text-xs uppercase tracking-widest text-slate-400">Password</label>
        <div className="mt-2 flex gap-2">
          <input
            className="w-full rounded-xl border border-slate-700/60 bg-black/40 p-3"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="rounded-xl border border-slate-700/60 bg-black/40 px-4 text-xs uppercase tracking-widest"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-300/80">
          <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
          Remember device
        </label>

        <button
          disabled={loading}
          className="mt-5 w-full rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-3 text-xs uppercase tracking-widest hover:border-fuchsia-400/50 transition"
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <a href="/login" className="mt-4 block text-center text-sm text-cyan-200/80 underline">
          Back to login
        </a>

        {msg ? <div className="mt-4 rounded-xl border border-slate-700/60 bg-black/40 p-3 text-sm">{msg}</div> : null}
      </form>
    </div>
  );
}
