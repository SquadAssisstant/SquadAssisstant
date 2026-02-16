"use client";

import React, { useMemo, useState } from "react";

type UploadKind = "hero_profile" | "battle_report" | "drone" | "overlord" | "gear" | "unknown";

type Props = {
  endpoint?: string; // default: /api/uploads/image
  maxFiles?: number; // default: 20
  onUploaded?: (result: any) => void; // called per file
  onAllDone?: (results: any[]) => void; // called after batch
};

export default function UploadDocumentsForm({
  endpoint = "/api/uploads/image",
  maxFiles = 20,
  onUploaded,
  onAllDone,
}: Props) {
  const [kind, setKind] = useState<UploadKind>("unknown");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ name: string; ok: boolean; msg?: string }[]>([]);

  const canUpload = useMemo(() => files.length > 0 && !busy, [files.length, busy]);

  function addLog(entry: { name: string; ok: boolean; msg?: string }) {
    setLog((prev) => [entry, ...prev].slice(0, 50));
  }

  async function uploadOne(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);

    const res = await fetch(endpoint, { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = json?.error || `Upload failed (${res.status})`;
      addLog({ name: file.name, ok: false, msg });
      return { ok: false, file: file.name, error: msg, response: json };
    }

    addLog({ name: file.name, ok: true, msg: `kind=${json?.kind ?? kind}` });
    onUploaded?.(json);
    return { ok: true, file: file.name, response: json };
  }

  async function uploadAll() {
    if (!canUpload) return;
    setBusy(true);
    try {
      const results: any[] = [];
      for (const f of files) {
        // eslint-disable-next-line no-await-in-loop
        const r = await uploadOne(f);
        results.push(r);
      }
      onAllDone?.(results);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">Upload images</div>
            <div className="mt-1 text-xs text-slate-300/70">
              Choose up to <span className="text-slate-200/80">{maxFiles}</span> images. We store them and tag them by kind.
            </div>
          </div>

          <div className="w-full sm:w-[260px]">
            <div className="text-[10px] uppercase tracking-widest text-slate-400/80">Type</div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as UploadKind)}
              className="mt-1 w-full rounded-xl border border-slate-700/60 bg-black/40 px-3 py-2 text-sm text-slate-100/90 outline-none"
              disabled={busy}
            >
              <option value="unknown">Unknown</option>
              <option value="hero_profile">Hero Profile</option>
              <option value="battle_report">Battle Report</option>
              <option value="drone">Drone</option>
              <option value="overlord">Overlord</option>
              <option value="gear">Gear</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              const trimmed = picked.slice(0, maxFiles);
              setFiles(trimmed);
            }}
            className="block w-full text-sm text-slate-200/80 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900/60 file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest file:text-slate-200/80"
          />

          <button
            type="button"
            onClick={uploadAll}
            disabled={!canUpload}
            className={[
              "rounded-2xl border px-4 py-2 text-xs uppercase tracking-widest transition",
              canUpload
                ? "border-cyan-400/30 bg-cyan-950/20 text-cyan-200/90 hover:border-cyan-300/40"
                : "border-slate-700/60 bg-black/40 text-slate-400/70",
            ].join(" ")}
          >
            {busy ? "Uploading…" : `Upload (${files.length})`}
          </button>
        </div>

        <div className="mt-2 text-xs text-slate-300/70">
          Selected: <span className="text-slate-200/80">{files.length}</span>{" "}
          {files.length > 0 ? (
            <>
              • tagging as <span className="text-slate-200/80">{kind}</span>
            </>
          ) : null}
        </div>
      </div>

      {log.length > 0 ? (
        <div className="rounded-2xl border border-slate-700/40 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400/80">Recent uploads</div>
          <div className="mt-2 space-y-2">
            {log.map((l, idx) => (
              <div
                key={`${l.name}-${idx}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-700/40 bg-black/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs text-slate-200/85">{l.name}</div>
                  {l.msg ? <div className="mt-0.5 text-[11px] text-slate-400/80">{l.msg}</div> : null}
                </div>
                <div className={l.ok ? "text-xs text-emerald-300/90" : "text-xs text-rose-300/90"}>
                  {l.ok ? "OK" : "FAIL"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
