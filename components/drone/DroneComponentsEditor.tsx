// components/drone/DroneComponentsEditor.tsx
"use client";

import React, { useEffect, useState } from "react";

type DroneComponent = {
  key: string;
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

const DEFAULT_KEYS = [
  "component_1",
  "component_2",
  "component_3",
  "component_4",
  "component_5",
  "component_6",
];

async function readJsonSafely(res: Response) {
  const text = await res.text();

  if (!text || !text.trim()) {
    return {
      ok: false,
      status: res.status,
      statusText: res.statusText,
      error: `Empty response body (${res.status} ${res.statusText})`,
      rawText: text,
      data: null,
    };
  }

  try {
    const data = JSON.parse(text);
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      error: null,
      rawText: text,
      data,
    };
  } catch {
    return {
      ok: false,
      status: res.status,
      statusText: res.statusText,
      error: `Response was not valid JSON (${res.status} ${res.statusText})`,
      rawText: text,
      data: null,
    };
  }
}

export function DroneComponentsEditor({
  ownerId,
  selectedUploadId,
}: {
  ownerId: string;
  selectedUploadId: number | null;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [value, setValue] = useState<DroneComponentsValue>(() => ({
    kind: "drone_components",
    saved_at: nowIso(),
    components: DEFAULT_KEYS.map((k) => ({ key: k, label: prettyKey(k) })),
  }));

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/drone/components/get?owner_id=${encodeURIComponent(ownerId)}`, {
        credentials: "include",
      });

      const parsed = await readJsonSafely(res);

      if (!parsed.data) {
        throw new Error(parsed.error ?? "Load failed");
      }

      if (!parsed.ok) {
        throw new Error(parsed.data?.error ?? parsed.error ?? "Load failed");
      }

      if (parsed.data?.row?.value?.kind === "drone_components") {
        setValue(parsed.data.row.value as DroneComponentsValue);
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
    setMsg(null);

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

      const parsed = await readJsonSafely(res);

      if (!parsed.data) {
        throw new Error(parsed.error ?? "Save failed");
      }

      if (!parsed.ok) {
        throw new Error(parsed.data?.error ?? parsed.error ?? "Save failed");
      }

      if (parsed.data?.row?.value?.kind === "drone_components") {
        setValue(parsed.data.row.value as DroneComponentsValue);
      }

      setMsg("Saved ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function extract() {
    if (!selectedUploadId) {
      setErr("Select a drone screenshot first.");
      return;
    }

    setExtracting(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/drone/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: selectedUploadId, mode: "components" }),
      });

      const parsed = await readJsonSafely(res);

      if (!parsed.data) {
        const preview = parsed.rawText?.slice(0, 300);
        throw new Error(
          preview
            ? `${parsed.error ?? "Extract failed"}: ${preview}`
            : (parsed.error ?? "Extract failed")
        );
      }

      if (!parsed.ok) {
        throw new Error(parsed.data?.error ?? parsed.error ?? "Extract failed");
      }

      const extracted = parsed.data?.extracted;
      const arr = Array.isArray(extracted?.components) ? extracted.components : [];

      if (!arr.length) {
        setErr("Extract returned no components. Try a clearer screenshot.");
        return;
      }

      setValue((s) => {
        const next = [...s.components];

        for (let i = 0; i < next.length && i < arr.length; i++) {
          next[i] = {
            ...next[i],
            label: arr[i]?.label || next[i].label,
            percent: typeof arr[i]?.percent === "number" ? arr[i].percent : next[i].percent,
            level: typeof arr[i]?.level === "number" ? arr[i].level : next[i].level,
          };
        }

        return {
          ...s,
          saved_at: nowIso(),
          components: next,
        };
      });

      setMsg("Extracted ✅ (review, then Save)");
    } catch (e: any) {
      setErr(e?.message ?? "Extract failed");
    } finally {
      setExtracting(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  if (loading) {
    return <div className="text-sm text-white/60">Loading components…</div>;
  }

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {msg ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
          {msg}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">
          Enter the % and Lv shown on each component tile.
        </div>

        <div className="flex gap-2">
          <button
            onClick={extract}
            disabled={extracting || !selectedUploadId}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "Extract from Image"}
          </button>

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
          <div
            key={`${c.key}-${idx}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="text-sm font-semibold text-white">
              {c.label ?? prettyKey(c.key)}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/60">Percent</div>
                <input
                  value={c.percent ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw ? Number(raw) : undefined;

                    setValue((s) => {
                      const next = [...s.components];
                      next[idx] = {
                        ...next[idx],
                        percent: typeof v === "number" && Number.isFinite(v) ? v : undefined,
                      };
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
                    const raw = e.target.value.trim();
                    const v = raw ? Number(raw) : undefined;

                    setValue((s) => {
                      const next = [...s.components];
                      next[idx] = {
                        ...next[idx],
                        level: typeof v === "number" && Number.isFinite(v) ? v : undefined,
                      };
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
