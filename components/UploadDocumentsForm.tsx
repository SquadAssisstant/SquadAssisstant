"use client";

import { useMemo, useState } from "react";

type UploadKind = "battle_report" | "hero_profile" | "gear" | "drone" | "overlord" | "unknown";

type UploadResult =
  | { ok: true; kind: UploadKind; reportId?: string; storagePath?: string; message?: string }
  | { ok: false; kind: UploadKind; error: string };

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function UploadDocumentsForm() {
  const [kind, setKind] = useState<UploadKind>("battle_report");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

  const maxFiles = 20;

  const acceptHint = useMemo(() => {
    if (kind === "battle_report") return "Up to 20 images (battle report pages).";
    return "Up to 20 images.";
  }, [kind]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    const clipped = list.slice(0, maxFiles);
    setFiles(clipped);
    setResults([]);
    setProgress(null);
  }

  async function uploadSingleImage(f: File, declaredKind: UploadKind): Promise<UploadResult> {
    const form = new FormData();
    form.append("file", f);
    form.append("kind", declaredKind);

    const res = await fetch("/api/uploads/image", {
      method: "POST",
      body: form,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, kind: declaredKind, error: json?.error ?? `Upload failed (${res.status})` };
    }

    return {
      ok: true,
      kind: declaredKind,
      reportId: json?.reportId,
      storagePath: json?.storagePath,
      message: "Uploaded",
    };
  }

  async function uploadBattleReportSession(fs: File[]): Promise<UploadResult> {
    // 1) start session
    const startRes = await fetch("/api/uploads/report/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent_scope: "private", kind: "battle_report" }),
    });

    const startJson = await startRes.json().catch(() => null);
    if (!startRes.ok) {
      return { ok: false, kind: "battle_report", error: startJson?.error ?? `Start failed (${startRes.status})` };
    }

    const reportId = startJson?.reportId as string | undefined;
    if (!reportId) {
      return { ok: false, kind: "battle_report", error: "Start did not return reportId" };
    }

    // 2) upload each page
    for (let i = 0; i < fs.length; i++) {
      const f = fs[i];
      const form = new FormData();
      form.append("file", f);

      const pageRes = await fetch(`/api/uploads/report/${reportId}/page`, {
        method: "POST",
        body: form,
      });

      const pageJson = await pageRes.json().catch(() => null);
      if (!pageRes.ok) {
        return {
          ok: false,
          kind: "battle_report",
          error: pageJson?.error ?? `Page ${i + 1} failed (${pageRes.status})`,
        };
      }

      setProgress({ done: i + 1, total: fs.length });
    }

    // 3) finalize
    const finRes = await fetch(`/api/uploads/report/${reportId}/finalize`, { method: "POST" });
    const finJson = await finRes.json().catch(() => null);
    if (!finRes.ok) {
      return { ok: false, kind: "battle_report", error: finJson?.error ?? `Finalize failed (${finRes.status})` };
    }

    return { ok: true, kind: "battle_report", reportId, message: "Battle report ready" };
  }

  async function onUpload() {
    if (busy) return;
    if (files.length === 0) {
      setResults([{ ok: false, kind, error: "Pick at least 1 image" }]);
      return;
    }

    setBusy(true);
    setResults([]);
    setProgress({ done: 0, total: files.length });

    try {
      // Battle report = grouped session (recommended)
      if (kind === "battle_report") {
        const r = await uploadBattleReportSession(files);
        setResults([r]);
        return;
      }

      // Everything else = individual uploads
      const out: UploadResult[] = [];
      for (let i = 0; i < files.length; i++) {
        const r = await uploadSingleImage(files[i], kind);
        out.push(r);
        setProgress({ done: i + 1, total: files.length });
      }
      setResults(out);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm tracking-wide text-slate-100/90">Upload Screenshots</div>
            <div className="mt-1 text-xs text-slate-300/70">{acceptHint}</div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-400/80">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as UploadKind)}
              className="rounded-xl border border-slate-700/60 bg-black/50 px-3 py-2 text-xs text-slate-100/90"
              disabled={busy}
            >
              <option value="battle_report">Battle Report</option>
              <option value="hero_profile">Hero Profile</option>
              <option value="gear">Gear</option>
              <option value="drone">Drone</option>
              <option value="overlord">Overlord</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          disabled={busy}
          className="block w-full text-xs text-slate-200/80 file:mr-3 file:rounded-xl file:border-0 file:bg-fuchsia-600/20 file:px-3 file:py-2 file:text-xs file:text-fuchsia-100 hover:file:bg-fuchsia-600/30"
        />

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-300/70">
            Selected: <span className="text-slate-100/90">{files.length}</span> / {maxFiles}
          </div>

          <button
            type="button"
            onClick={onUpload}
            disabled={busy || files.length === 0}
            className={cn(
              "rounded-2xl border border-cyan-400/30 bg-cyan-950/20 px-4 py-2 text-xs uppercase tracking-widest text-cyan-200/90",
              "hover:border-cyan-300/40 transition",
              (busy || files.length === 0) && "opacity-60 cursor-not-allowed"
            )}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>

        {progress ? (
          <div className="text-xs text-slate-300/70">
            Progress: {progress.done}/{progress.total}
          </div>
        ) : null}

        {results.length ? (
          <div className="mt-2 space-y-2">
            {results.map((r, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-xl border p-3 text-xs",
                  r.ok ? "border-emerald-500/25 bg-emerald-950/10 text-emerald-200/90" : "border-rose-500/25 bg-rose-950/10 text-rose-200/90"
                )}
              >
                {r.ok ? (
                  <div>
                    ✅ {r.kind} — {r.message ?? "ok"}
                    {r.reportId ? <div className="mt-1 text-[11px] text-slate-200/70">reportId: {r.reportId}</div> : null}
                    {r.storagePath ? <div className="mt-1 text-[11px] text-slate-200/70">path: {r.storagePath}</div> : null}
                  </div>
                ) : (
                  <div>❌ {r.kind} — {r.error}</div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-2 text-[11px] text-slate-400/70">
          Tip: pick <b>Battle Report</b> to upload 1–20 pages as one grouped report session (recommended).
        </div>
      </div>
    </div>
  );
}

// Some codebases import default; keep both exports safe.
export default UploadDocumentsForm;
