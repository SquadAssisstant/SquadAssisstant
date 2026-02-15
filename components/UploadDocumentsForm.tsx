"use client";

import { useMemo, useState } from "react";

type UploadKind = "hero_profile" | "battle_report" | "drone" | "overlord" | "gear" | "unknown";

const KIND_OPTIONS: { value: UploadKind; label: string; hint: string }[] = [
  { value: "battle_report", label: "Battle Report (multi-page session)", hint: "Use for 1–20 screenshots that belong to ONE battle report." },
  { value: "hero_profile", label: "Hero Profile", hint: "Hero profile screens, gear overview, power, etc." },
  { value: "drone", label: "Drone", hint: "Drone screens, components, combat boost, chips, etc." },
  { value: "overlord", label: "Overlord", hint: "Gorilla/overlord training, bond, promotion, skills, etc." },
  { value: "gear", label: "Gear", hint: "Gear inventory, gear pieces, upgrade screens, etc." },
  { value: "unknown", label: "Unknown / Let it sit", hint: "Uploads store, but won’t appear in analyzer until sorted later." },
];

const MAX_FILES = 20;

function uniqByNameSizeLastModified(list: File[]) {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of list) {
    const k = `${f.name}|${f.size}|${f.lastModified}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

export default function UploadDocumentsForm() {
  const [kind, setKind] = useState<UploadKind>("battle_report");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  const hint = useMemo(() => KIND_OPTIONS.find(k => k.value === kind)?.hint ?? "", [kind]);

  function pushLog(line: string) {
    setLog(prev => [line, ...prev].slice(0, 50));
  }

  function addPickedFiles(fileList: FileList | null) {
    if (!fileList) return;
    const picked = Array.from(fileList).filter(f => f.type.startsWith("image/"));
    // append + de-dupe + cap at 20
    const merged = uniqByNameSizeLastModified([...files, ...picked]).slice(0, MAX_FILES);
    setFiles(merged);
    // IMPORTANT: allow picking the same file again later by resetting the input value
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function clearAll() {
    setFiles([]);
    setLastReportId(null);
    setLog([]);
  }

  async function uploadNonReport(filesToUpload: File[]) {
    let okCount = 0;

    for (const f of filesToUpload) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("kind", kind);

      const res = await fetch("/api/uploads/image", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        pushLog(`❌ ${f.name}: ${json?.error ?? "upload failed"}`);
        continue;
      }
      okCount++;
      pushLog(`✅ ${f.name}: stored as ${json?.kind ?? kind}`);
    }

    pushLog(`— Done: ${okCount}/${filesToUpload.length} uploaded`);
  }

  async function uploadBattleReportSession(filesToUpload: File[]) {
    // 1) start session
    const startRes = await fetch("/api/uploads/report/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent_scope: "private" }),
    });
    const startJson = await startRes.json().catch(() => ({}));
    if (!startRes.ok) {
      pushLog(`❌ Start session failed: ${startJson?.error ?? "unknown error"}`);
      return;
    }

    const reportId = startJson?.reportId as string | undefined;
    if (!reportId) {
      pushLog("❌ Start session returned no reportId");
      return;
    }

    setLastReportId(reportId);
    pushLog(`🧾 Report session started: ${reportId}`);

    // 2) upload pages
    let okPages = 0;

    for (let idx = 0; idx < filesToUpload.length; idx++) {
      const f = filesToUpload[idx];
      const fd = new FormData();
      fd.append("file", f);
      fd.append("page_index", String(idx)); // harmless if backend ignores it

      const pageRes = await fetch(`/api/uploads/report/${reportId}/page`, { method: "POST", body: fd });
      const pageJson = await pageRes.json().catch(() => ({}));

      if (!pageRes.ok) {
        pushLog(`❌ Page ${idx + 1} (${f.name}): ${pageJson?.error ?? "upload failed"}`);
        continue;
      }

      okPages++;
      pushLog(`✅ Page ${idx + 1}/${filesToUpload.length} (${f.name}) uploaded`);
    }

    // 3) finalize
    const finRes = await fetch(`/api/uploads/report/${reportId}/finalize`, { method: "POST" });
    const finJson = await finRes.json().catch(() => ({}));
    if (!finRes.ok) {
      pushLog(`❌ Finalize failed: ${finJson?.error ?? "unknown error"}`);
      pushLog(`— Pages uploaded: ${okPages}/${filesToUpload.length} (session NOT finalized)`);
      return;
    }

    pushLog(`🎉 Finalized report: ${reportId} (${okPages}/${filesToUpload.length} pages)`);
    pushLog(`➡️ Open Battle Reports Analyzer — it should see this report.`);
  }

  async function onUpload() {
    if (busy) return;
    if (files.length === 0) {
      pushLog("⚠️ No images selected.");
      return;
    }

    setBusy(true);
    setLog([]);
    setLastReportId(null);

    try {
      pushLog(`Uploading ${files.length} image(s) as: ${kind}`);

      if (kind === "battle_report") {
        await uploadBattleReportSession(files);
      } else {
        await uploadNonReport(files);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm tracking-wide text-slate-100/90">Image Upload</div>
          <div className="mt-1 text-xs text-slate-300/70">
            Add images in batches (Android-friendly) — up to <span className="text-slate-100/80">{MAX_FILES}</span>.
          </div>
        </div>

        {lastReportId ? (
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-950/20 px-3 py-2 text-[11px] text-cyan-200/90">
            reportId: <span className="font-mono">{lastReportId}</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-widest text-slate-400/80">Upload type</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as UploadKind)}
            className="w-full rounded-xl border border-slate-700/60 bg-black/40 px-3 py-2 text-sm text-slate-100/90"
            disabled={busy}
          >
            {KIND_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-300/70">{hint}</div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-widest text-slate-400/80">Choose images</label>

          {/* Android note:
              Even if the picker only allows a few at a time, you can keep selecting more;
              we APPEND up to MAX_FILES. */}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy || files.length >= MAX_FILES}
            onChange={(e) => {
              addPickedFiles(e.target.files);
              // reset so selecting same file again triggers change
              (e.target as HTMLInputElement).value = "";
            }}
            className="w-full rounded-xl border border-slate-700/60 bg-black/40 px-3 py-2 text-sm text-slate-200/80 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900/60 file:px-3 file:py-2 file:text-xs file:text-slate-100/90"
          />

          <div className="flex items-center justify-between text-xs text-slate-300/70">
            <div>
              Selected: <span className="text-slate-100/80">{files.length}</span> / {MAX_FILES}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearAll}
                disabled={busy && files.length === 0}
                className="rounded-lg border border-slate-700/60 bg-black/40 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-200/80 hover:border-slate-500/60 transition disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>

          {files.length > 0 ? (
            <div className="max-h-36 overflow-auto rounded-xl border border-slate-700/40 bg-black/20 p-2 text-xs text-slate-200/80">
              {files.map((f, idx) => (
                <div key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center justify-between gap-2 py-1">
                  <div className="truncate">{idx + 1}. {f.name}</div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    disabled={busy}
                    className="rounded-md border border-slate-700/60 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-slate-200/70 hover:border-fuchsia-400/30 transition disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={busy || files.length === 0}
          onClick={onUpload}
          className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-950/20 px-4 py-2 text-xs uppercase tracking-widest text-fuchsia-200/90 hover:border-fuchsia-400/35 disabled:opacity-50 transition"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-700/40 bg-black/20 p-3">
        <div className="text-[11px] uppercase tracking-widest text-slate-400/80">Upload log</div>
        <div className="mt-2 space-y-1 text-xs text-slate-200/80">
          {log.length === 0 ? <div className="text-slate-400/70">No activity yet.</div> : null}
          {log.map((l, i) => (
            <div key={i} className="font-mono">{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
