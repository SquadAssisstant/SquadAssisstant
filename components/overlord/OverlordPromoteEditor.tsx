"use client";

import React, { useEffect, useState } from "react";

type PromoteValue = {
  kind: "overlord_promote";
  stat_upgrades: {
    hp: { current: number | null; next: number | null };
    attack: { current: number | null; next: number | null };
    defense: { current: number | null; next: number | null };
  };
  boosts: {
    hp_boost: { current: number | null; next: number | null };
    attack_boost: { current: number | null; next: number | null };
    defense_boost: { current: number | null; next: number | null };
  };
  requirements: Array<{
    item_index: number;
    current: number | null;
    required: number | null;
  }>;
  source_upload_id?: number;
  saved_at?: string;
};

function blankValue(): PromoteValue {
  return {
    kind: "overlord_promote",
    stat_upgrades: {
      hp: { current: null, next: null },
      attack: { current: null, next: null },
      defense: { current: null, next: null },
    },
    boosts: {
      hp_boost: { current: null, next: null },
      attack_boost: { current: null, next: null },
      defense_boost: { current: null, next: null },
    },
    requirements: [
      { item_index: 1, current: null, required: null },
      { item_index: 2, current: null, required: null },
      { item_index: 3, current: null, required: null },
    ],
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

export function OverlordPromoteEditor({ selectedUploadId }: { selectedUploadId: number | null }) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [value, setValue] = useState<PromoteValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/overlord/promote/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });

      const payload = await safeReadResponse(res);
      if (!res.ok) {
        setErr(`Load failed: ${payload.json?.error ?? payload.text ?? `HTTP ${res.status}`}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "overlord_promote") {
        setValue(factsValue as PromoteValue);
      } else {
        setValue({ ...blankValue(), source_upload_id: selectedUploadId });
      }
    } catch (e: any) {
      setErr(`Load failed: ${e?.message ?? "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  async function extract() {
    if (!selectedUploadId) {
      setErr("Select an overlord screenshot first.");
      return;
    }

    setExtracting(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/overlord/promote/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: selectedUploadId }),
      });

      const payload = await safeReadResponse(res);
      if (!res.ok) {
        setErr(`Extract failed: ${payload.json?.error ?? payload.text ?? `HTTP ${res.status}`}`);
        return;
      }

      const extracted = payload.json?.extracted;
      if (!extracted || extracted.kind !== "overlord_promote") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue((current) => ({
  ...current,
  ...extracted,
  stat_upgrades: extracted.stat_upgrades ?? current.stat_upgrades,
  boosts: extracted.boosts ?? current.boosts,
  requirements: extracted.requirements?.length
    ? extracted.requirements
    : current.requirements,
  source_upload_id: extracted.source_upload_id ?? current.source_upload_id,
}));
      setMsg("Extracted ✅ (review fields, then Save)");
    } catch (e: any) {
      setErr(`Extract failed: ${e?.message ?? "unknown"}`);
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (!selectedUploadId) {
      setErr("Select an overlord screenshot first.");
      return;
    }

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/overlord/promote/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          upload_id: selectedUploadId,
          value,
        }),
      });

      const payload = await safeReadResponse(res);
      if (!res.ok) {
        setErr(`Save failed: ${payload.json?.error ?? payload.text ?? `HTTP ${res.status}`}`);
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

  function setReq(idx: number, patch: Partial<{ current: number | null; required: number | null }>) {
    setValue((s) => {
      const next = [...s.requirements];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, requirements: next };
    });
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
        <div className="text-sm text-white/70">Extract promote stat upgrades, boosts, and requirements.</div>
        <div className="flex gap-2">
          <button onClick={() => void extract()} disabled={extracting || !selectedUploadId} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-50">
            {extracting ? "Extracting…" : "Extract from Image"}
          </button>
          <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-50">
            {loading ? "Loading…" : "Reload"}
          </button>
          <button onClick={() => void save()} disabled={saving || !selectedUploadId} className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(["hp", "attack", "defense"] as const).map((stat) => (
          <div key={stat} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white uppercase">{stat}</div>
            <div className="mt-3 grid gap-3">
              <label>
                <div className="text-xs text-white/60">Current</div>
                <input
                  value={value.stat_upgrades[stat].current ?? ""}
                  onChange={(e) =>
                    setValue((s) => ({
                      ...s,
                      stat_upgrades: {
                        ...s.stat_upgrades,
                        [stat]: {
                          ...s.stat_upgrades[stat],
                          current: e.target.value ? Number(e.target.value) : null,
                        },
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label>
                <div className="text-xs text-white/60">Next</div>
                <input
                  value={value.stat_upgrades[stat].next ?? ""}
                  onChange={(e) =>
                    setValue((s) => ({
                      ...s,
                      stat_upgrades: {
                        ...s.stat_upgrades,
                        [stat]: {
                          ...s.stat_upgrades[stat],
                          next: e.target.value ? Number(e.target.value) : null,
                        },
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(["hp_boost", "attack_boost", "defense_boost"] as const).map((stat) => (
          <div key={stat} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white uppercase">{stat}</div>
            <div className="mt-3 grid gap-3">
              <label>
                <div className="text-xs text-white/60">Current %</div>
                <input
                  value={value.boosts[stat].current ?? ""}
                  onChange={(e) =>
                    setValue((s) => ({
                      ...s,
                      boosts: {
                        ...s.boosts,
                        [stat]: {
                          ...s.boosts[stat],
                          current: e.target.value ? Number(e.target.value) : null,
                        },
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label>
                <div className="text-xs text-white/60">Next %</div>
                <input
                  value={value.boosts[stat].next ?? ""}
                  onChange={(e) =>
                    setValue((s) => ({
                      ...s,
                      boosts: {
                        ...s.boosts,
                        [stat]: {
                          ...s.boosts[stat],
                          next: e.target.value ? Number(e.target.value) : null,
                        },
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold text-white">Requirements</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {value.requirements.map((req, idx) => (
            <div key={req.item_index} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-white/50">Item {req.item_index}</div>
              <div className="mt-2">
                <div className="text-xs text-white/60">Current</div>
                <input
                  value={req.current ?? ""}
                  onChange={(e) => setReq(idx, { current: e.target.value ? Number(e.target.value) : null })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white"
                />
              </div>
              <div className="mt-2">
                <div className="text-xs text-white/60">Required</div>
                <input
                  value={req.required ?? ""}
                  onChange={(e) => setReq(idx, { required: e.target.value ? Number(e.target.value) : null })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
                  }
