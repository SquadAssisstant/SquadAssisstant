"use client";

import React, { useMemo, useState } from "react";

type UploadKind =
  | "hero_profile"
  | "battle_report"
  | "drone"
  | "overlord"
  | "gear"
  | "unknown";

const KIND_OPTIONS: { value: UploadKind; label: string; help: string }[] = [
  { value: "battle_report", label: "Battle Report", help: "Full battle report screenshots (often many pages)." },
  { value: "hero_profile", label: "Hero Profile", help: "Hero page showing gear/level/power, etc." },
  { value: "gear", label: "Gear", help: "Gear details, upgrades, rarity, etc." },
  { value: "drone", label: "Drone", help: "Drone components, chips, boosts." },
  { value: "overlord", label: "Overlord", help: "Overlord/gorilla pages and boosts." },
  { value: "unknown", label: "Unknown", help: "Let the system store it without sorting (not recommended)." },
];

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function UploadDocumentsForm(props: {
  endpoint?: string; // defaults to /api/uploads/image
  maxFiles?: number; // defaults to 20
  className?: string;
  onComplete?: (result: { ok: boolean; items: any[] }) => void;
}) {
  const endpoint = props.endpoint ?? "/api/uploads/image";
  const maxFiles = props.maxFiles ?? 20;

  const [kind, setKind] = useState<UploadKind>("battle_report");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const [doneCount, setDoneCount] = useState(0);
  const [results, setResults] = useState<
    { name: string; ok: boolean; status?: number; message?: string; payload?: any }[]
  >([]);

  const canUpload = useMemo(() => files.length > 0 && !busy, [files.length, busy]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) {
      setFiles([]);
      return;
    }

    // Filter to images only (some browsers still allow other files)
    const imgs = picked.filter((f) => f.type.startsWith("image/"));

    // Enforce max files
    const trimmed = imgs.slice(0, maxFiles);

    setFiles(trimmed);
    setResults([]);
    setDoneCount(0);

    // reset the input so user can pick the same file(s) again if desired
    e.target.value = "";
  }

  async function uploadOne(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);

    const res = await fetch(endpoint, { method: "POST", body: fd });
    const payloadText = await res.text().catch(() => "");
    let payload: any = null;
    try {
      payload = payloadText ? JSON.parse(payloadText) : null;
    } catch {
      payload = payloadText;
    }

    if (!res.ok) {
      const msg =
        (payload && (payload.error || payload.message)) ||
        (typeof payload === "string" ? payload : "Upload failed");
      return { name: file.name, ok: false, status: res.status, message: String(msg), payload };
    }

    return { name: file.name, ok: true, status: res.status, message: "Uploaded", payload };
  }

  async function startUpload() {
    if (!files.length || busy) return;

    setBusy(true);
    setResults([]);
    setDoneCount(0);

    const out: { name: string; ok: boolean; status?: number; message?: string; payload?: any }[] = [];

    // Sequential upload is more reliable for large batches on cheap hosting (less chance of timeouts)
    for (let i = 0; i < files.length; i++) {
      try {
        const r = await uploadOne(files[i]);
        out.push(r);
      } catch (e: any) {
        out.push({ name: files[i].name, ok: false, message: e?.message ?? "Unknown error" });
      }
      setDoneCount(i + 1);
      setResults([...out]);
    }

    setBusy(false);

    props.onComplete?.({
      ok: out.every((x) => x.ok),
      items: out,
    });
  }

  return (
    <div className={cn("space-y-3", props.className)}>
      <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">Upload images</div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Kind dropdown */}
          <label className="block">
            <div className="text-xs uppercase tracking-widest text-slate-400/80">Type</div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as UploadKind)}
              disabled={busy}
              className={cn(
                "mt-2 w-full rounded-2xl border border-slate-700/50 bg-black/35",
                "px-3 py-2 text-sm text-slate-100",
                "focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
              )}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-slate-400/70">
              {KIND_OPTIONS.find((k) => k.value === kind)?.help}
            </div>
          </label>

          {/* File picker */}
          <label className="block">
            <div className="text-xs uppercase tracking-widest text-slate-400/80">
              Choose up to {maxFiles}
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onPick}
              disabled={busy}
              className="mt-2 block w-full text-sm text-slate-200
                         file:mr-3 file:rounded-xl file:border file:border-slate-700/60
                         file:bg-black/40 file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest
                         file:text-slate-200 hover:file:border-fuchsia-400/40"
            />

            <div className="mt-2 text-xs text-slate-400/70">
              Selected: <span className="text-slate-200/80">{files.length}</span>
            </div>
          </label>
        </div>

        {/* Action row */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400/70">
            {busy ? (
              <>
                Uploading <span className="text-slate-200/80">{doneCount}</span> / {files.length}
              </>
            ) : files.length ? (
              <>Ready to upload {files.length} image(s).</>
            ) : (
              <>Pick images to upload.</>
            )}
          </div>

          <button
            type="button"
            onClick={startUpload}
            disabled={!canUpload}
            className={cn(
              "rounded-2xl border border-cyan-400/25 bg-cyan-950/20 px-4 py-2",
              "text-xs uppercase tracking-widest text-cyan-200/90 hover:border-cyan-300/40 transition",
              (!canUpload || busy) && "opacity-50 cursor-not-allowed"
            )}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length ? (
        <div className="rounded-2xl border border-slate-700/40 bg-black/25 p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">Results</div>
          <div className="mt-3 space-y-2">
            {results.map((r, idx) => (
              <div
                key={`${r.name}-${idx}`}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-xs",
                  r.ok
                    ? "border-emerald-400/20 bg-emerald-950/10 text-emerald-200/90"
                    : "border-rose-400/20 bg-rose-950/10 text-rose-200/90"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate">{r.name}</div>
                  <div className="shrink-0 uppercase tracking-widest">
                    {r.ok ? "OK" : `FAIL${r.status ? ` (${r.status})` : ""}`}
                  </div>
                </div>
                {r.message ? <div className="mt-1 text-[11px] opacity-90">{r.message}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
