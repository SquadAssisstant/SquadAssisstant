"use client";

import React, { useEffect, useState } from "react";

type BranchType = "attack" | "defense" | "hp";

type TrainBranch = {
  type: BranchType;
  name: string | null;
  level: number | null;
  hero_bonus: {
    stat: string | null;
    current: number | null;
    next: number | null;
  };
  overlord_bonus: {
    stat: string | null;
    current: number | null;
    next: number | null;
  };
  requirements: Array<{
    item_index: number;
    current: number | null;
    required: number | null;
  }>;
};

type TrainValue = {
  kind: "overlord_train";
  bond_title: string | null;
  power: number | null;
  selected_branch: BranchType | null;
  branches: Record<BranchType, TrainBranch>;
  note: string | null;
  source_upload_id?: number;
  saved_at?: string;
};

function emptyBranch(type: BranchType): TrainBranch {
  return {
    type,
    name: null,
    level: null,
    hero_bonus: { stat: null, current: null, next: null },
    overlord_bonus: { stat: null, current: null, next: null },
    requirements: [
      { item_index: 1, current: null, required: null },
      { item_index: 2, current: null, required: null },
    ],
  };
}

function blankValue(): TrainValue {
  return {
    kind: "overlord_train",
    bond_title: null,
    power: null,
    selected_branch: null,
    branches: {
      attack: emptyBranch("attack"),
      defense: emptyBranch("defense"),
      hp: emptyBranch("hp"),
    },
    note: null,
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

export function OverlordTrainEditor({ selectedUploadId }: { selectedUploadId: number | null }) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [value, setValue] = useState<TrainValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/overlord/train/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });
      const payload = await safeReadResponse(res);

      if (!res.ok) {
        setErr(`Load failed: ${payload.json?.error ?? payload.text ?? `HTTP ${res.status}`}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "overlord_train") {
        setValue(factsValue as TrainValue);
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
      const res = await fetch("/api/overlord/train/extract", {
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
      if (!extracted || extracted.kind !== "overlord_train") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue(extracted as TrainValue);
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
      const res = await fetch("/api/overlord/train/save", {
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

  function setBranch(type: BranchType, patch: Partial<TrainBranch>) {
    setValue((s) => ({
      ...s,
      branches: {
        ...s.branches,
        [type]: {
          ...s.branches[type],
          ...patch,
        },
      },
    }));
  }

  return (
    <div className="space-y-4">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div> : null}
      {msg ? <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{msg}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">Extract and manage attack, defense, and HP training branches.</div>
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
        <input value={value.bond_title ?? ""} onChange={(e) => setValue((s) => ({ ...s, bond_title: e.target.value || null }))} placeholder="Bond title" className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        <input value={value.power ?? ""} onChange={(e) => setValue((s) => ({ ...s, power: e.target.value ? Number(e.target.value) : null }))} placeholder="Power" className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
        <input value={value.selected_branch ?? ""} onChange={(e) => setValue((s) => ({ ...s, selected_branch: (e.target.value as BranchType) || null }))} placeholder="Selected branch" className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
      </div>

      {(["attack", "defense", "hp"] as BranchType[]).map((type) => {
        const branch = value.branches[type];
        return (
          <div key={type} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold text-white uppercase">{type}</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={branch.name ?? ""} onChange={(e) => setBranch(type, { name: e.target.value || null })} placeholder="Branch name" className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              <input value={branch.level ?? ""} onChange={(e) => setBranch(type, { level: e.target.value ? Number(e.target.value) : null })} placeholder="Level" className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
