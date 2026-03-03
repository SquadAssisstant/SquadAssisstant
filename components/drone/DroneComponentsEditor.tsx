"use client";

import React, { useEffect, useState } from "react";

type DroneComponent = {
  key: string;     // supports 5 or 6 without changing schema
  label?: string;
  percent?: number;
  level?: number;
};

type DroneComponentsValue = {
  kind: "drone_components";
  components: DroneComponent[];
  saved_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function prettyKey(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

const DEFAULT_KEYS = ["component_1", "component_2", "component_3", "component_4", "component_5", "component_6"];

export function DroneComponentsEditor({ ownerId }: { ownerId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [value, setValue] = useState<DroneComponentsValue>(() => ({
    kind: "drone_components",
    saved_at: nowIso(),
    components: DEFAULT_KEYS.map((k) => ({ key: k, label: prettyKey(k) })),
  }));

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/drone/components/get?owner_id=${encodeURIComponent(ownerId)}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Load failed");

      if (json?.row?.value?.kind === "drone_components") {
        setValue(json.row.value as DroneComponentsValue);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/drone/components/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          owner_id: ownerId,
          value: { ...value, saved_at: nowIso() },
          source_urls: [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Save failed");

      if (json?.row?.value?.kind === "drone_components") {
        setValue(json.row.value as DroneComponentsValue);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  if (loading) return <div className="text-sm text-white/60">Loading components…</div>;

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-white/70">Enter the % and Lv shown on each component tile.</div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Reload
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {value.components.map((c, idx) => (
          <div key={`${c.key}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">{c.label ?? prettyKey(c.key)}</div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/60">Percent</div>
                <input
                  value={c.percent ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : undefined;
                    setValue((s) => {
                      const next = [...s.components];
                      next[idx] = { ...next[idx], percent: Number.isFinite(v as any) ? v : undefined };
                      return { ...s, components: next };
                    });
                  }}
                  placeholder="e.g., 63"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <div className="text-xs text-white/60">Level</div>
                <input
                  value={c.level ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : undefined;
                    setValue((s) => {
                      const next = [...s.components];
                      next[idx] = { ...next[idx], level: Number.isFinite(v as any) ? v : undefined };
                      return { ...s, components: next };
                    });
                  }}
                  placeholder="e.g., 8"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
              }
