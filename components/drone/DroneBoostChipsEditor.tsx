"use client";

import React, { useEffect, useMemo, useState } from "react";

type SquadSlot = 1 | 2 | 3 | 4;
type TroopType = "tank" | "air" | "missile";
type ChipSkillType = "initial_move" | "offensive" | "defense" | "interference";

type ChipSkill = {
  name: string | null;
  troop_type: TroopType;
  skill_type: ChipSkillType;
  chip_power: number | null;
  description: string | null;
};

type ChipSet = {
  troop_type: TroopType;
  label: string;
  assigned_squad_slot: SquadSlot | null;
  displayed_squad_power: string | null;
  skills: Record<ChipSkillType, ChipSkill>;
};

type BoostChipsValue = {
  kind: "drone_boost_chips";
  chip_sets: Record<TroopType, ChipSet>;
  combat_boost: {
    notes: string | null;
    raw: Record<string, string | null>;
  };
  source_upload_id?: number;
  saved_at?: string;
};

const troopTypes: TroopType[] = ["tank", "air", "missile"];
const squadSlots: SquadSlot[] = [1, 2, 3, 4];
const skillTypes: ChipSkillType[] = ["initial_move", "offensive", "defense", "interference"];

function prettyTroop(t: TroopType) {
  return t === "tank" ? "Tank" : t === "air" ? "Air" : "Missile";
}

function prettySkill(t: ChipSkillType) {
  if (t === "initial_move") return "Initial Move";
  if (t === "offensive") return "Offensive";
  if (t === "defense") return "Defense";
  return "Interference";
}

function blankSkill(troop_type: TroopType, skill_type: ChipSkillType): ChipSkill {
  return { troop_type, skill_type, name: null, chip_power: null, description: null };
}

function blankSet(troop_type: TroopType): ChipSet {
  return {
    troop_type,
    label: `${prettyTroop(troop_type)} Chip Set`,
    assigned_squad_slot: null,
    displayed_squad_power: null,
    skills: {
      initial_move: blankSkill(troop_type, "initial_move"),
      offensive: blankSkill(troop_type, "offensive"),
      defense: blankSkill(troop_type, "defense"),
      interference: blankSkill(troop_type, "interference"),
    },
  };
}

function blankValue(): BoostChipsValue {
  return {
    kind: "drone_boost_chips",
    chip_sets: {
      tank: blankSet("tank"),
      air: blankSet("air"),
      missile: blankSet("missile"),
    },
    combat_boost: {
      notes: null,
      raw: {},
    },
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

export function DroneBoostChipsEditor({
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

  const [value, setValue] = useState<BoostChipsValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/drone/boost_chips/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const serverMsg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setErr(`Load failed: ${String(serverMsg)}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "drone_boost_chips") {
        setValue(factsValue as BoostChipsValue);
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
      setErr("Select a drone screenshot first.");
      return;
    }

    setExtracting(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/drone/boost_chips/extract", {
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
      if (!extracted || extracted.kind !== "drone_boost_chips") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue(extracted as BoostChipsValue);
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
      const res = await fetch("/api/drone/boost_chips/save", {
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

  const assignedMap = useMemo(() => {
    const used: Partial<Record<SquadSlot, TroopType[]>> = {};
    for (const tt of troopTypes) {
      const slot = value.chip_sets[tt]?.assigned_squad_slot;
      if (slot) {
        used[slot] = used[slot] ?? [];
        used[slot]!.push(tt);
      }
    }
    return used;
  }, [value]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUploadId]);

  return (
    <div className="space-y-4">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div> : null}
      {msg ? <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{msg}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">
          Review the extracted chip set and any combat/boost notes together in one place.
        </div>
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

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-[0.25em] text-white/45">Combat Boost Notes</div>
        <textarea
          value={value.combat_boost.notes ?? ""}
          onChange={(e) =>
            setValue((s) => ({
              ...s,
              combat_boost: {
                ...s.combat_boost,
                notes: e.target.value || null,
              },
            }))
          }
          rows={4}
          placeholder="Combat boost summary / notes"
          className="mt-3 w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
        />
      </div>

      {troopTypes.map((tt) => {
        const set = value.chip_sets[tt];
        const slot = set.assigned_squad_slot;

        return (
          <div key={tt} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{prettyTroop(tt)} Chip Set</div>
                <div className="text-sm text-white/60">
                  {set.displayed_squad_power ? `Squad Power: ${set.displayed_squad_power}` : "Squad Power: —"}
                  <span className="mx-2 text-white/30">•</span>
                  {slot
                    ? `Assigned to Squad Slot ${slot}${assignedMap[slot] && assignedMap[slot]!.length > 1 ? " (⚠️ multiple sets assigned)" : ""}`
                    : "Not assigned"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-white/60">Squad slot</div>
                <select
                  value={slot ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? (Number(e.target.value) as SquadSlot) : null;
                    setValue((s) => ({
                      ...s,
                      chip_sets: { ...s.chip_sets, [tt]: { ...s.chip_sets[tt], assigned_squad_slot: v } },
                    }));
                  }}
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="">—</option>
                  {squadSlots.map((s) => (
                    <option key={s} value={s}>
                      Slot {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {skillTypes.map((skillType) => {
                const skill = set.skills[skillType];

                return (
                  <div key={skillType} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/50">{prettySkill(skillType)}</div>

                    <div className="mt-2 space-y-2">
                      <input
                        value={skill.name ?? ""}
                        onChange={(e) => {
                          const name = e.target.value || null;
                          setValue((s) => ({
                            ...s,
                            chip_sets: {
                              ...s.chip_sets,
                              [tt]: {
                                ...s.chip_sets[tt],
                                skills: { ...s.chip_sets[tt].skills, [skillType]: { ...skill, name } },
                              },
                            },
                          }));
                        }}
                        placeholder="Chip name"
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />

                      <input
                        value={skill.chip_power ?? ""}
                        onChange={(e) => {
                          const n = e.target.value ? Number(e.target.value) : null;
                          setValue((s) => ({
                            ...s,
                            chip_sets: {
                              ...s.chip_sets,
                              [tt]: {
                                ...s.chip_sets[tt],
                                skills: {
                                  ...s.chip_sets[tt].skills,
                                  [skillType]: {
                                    ...skill,
                                    chip_power: Number.isFinite(n as number) ? Math.trunc(n as number) : null,
                                  },
                                },
                              },
                            },
                          }));
                        }}
                        placeholder="Chip power"
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />

                      <textarea
                        value={skill.description ?? ""}
                        onChange={(e) => {
                          const description = e.target.value || null;
                          setValue((s) => ({
                            ...s,
                            chip_sets: {
                              ...s.chip_sets,
                              [tt]: {
                                ...s.chip_sets[tt],
                                skills: { ...s.chip_sets[tt].skills, [skillType]: { ...skill, description } },
                              },
                            },
                          }));
                        }}
                        placeholder="Optional notes"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
