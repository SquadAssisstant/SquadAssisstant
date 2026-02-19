"use client";

import React, { useMemo, useState } from "react";

type UploadKind =
  | "battle_report"
  | "hero_profile"
  | "gear"
  | "drone"
  | "overlord"
  | "unknown";

const KIND_OPTIONS: { value: UploadKind; label: string; hint: string }[] = [
  { value: "battle_report", label: "Battle Report (screenshots)", hint: "Use for report pages (up to 20 at a time)." },
  { value: "hero_profile", label: "Hero Profile", hint: "Hero stats/gear/power screens." },
  { value: "gear", label: "Gear", hint: "Gear screens." },
  { value: "drone", label: "Drone", hint: "Drone screens (chips/components/etc.)." },
  { value: "overlord", label: "Overlord", hint: "Overlord (gorilla) screens." },
  { value: "unknown", label: "Unknown", hint: "If you’re not sure." },
];

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type UploadResult = {
  fileName: string;
  ok: boolean;
  reportId?: string;
  storagePath?: string;
  kind?: string;
  kindConfidence?: number;
  error?: string;
};

export default function UploadDocumentsForm() {
  const [kind, setKind] = useState<UploadKind>("battle_report");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [results, setResults] = useState<UploadResult[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const hint = useMemo(() => KIND_OPTIONS.find((k) => k.value === kind)?.hint ?? "", [kind]);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    // limit to 20 per batch
    const limited = picked.slice(0, 20);
    setFiles(limited);
    setResults([]);
    setLastError(null);
  }

  async function uploadOne(file: File, selectedKind: UploadKind): Promise<UploadResult> {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", selectedKind);

    const res = await fetch("/api/uploads/image", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { fileName: file.name, ok: false, error: text || `Upload failed (${res.status})` };
    }

    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      return { fileName: file.name, ok: false, error: data?.error || "Upload failed" };
    }

    return {
      fileName: file.name,
      ok: true,
      reportId: data.reportId,
      storagePath: data.storagePath,
      kind: data.kind,
      kindConfidence: data.kindConfidence,
    };
  }

  async function onUpload() {
    if (busy) return;
    if (files.length === 0) {
      setLastError("Pick at least 1 image (up to 20).");
      return;
    }

    setBusy(true);
    setLastError(null);
    setResults([]);
    setProgress({ done: 0, total: files.length });

    const out: UploadResult[] = [];

    try {
      // sequential = fewer Render timeouts / fewer 413 surprises
      for (let i = 0; i < files.length; i++) {
        const r = await uploadOne(files[i], kind);
        out.push(r);
        setResults([...out]);
        setProgress({ done: i + 1, total: files.length });
      }
    } catch (e: any) {
      setLastError(e?.message ?? "Upload failed unexpectedly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-700/40 bg-black/30 p-4",
        "shadow-[inset_0_0_0_1px_rgba(148,163,184,.06)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm tracking-wide text-slate-100/90">Image Upload</div>
          <div className="mt-1 text-xs text-slate-300/70">Upload up to 20 screenshots per batch.</div>
        </div>
      </div>

      {/* Kind selector */}
      <div className="mt-4 grid gap-2">
        <label className="text-[10px] uppercase tracking-widest text-slate-400/80">What are you uploading?</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as UploadKind)}
          disabled={busy}
          className={cn(
            "rounded-xl border border-slate-700/50 bg-black/35 px-3 py-2 text-sm text-slate-100",
            "focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
          )}
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <div className="text-xs text-slate-400/80">{hint}</div>
      </div>

      {/* File picker */}
      <div className="mt-4 grid gap-2">
        <label className="text-[10px] uppercase tracking-widest text-slate-400/80">Choose images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onPickFiles}
          disabled={busy}
          className="block w-full text-sm text-slate-200 file:mr-4 file:rounded-xl file:border-0 file:bg-fuchsia-600/20 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-widest file:text-fuchsia-100 hover:file:bg-fuchsia-600/30"
        />
        <div className="text-xs text-slate-400/80">
          Selected: <span className="text-slate-200/80">{files.length}</span> / 20
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onUpload}
          disabled={busy || files.length === 0}
          className={cn(
            "rounded-2xl border border-cyan-400/25 bg-cyan-950/20 px-4 py-2",
            "text-xs uppercase tracking-widest text-cyan-200/90 hover:border-cyan-300/40 transition",
            (busy || files.length === 0) && "opacity-50 cursor-not-allowed"
          )}
        >
          {busy ? `Uploading ${progress.done}/${progress.total}…` : "Upload"}
        </button>

        <div className="text-xs text-slate-400/80">
          {busy ? (
            <span>
              Progress:{" "}
              <span className="text-slate-200/80">
                {progress.done}/{progress.total}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {lastError ? (
        <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-950/10 p-3 text-xs text-rose-200/90">
          {lastError}
        </div>
      ) : null}

      {/* Results */}
      {results.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-700/40 bg-black/25 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400/80">results</div>
          <div className="mt-2 space-y-2">
            {results.map((r, idx) => (
              <div
                key={`${r.fileName}-${idx}`}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs",
                  r.ok ? "border-emerald-500/20 bg-emerald-950/10" : "border-rose-500/20 bg-rose-950/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-slate-100/90">{r.fileName}</div>
                  <div className={cn("text-[10px] uppercase tracking-widest", r.ok ? "text-emerald-200/90" : "text-rose-200/90")}>
                    {r.ok ? "ok" : "failed"}
                  </div>
                </div>

                {r.ok ? (
                  <div className="mt-1 text-slate-300/70">
                    kind: <span className="text-slate-200/80">{r.kind ?? "unknown"}</span>{" "}
                    {typeof r.kindConfidence === "number" ? (
                      <span className="text-slate-400/70">(conf {r.kindConfidence})</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-1 text-rose-200/90">{r.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
