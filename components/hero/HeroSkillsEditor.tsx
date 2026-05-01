"use client";

import React, { useEffect, useState } from "react";

type HeroSkill = {
  slot: number;
  name: string | null;
  level: number | null;
  summary: string | null;
  scaling_detail: string | null;
};

type HeroSkillsValue = {
  kind: "hero_skills";
  skills: HeroSkill[];
  source_upload_id?: number;
  saved_at?: string;
};

function blankValue(): HeroSkillsValue {
  return {
    kind: "hero_skills",
    skills: [],
  };
}

function hasSkillData(skill: HeroSkill | undefined): boolean {
  return Boolean(
    skill?.name ||
      skill?.level != null ||
      skill?.summary ||
      skill?.scaling_detail
  );
}

function mergeExtractedHeroSkills(
  current: HeroSkillsValue,
  extracted: HeroSkillsValue
): HeroSkillsValue {
  const bySlot = new Map<number, HeroSkill>();

  for (const skill of current.skills) {
    bySlot.set(skill.slot, skill);
  }

  for (const extractedSkill of extracted.skills ?? []) {
    if (!hasSkillData(extractedSkill)) continue;

    const oldSkill = bySlot.get(extractedSkill.slot) ?? {
      slot: extractedSkill.slot,
      name: null,
      level: null,
      summary: null,
      scaling_detail: null,
    };

    bySlot.set(extractedSkill.slot, {
      ...oldSkill,
      name: extractedSkill.name ?? oldSkill.name,
      level: extractedSkill.level ?? oldSkill.level,
      summary: extractedSkill.summary ?? oldSkill.summary,
      scaling_detail:
        extractedSkill.scaling_detail ?? oldSkill.scaling_detail,
    });
  }

  return {
    ...current,
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

export function HeroSkillsEditor({ selectedUploadId }: { selectedUploadId: number | null }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [value, setValue] = useState<HeroSkillsValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/hero/skills/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const serverMsg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setErr(`Load failed: ${String(serverMsg)}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "hero_skills") {
        setValue(factsValue as HeroSkillsValue);
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
      setErr("Select a hero screenshot first.");
      return;
    }

    setExtracting(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/hero/skills/extract", {
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
      if (!extracted || extracted.kind !== "hero_skills") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue((current) =>
  mergeExtractedHeroSkills(current, extracted as HeroSkillsValue)
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
      setErr("Select a hero screenshot first.");
      return;
    }

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/hero/skills/save", {
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

  function updateSkill(idx: number, patch: Partial<HeroSkill>) {
    setValue((s) => {
      const next = [...s.skills];
      next[idx] = {
        ...next[idx],
        ...patch,
      };
      return { ...s, skills: next };
    });
  }

  function addSkill() {
    setValue((s) => ({
      ...s,
      skills: [
        ...s.skills,
        {
          slot: s.skills.length + 1,
          name: null,
          level: null,
          summary: null,
          scaling_detail: null,
        },
      ],
    }));
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
        <div className="text-sm text-white/70">Extract skills, levels, effect summaries, and scaling detail.</div>
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

      <button
        type="button"
        onClick={addSkill}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
      >
        Add Skill
      </button>

      <div className="space-y-4">
        {value.skills.map((skill, idx) => (
          <div key={`${skill.slot}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label>
                <div className="text-xs text-white/60">Slot</div>
                <input
                  value={skill.slot ?? ""}
                  onChange={(e) => updateSkill(idx, { slot: e.target.value ? Number(e.target.value) : idx + 1 })}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>

              <label>
                <div className="text-xs text-white/60">Skill Name</div>
                <input
                  value={skill.name ?? ""}
                  onChange={(e) => updateSkill(idx, { name: e.target.value || null })}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>

              <label>
                <div className="text-xs text-white/60">Level</div>
                <input
                  value={skill.level ?? ""}
                  onChange={(e) => updateSkill(idx, { level: e.target.value ? Number(e.target.value) : null })}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            <div className="mt-4">
              <div className="text-xs text-white/60">Summary</div>
              <textarea
                value={skill.summary ?? ""}
                onChange={(e) => updateSkill(idx, { summary: e.target.value || null })}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="mt-4">
              <div className="text-xs text-white/60">Scaling Detail</div>
              <textarea
                value={skill.scaling_detail ?? ""}
                onChange={(e) => updateSkill(idx, { scaling_detail: e.target.value || null })}
                rows={5}
                className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
        ))}

        {value.skills.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No saved skills yet. Extract from image or add skills manually.
          </div>
        ) : null}
      </div>
    </div>
  );
}
