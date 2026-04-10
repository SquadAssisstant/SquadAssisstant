"use client";

import React, { useEffect, useState } from "react";

type DroneComponent = {
  slot: number;
  label: string | null;
  percent: number | null;
  level: number | null;
};

type DroneComponentsValue = {
  kind: "drone_components";
  components: DroneComponent[];
  source_upload_id?: number;
  saved_at?: string;
};

function blankValue(): DroneComponentsValue {
  return {
    kind: "drone_components",
    components: Array.from({ length: 6 }, (_, idx) => ({
      slot: idx + 1,
      label: null,
      percent: null,
      level: null,
    })),
  };
}

async function safeReadResponse(res: Response): Promise<{ json: any | null; text: string | null }> {
  const text = await res.text().catch(() => "");
  if (!text) return { json: null, text: null };

  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

export function DroneComponentsEditor({
  selectedUploadId,
}: {
  ownerId?: string;
  selectedUploadId: number | null;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [value, setValue] = useState<DroneComponentsValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/drone/components/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const serverMsg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setErr(`Load failed: ${String(serverMsg)}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "drone_components" && Array.isArray(factsValue.components)) {
        setValue({
          kind: "drone_components",
          components: factsValue.components,
          source_upload_id: factsValue.source_upload_id ?? selectedUploadId,
          saved_at: factsValue.saved_at,
        });
      } else {
        setValue({
          ...blankValue(),
          source_upload_id: selectedUploadId,
        });
      }
    } catch (e: any) {
      setErr(`Load failed: ${e?.message ?? "unknown"}`);
    } finally {
      setLoading(false);
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
      const res = await fetch("/api/drone/components/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: selectedUploadId }),
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const serverMsg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setErr(`Extract failed: ${String(serverMsg)}`);
        return;
      }

      const extracted = payload.json?.extracted;
      if (!extracted || extracted.kind !== "drone_components") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue({
        kind: "drone_components",
        components: Array.isArray(extracted.components) ? extracted.components : blankValue().components,
        source_upload_id: extracted.source_upload_id ?? selectedUploadId,
        saved_at: extracted.saved_at,
      });

      setMsg("Extracted ✅ (review fields, then Save)");
    } catch (e: any) {
      setErr(`Extract failed: ${e?.message ?? "unknown"}`);
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (!selectedUploadId) {
      setErr("Select a drone screenshot first.");
      return;
    }

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/drone/components/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          upload_id: selectedUploadId,
          value: {
            kind: "drone_components",
            components: value.components,
          },
        }),
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const serverMsg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setErr(`Save failed: ${String(serverMsg)}`);
        return;
      }

      await load();
      setMsg("Saved ✅");
    } catch (e: any) {
      setErr(`Save failed: ${e?.message ?? "unknown"}`);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUploadId]);

  return (
    <div className="space-y-4">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div> : null}
      {msg ? <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{msg}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">Enter the % and Lv shown on each component tile.</div>
        <div className="flex gap-2">
          <button
            onClick={() => void extract()}
            disabled={extracting || !selectedUploadId}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "Extract from Image"}
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Reload"}
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || !selectedUploadId}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {value.components.map((c, idx) => (
          <div key={`${c.slot}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">
              {c.label || `Component ${c.slot}`}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/60">Percent</div>
                <input
                  value={c.percent ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setValue((s) => {
                      const next = [...s.components];
                      next[idx] = {
                        ...next[idx],
                        percent: Number.isFinite(v as number) ? Math.trunc(v as number) : null,
                      };
                      return { ...s, components: next };
                    });
                  }}
                  placeholder="e.g. 63"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <div className="text-xs text-white/60">Level</div>
                <input
                  value={c.level ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setValue((s) => {
                      const next = [...s.components];
                      next[idx] = {
                        ...next[idx],
                        level: Number.isFinite(v as number) ? Math.trunc(v as number) : null,
                      };
                      return { ...s, components: next };
                    });
                  }}
                  placeholder="e.g. 8"
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
