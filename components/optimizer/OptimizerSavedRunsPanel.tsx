"use client";

import React from "react";

type SavedOptimizerFile = {
  id: number;
  label: string;
  mode: string;
  squad_count: number;
  locked_heroes?: string[];
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  files: SavedOptimizerFile[];
  loading?: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
};

function fmtDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function OptimizerSavedRunsPanel({ files, loading, selectedId, onSelect }: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
      <div className="mb-4">
        <div className="text-lg font-semibold text-white">Saved Optimizer Files</div>
        <div className="mt-1 text-sm text-white/55">
          Saved squad layouts from previous optimizer runs.
        </div>
      </div>

      {loading ? <div className="text-sm text-white/55">Loading saved optimizer files…</div> : null}

      {!loading ? (
        <div className="grid gap-3">
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => onSelect(String(file.id))}
              className={cx(
                "rounded-2xl border p-3 text-left",
                String(file.id) === selectedId
                  ? "border-emerald-400/30 bg-emerald-500/10"
                  : "border-white/10 bg-black/20"
              )}
            >
              <div className="text-sm font-medium text-white">{file.label}</div>
              <div className="mt-1 text-xs text-white/45">
                {file.mode} • {file.squad_count} squad{file.squad_count === 1 ? "" : "s"} • {fmtDate(file.created_at)}
              </div>
              {Array.isArray(file.locked_heroes) && file.locked_heroes.length ? (
                <div className="mt-2 text-xs text-white/60">
                  Locked: {file.locked_heroes.join(", ")}
                </div>
              ) : null}
            </button>
          ))}

          {!files.length ? (
            <div className="text-sm text-white/50">No saved optimizer files yet.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
