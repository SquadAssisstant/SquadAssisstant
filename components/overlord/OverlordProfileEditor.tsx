"use client";

import React, { useEffect, useState } from "react";

type PreviewSkill = {
  slot: number;
  level: number | null;
  stars: number | null;
  name: string | null;
};

type OverlordProfileValue = {
  kind: "overlord_profile";
  name: string | null;
  role: string | null;
  tier_badge: number | null;
  level: number | null;
  power: number | null;
  stats: {
    attack: number | null;
    hp: number | null;
    defense: number | null;
    march_size: number | null;
  };
  skill_preview: PreviewSkill[];
  source_upload_id?: number;
  saved_at?: string;
};

function blankValue(): OverlordProfileValue {
  return {
    kind: "overlord_profile",
    name: null,
    role: null,
    tier_badge: null,
    level: null,
    power: null,
    stats: {
      attack: null,
      hp: null,
      defense: null,
      march_size: null,
    },
    skill_preview: [],
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

export function OverlordProfileEditor({ selectedUploadId }: { selectedUploadId: number | null }) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [value, setValue] = useState<OverlordProfileValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/overlord/profile/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });

      const payload = await safeReadResponse(res);
      if (!res.ok) {
        setErr(`Load failed: ${payload.json?.error ?? payload.text ?? `HTTP ${res.status}`}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "overlord_profile") {
        setValue(factsValue as OverlordProfileValue);
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
      const res = await fetch("/api/overlord/profile/extract", {
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
      if (!extracted || extracted.kind !== "overlord_profile") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue(extracted as OverlordProfileValue);
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
      const res = await fetch("/api/overlord/profile/save", {
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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUploadId]);

  return (
    <div className="space-y-4">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div> : null}
      {msg ? <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{msg}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">Review overlord overview, stats, and skill preview.</div>
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
          <div className="text-xs text-white/60">Name</div>
          <input value={value.name ?? ""} onChange={(e) => setValue((s) => ({ ...s, name: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Role</div>
          <input value={value.role ?? ""} onChange={(e) => setValue((s) => ({ ...s, role: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Tier Badge</div>
          <input value={value.tier_badge ?? ""} onChange={(e) => setValue((s) => ({ ...s, tier_badge: e.target.value ? Number(e.target.value) : null }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>

        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Level</div>
          <input value={value.level ?? ""} onChange={(e) => setValue((s) => ({ ...s, level: e.target.value ? Number(e.target.value) : null }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Power</div>
          <input value={value.power ?? ""} onChange={(e) => setValue((s) => ({ ...s, power: e.target.value ? Number(e.target.value) : null }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Attack</div>
          <input value={value.stats.attack ?? ""} onChange={(e) => setValue((s) => ({ ...s, stats: { ...s.stats, attack: e.target.value ? Number(e.target.value) : null } }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">HP</div>
          <input value={value.stats.hp ?? ""} onChange={(e) => setValue((s) => ({ ...s, stats: { ...s.stats, hp: e.target.value ? Number(e.target.value) : null } }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Defense</div>
          <input value={value.stats.defense ?? ""} onChange={(e) => setValue((s) => ({ ...s, stats: { ...s.stats, defense: e.target.value ? Number(e.target.value) : null } }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
        <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">March Size</div>
          <input value={value.stats.march_size ?? ""} onChange={(e) => setValue((s) => ({ ...s, stats: { ...s.stats, march_size: e.target.value ? Number(e.target.value) : null } }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold text-white">Skill Preview</div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          {value.skill_preview.map((skill, idx) => (
            <div key={`${skill.slot}-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-white/50">Slot</div>
              <input value={skill.slot ?? ""} onChange={(e) => {
                const next = [...value.skill_preview];
                next[idx] = { ...next[idx], slot: e.target.value ? Number(e.target.value) : idx + 1 };
                setValue((s) => ({ ...s, skill_preview: next }));
              }} className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white" />
              <div className="mt-2 text-xs text-white/50">Level</div>
              <input value={skill.level ?? ""} onChange={(e) => {
                const next = [...value.skill_preview];
                next[idx] = { ...next[idx], level: e.target.value ? Number(e.target.value) : null };
                setValue((s) => ({ ...s, skill_preview: next }));
              }} className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white" />
              <div className="mt-2 text-xs text-white/50">Stars</div>
              <input value={skill.stars ?? ""} onChange={(e) => {
                const next = [...value.skill_preview];
                next[idx] = { ...next[idx], stars: e.target.value ? Number(e.target.value) : null };
                setValue((s) => ({ ...s, skill_preview: next }));
              }} className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
                                                                            }
