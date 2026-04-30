// components/drone/DroneCombatBoostEditor.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type SquadSlot = 1 | 2 | 3 | 4;
type TroopType = "tank" | "air" | "missile";
type ChipSkillType = "initial_move" | "defense" | "interference" | "offensive";

type ChipSkill = {
  name: string;
  troop_type: TroopType;
  skill_type: ChipSkillType;
  chip_power?: number;
  description?: string;
};

type ChipSet = {
  troop_type: TroopType;
  label?: string;
  assigned_squad_slot: SquadSlot | null;
  displayed_squad_power?: string;
  skills: Partial<Record<ChipSkillType, ChipSkill>>;
};

type CombatBoostValue = {
  kind: "drone_combat_boost";
  chip_sets: Record<TroopType, ChipSet>;
  saved_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

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

function defaultSkill(troop_type: TroopType, skill_type: ChipSkillType, name: string): ChipSkill {
  return { troop_type, skill_type, name, description: "" };
}

function defaultSet(troop_type: TroopType): ChipSet {
  if (troop_type === "tank") {
    return {
      troop_type,
      label: "Tank Chip Set",
      assigned_squad_slot: null,
      skills: {
        initial_move: defaultSkill("tank", "initial_move", "Absolute Quantum Field (Tank)"),
        offensive: defaultSkill("tank", "offensive", "Lethal Firestorm (Tank)"),
        defense: defaultSkill("tank", "defense", "Gravitational Resonance Armor (Tank)"),
        interference: defaultSkill("tank", "interference", "Memory Ultra Fission (Tank)"),
      },
    };
  }

  return {
    troop_type,
    label: `${prettyTroop(troop_type)} Chip Set`,
    assigned_squad_slot: null,
    skills: {
      initial_move: defaultSkill(troop_type, "initial_move", `Initial Move (${prettyTroop(troop_type)})`),
      offensive: defaultSkill(troop_type, "offensive", `Offensive (${prettyTroop(troop_type)})`),
      defense: defaultSkill(troop_type, "defense", `Defense (${prettyTroop(troop_type)})`),
      interference: defaultSkill(troop_type, "interference", `Interference (${prettyTroop(troop_type)})`),
    },
  };
}

export function DroneCombatBoostEditor({
  selectedUploadId,
}: {
  selectedUploadId: number | null;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [value, setValue] = useState<CombatBoostValue>(() => ({
    kind: "drone_combat_boost",
    saved_at: nowIso(),
    chip_sets: {
      tank: defaultSet("tank"),
      air: defaultSet("air"),
      missile: defaultSet("missile"),
    },
  }));

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/drone/combat_boost/get?owner_id=${encodeURIComponent(ownerId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Load failed");
      if (json?.row?.value?.kind === "drone_combat_boost") {
        setValue(json.row.value as CombatBoostValue);
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
      const res = await fetch(`/api/drone/combat_boost/save`, {
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
      if (json?.row?.value?.kind === "drone_combat_boost") {
        setValue(json.row.value as CombatBoostValue);
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
        body: JSON.stringify({ upload_id: selectedUploadId, mode: "chips" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Extract failed");

      const ex = json?.extracted;
      if (!ex || ex.kind !== "drone_chipset_extracted") {
        setErr("Extract returned unexpected format.");
        return;
      }

      // determine troop type if visible; otherwise keep as-is
      const tt: TroopType | null = ex.troop_type ?? null;

      setValue((s) => {
        const next = { ...s, chip_sets: { ...s.chip_sets } };

        const targetTroop: TroopType = tt ?? "tank"; // default bucket if unknown
        const set = next.chip_sets[targetTroop] ?? defaultSet(targetTroop);

        const skills = { ...set.skills };

        for (const k of ["initial_move", "offensive", "defense", "interference"] as const) {
          const got = ex.skills?.[k];
          if (!got) continue;

          const prev = skills[k] ?? defaultSkill(targetTroop, k, "");
          skills[k] = {
            ...prev,
            name: got?.name ?? prev.name,
            chip_power: typeof got?.chip_power === "number" ? got.chip_power : prev.chip_power,
          };
        }

        next.chip_sets[targetTroop] = {
          ...set,
          displayed_squad_power: ex.displayed_squad_power ?? set.displayed_squad_power,
          skills,
        };

        return next;
      });

      setMsg("Extracted ✅ (review, then Save)");
    } catch (e: any) {
      setErr(e?.message ?? "Extract failed");
    } finally {
      setExtracting(false);
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  if (loading) return <div className="text-sm text-white/60">Loading Combat Boost…</div>;

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>
      ) : null}
      {msg ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{msg}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">
          Assign each troop-type chip set to the squad slot you use in-game (dropdown per squad).
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
                const skill = set.skills[skillType] ?? { troop_type: tt, skill_type: skillType, name: "" };

                return (
                  <div key={skillType} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/50">{prettySkill(skillType)}</div>

                    <div className="mt-2 space-y-2">
                      <input
                        value={skill.name}
                        onChange={(e) => {
                          const name = e.target.value;
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
                          const n = e.target.value ? Number(e.target.value) : undefined;
                          setValue((s) => ({
                            ...s,
                            chip_sets: {
                              ...s.chip_sets,
                              [tt]: {
                                ...s.chip_sets[tt],
                                skills: { ...s.chip_sets[tt].skills, [skillType]: { ...skill, chip_power: Number.isFinite(n as any) ? n : undefined } },
                              },
                            },
                          }));
                        }}
                        placeholder="Chip power (if known)"
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />

                      <textarea
                        value={skill.description ?? ""}
                        onChange={(e) => {
                          const description = e.target.value;
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
                        placeholder="Effect text (optional for now)"
                        rows={4}
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
