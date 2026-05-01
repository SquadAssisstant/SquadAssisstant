"use client";

import React, { useEffect, useState } from "react";

type OverlordSkill = {
  slot: number;
  name: string | null;
  level: number | null;
  max_level: number | null;
  type: string | null;
  category: string | null;
  cooldown: number | null;
  description: string | null;
  scaling_detail: string | null;
  bonuses: string[];
  locked_bonuses: string[];
  upgrade_progress: {
    current: number | null;
    required: number | null;
  } | null;
  stars: number | null;
};

type OverlordSkillsValue = {
  kind: "overlord_skills";
  selected_slot: number | null;
  skills: OverlordSkill[];
  source_upload_id?: number;
  saved_at?: string;
};

function blankValue(): OverlordSkillsValue {
  return {
    kind: "overlord_skills",
    selected_slot: null,
    skills: [],
  };
}

function hasOverlordSkillData(skill: OverlordSkill | undefined): boolean {
  return Boolean(
    skill?.name ||
      skill?.level != null ||
      skill?.max_level != null ||
      skill?.type ||
      skill?.category ||
      skill?.cooldown != null ||
      skill?.description ||
      skill?.scaling_detail ||
      skill?.bonuses?.length ||
      skill?.locked_bonuses?.length ||
      skill?.upgrade_progress?.current != null ||
      skill?.upgrade_progress?.required != null ||
      skill?.stars != null
  );
}

function blankSkill(slot: number): OverlordSkill {
  return {
    slot,
    name: null,
    level: null,
    max_level: null,
    type: null,
    category: null,
    cooldown: null,
    description: null,
    scaling_detail: null,
    bonuses: [],
    locked_bonuses: [],
    upgrade_progress: null,
    stars: null,
  };
}

function mergeExtractedOverlordSkills(
  current: OverlordSkillsValue,
  extracted: OverlordSkillsValue
): OverlordSkillsValue {
  const bySlot = new Map<number, OverlordSkill>();

  for (const skill of current.skills ?? []) {
    bySlot.set(skill.slot, skill);
  }

  for (const extractedSkill of extracted.skills ?? []) {
    if (!hasOverlordSkillData(extractedSkill)) continue;

    const slot = extractedSkill.slot ?? bySlot.size + 1;
    const oldSkill = bySlot.get(slot) ?? blankSkill(slot);

    bySlot.set(slot, {
      ...oldSkill,
      slot,
      name: extractedSkill.name ?? oldSkill.name,
      level: extractedSkill.level ?? oldSkill.level,
      max_level: extractedSkill.max_level ?? oldSkill.max_level,
      type: extractedSkill.type ?? oldSkill.type,
      category: extractedSkill.category ?? oldSkill.category,
      cooldown: extractedSkill.cooldown ?? oldSkill.cooldown,
      description: extractedSkill.description ?? oldSkill.description,
      scaling_detail: extractedSkill.scaling_detail ?? oldSkill.scaling_detail,
      bonuses: extractedSkill.bonuses?.length ? extractedSkill.bonuses : oldSkill.bonuses ?? [],
      locked_bonuses: extractedSkill.locked_bonuses?.length
        ? extractedSkill.locked_bonuses
        : oldSkill.locked_bonuses ?? [],
      upgrade_progress: extractedSkill.upgrade_progress ?? oldSkill.upgrade_progress,
      stars: extractedSkill.stars ?? oldSkill.stars,
    });
  }

  return {
    ...current,
    selected_slot: extracted.selected_slot ?? current.selected_slot,
    source_upload_id: extracted.source_upload_id ?? current.source_upload_id,
    skills: Array.from(bySlot.values()).sort((a, b) => a.slot - b.slot),
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

export function OverlordSkillsEditor({ selectedUploadId }: { selectedUploadId: number | null }) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [value, setValue] = useState<OverlordSkillsValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/overlord/skills/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });

      const payload = await safeReadResponse(res);
      if (!res.ok) {
        setErr(`Load failed: ${payload.json?.error ?? payload.text ?? `HTTP ${res.status}`}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "overlord_skills") {
        setValue(factsValue as OverlordSkillsValue);
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
      const res = await fetch("/api/overlord/skills/extract", {
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
      if (!extracted || extracted.kind !== "overlord_skills") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue((current) =>
  mergeExtractedOverlordSkills(current, extracted as OverlordSkillsValue)
);
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
      const res = await fetch("/api/overlord/skills/save", {
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

  function updateSkill(idx: number, patch: Partial<OverlordSkill>) {
    setValue((s) => {
      const next = [...s.skills];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, skills: next };
    });
  }

  function updateStringArray(idx: number, field: "bonuses" | "locked_bonuses", raw: string) {
    const lines = raw
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
    updateSkill(idx, { [field]: lines } as Partial<OverlordSkill>);
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
        <div className="text-sm text-white/70">Extract overlord skills, scaling, bonuses, and upgrade progress.</div>
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

      <label className="rounded-2xl border border-white/10 bg-white/5 p-3 block max-w-xs">
        <div className="text-xs text-white/60">Selected Slot</div>
        <input
          value={value.selected_slot ?? ""}
          onChange={(e) => setValue((s) => ({ ...s, selected_slot: e.target.value ? Number(e.target.value) : null }))}
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
        />
      </label>

      <div className="space-y-4">
        {value.skills.map((skill, idx) => (
          <div key={`${skill.slot}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label>
                <div className="text-xs text-white/60">Slot</div>
                <input value={skill.slot ?? ""} onChange={(e) => updateSkill(idx, { slot: e.target.value ? Number(e.target.value) : idx + 1 })} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </label>
              <label>
                <div className="text-xs text-white/60">Name</div>
                <input value={skill.name ?? ""} onChange={(e) => updateSkill(idx, { name: e.target.value || null })} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </label>
              <label>
                <div className="text-xs text-white/60">Level</div>
                <input value={skill.level ?? ""} onChange={(e) => updateSkill(idx, { level: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </label>
              <label>
                <div className="text-xs text-white/60">Max Level</div>
                <input value={skill.max_level ?? ""} onChange={(e) => updateSkill(idx, { max_level: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label>
                <div className="text-xs text-white/60">Type</div>
                <input value={skill.type ?? ""} onChange={(e) => updateSkill(idx, { type: e.target.value || null })} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </label>
              <label>
                <div className="text-xs text-white/60">Category</div>
                <input value={skill.category ?? ""} onChange={(e) => updateSkill(idx, { category: e.target.value || null })} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </label>
              <label>
                <div className="text-xs text-white/60">Cooldown</div>
                <input value={skill.cooldown ?? ""} onChange={(e) => updateSkill(idx, { cooldown: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </label>
              <label>
                <div className="text-xs text-white/60">Stars</div>
                <input value={skill.stars ?? ""} onChange={(e) => updateSkill(idx, { stars: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </label>
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60">Description</div>
              <textarea value={skill.description ?? ""} onChange={(e) => updateSkill(idx, { description: e.target.value || null })} rows={4} className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60">Scaling Detail</div>
              <textarea value={skill.scaling_detail ?? ""} onChange={(e) => updateSkill(idx, { scaling_detail: e.target.value || null })} rows={3} className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-white/60">Bonuses (one per line)</div>
                <textarea value={(skill.bonuses ?? []).join("\n")} onChange={(e) => updateStringArray(idx, "bonuses", e.target.value)} rows={4} className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <div className="text-xs text-white/60">Locked Bonuses (one per line)</div>
                <textarea value={(skill.locked_bonuses ?? []).join("\n")} onChange={(e) => updateStringArray(idx, "locked_bonuses", e.target.value)} rows={4} className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label>
                <div className="text-xs text-white/60">Upgrade Current</div>
                <input
                  value={skill.upgrade_progress?.current ?? ""}
                  onChange={(e) =>
                    updateSkill(idx, {
                      upgrade_progress: {
                        current: e.target.value ? Number(e.target.value) : null,
                        required: skill.upgrade_progress?.required ?? null,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label>
                <div className="text-xs text-white/60">Upgrade Required</div>
                <input
                  value={skill.upgrade_progress?.required ?? ""}
                  onChange={(e) =>
                    updateSkill(idx, {
                      upgrade_progress: {
                        current: skill.upgrade_progress?.current ?? null,
                        required: e.target.value ? Number(e.target.value) : null,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          </div>
        ))}

        {value.skills.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No saved skills yet. Extract from image or add them later from the page wiring.
          </div>
        ) : null}
      </div>
    </div>
  );
    }
