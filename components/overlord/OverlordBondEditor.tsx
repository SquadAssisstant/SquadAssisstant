"use client";

import React, { useEffect, useState } from "react";

type BondTier = {
  order: number;
  title: string | null;
  is_current: boolean;
  is_unlocked: boolean;
  requirement_text: string | null;
};

type BondValue = {
  kind: "overlord_bond";
  current_title: string | null;
  current_rank: string | null;
  next_rank: string | null;
  tiers: BondTier[];
  squad_bonus: {
    attack: { base: number | null; increase: number | null };
    defense: { base: number | null; increase: number | null };
    hp: { base: number | null; increase: number | null };
  };
  overlord_bonus: {
    hp_boost: { current: number | null; next: number | null };
    attack_boost: { current: number | null; next: number | null };
    defense_boost: { current: number | null; next: number | null };
    resistance: { current: number | null; next: number | null };
    march_size: { current: number | null; next: number | null };
  };
  cost: { current: number | null; required: number | null };
  requirement_note: string | null;
  source_upload_id?: number;
  saved_at?: string;
};

function blankValue(): BondValue {
  return {
    kind: "overlord_bond",
    current_title: null,
    current_rank: null,
    next_rank: null,
    tiers: [],
    squad_bonus: {
      attack: { base: null, increase: null },
      defense: { base: null, increase: null },
      hp: { base: null, increase: null },
    },
    overlord_bonus: {
      hp_boost: { current: null, next: null },
      attack_boost: { current: null, next: null },
      defense_boost: { current: null, next: null },
      resistance: { current: null, next: null },
      march_size: { current: null, next: null },
    },
    cost: { current: null, required: null },
    requirement_note: null,
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

export function OverlordBondEditor({ selectedUploadId }: { selectedUploadId: number | null }) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [value, setValue] = useState<BondValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/overlord/bond/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });
      const payload = await safeReadResponse(res);

      if (!res.ok) {
        setErr(`Load failed: ${payload.json?.error ?? payload.text ?? `HTTP ${res.status}`}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "overlord_bond") {
        setValue(factsValue as BondValue);
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
      const res = await fetch("/api/overlord/bond/extract", {
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
      if (!extracted || extracted.kind !== "overlord_bond") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue((current) => ({
  ...current,
  ...extracted,
  current_title: extracted.current_title ?? current.current_title,
  current_rank: extracted.current_rank ?? current.current_rank,
  next_rank: extracted.next_rank ?? current.next_rank,
  tiers: extracted.tiers?.length ? extracted.tiers : current.tiers,
  squad_bonus: extracted.squad_bonus ?? current.squad_bonus,
  overlord_bonus: extracted.overlord_bonus ?? current.overlord_bonus,
  cost: extracted.cost ?? current.cost,
  requirement_note: extracted.requirement_note ?? current.requirement_note,
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
      const res = await fetch("/api/overlord/bond/save", {
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

  function updateTier(idx: number, patch: Partial<BondTier>) {
    setValue((s) => {
      const next = [...s.tiers];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, tiers: next };
    });
  }

  return (
    <div className="space-y-4">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div> : null}
      {msg ? <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{msg}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">Extract bond rating, ladder, squad bonuses, and overlord bonuses.</div>
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

      <div className="grid gap-3 md:grid-cols-3">
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Current Title</div>
          <input value={value.current_title ?? ""} onChange={(e) => setValue((s) => ({ ...s, current_title: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Current Rank</div>
          <input value={value.current_rank ?? ""} onChange={(e) => setValue((s) => ({ ...s, current_rank: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Next Rank</div>
          <input value={value.next_rank ?? ""} onChange={(e) => setValue((s) => ({ ...s, next_rank: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold text-white">Tiers</div>
        <div className="mt-3 space-y-3">
          {value.tiers.map((tier, idx) => (
            <div key={`${tier.order}-${idx}`} className="grid gap-3 md:grid-cols-5">
              <input value={tier.order ?? ""} onChange={(e) => updateTier(idx, { order: e.target.value ? Number(e.target.value) : idx + 1 })} className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              <input value={tier.title ?? ""} onChange={(e) => updateTier(idx, { title: e.target.value || null })} className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              <input value={tier.requirement_text ?? ""} onChange={(e) => updateTier(idx, { requirement_text: e.target.value || null })} className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2" />
              <div className="flex items-center gap-3 text-sm text-white">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={tier.is_current} onChange={(e) => updateTier(idx, { is_current: e.target.checked })} />
                  current
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={tier.is_unlocked} onChange={(e) => updateTier(idx, { is_unlocked: e.target.checked })} />
                  unlocked
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
          }
