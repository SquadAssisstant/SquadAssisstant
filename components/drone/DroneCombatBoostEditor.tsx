// components/drone/DroneCombatBoostEditor.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { DroneCombatBoostState, SquadSlot, TroopType } from "@/lib/drone/types";
import { defaultChipSetSkills } from "@/lib/drone/skillChipCatalog";

const troopTypes: TroopType[] = ["tank", "air", "missile"];
const squadSlots: SquadSlot[] = [1, 2, 3, 4];

function prettyTroop(t: TroopType) {
  return t === "tank" ? "Tank" : t === "air" ? "Air" : "Missile";
}

export function DroneCombatBoostEditor({
  playerId,
}: {
  playerId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<DroneCombatBoostState>(() => {
    const init: DroneCombatBoostState = {
      kind: "drone_combat_boost",
      saved_at: new Date().toISOString(),
      chip_sets: {
        tank: {
          troop_type: "tank",
          label: "Tank Chip Set",
          assigned_squad_slot: null,
          skills: defaultChipSetSkills("tank"),
        },
        air: {
          troop_type: "air",
          label: "Air Chip Set",
          assigned_squad_slot: null,
          skills: defaultChipSetSkills("air"),
        },
        missile: {
          troop_type: "missile",
          label: "Missile Chip Set",
          assigned_squad_slot: null,
          skills: defaultChipSetSkills("missile"),
        },
      },
    };
    return init;
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drone/combat_boost/get?player_id=${encodeURIComponent(playerId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Load failed");

      if (json?.row?.value?.kind === "drone_combat_boost") {
        setState(json.row.value as DroneCombatBoostState);
      }
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/drone/combat_boost/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          player_id: playerId,
          state: {
            kind: "drone_combat_boost",
            chip_sets: state.chip_sets,
          },
          source_urls: [],
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      if (json?.row?.value?.kind === "drone_combat_boost") {
        setState(json.row.value as DroneCombatBoostState);
      }
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const assignedMap = useMemo(() => {
    // which troop types are assigned to which squad
    const used: Partial<Record<SquadSlot, TroopType[]>> = {};
    for (const tt of troopTypes) {
      const slot = state.chip_sets[tt]?.assigned_squad_slot;
      if (slot) {
        used[slot] = used[slot] ?? [];
        used[slot]!.push(tt);
      }
    }
    return used;
  }, [state]);

  if (loading) return <div className="text-sm text-white/60">Loading Combat Boost…</div>;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-white/50">
            Drone Combat Boost
          </div>
          <div className="mt-1 text-sm text-white/70">
            Assign each chip set to the squad slot you use in-game.
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        const chipSet = state.chip_sets[tt];
        const slot = chipSet.assigned_squad_slot;

        return (
          <div key={tt} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">
                  {prettyTroop(tt)} Chip Set
                </div>
                <div className="text-sm text-white/60">
                  {slot
                    ? `Assigned to Squad Slot ${slot}${
                        assignedMap[slot] && assignedMap[slot]!.length > 1
                          ? " (⚠️ multiple sets assigned)"
                          : ""
                      }`
                    : "Not assigned"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-white/60">Squad slot</div>
                <select
                  value={slot ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? (Number(e.target.value) as SquadSlot) : null;
                    setState((s) => ({
                      ...s,
                      chip_sets: {
                        ...s.chip_sets,
                        [tt]: { ...s.chip_sets[tt], assigned_squad_slot: v },
                      },
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
              {(["initial_move", "defense", "interference", "offensive"] as const).map((skillType) => {
                const skill = chipSet.skills[skillType];

                return (
                  <div key={skillType} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/50">
                      {skillType.replace("_", " ")}
                    </div>

                    <div className="mt-2 space-y-2">
                      <input
                        value={skill?.name ?? ""}
                        onChange={(e) => {
                          const name = e.target.value;
                          setState((s) => ({
                            ...s,
                            chip_sets: {
                              ...s.chip_sets,
                              [tt]: {
                                ...s.chip_sets[tt],
                                skills: {
                                  ...s.chip_sets[tt].skills,
                                  [skillType]: { ...(s.chip_sets[tt].skills[skillType] ?? { troop_type: tt, skill_type: skillType }), name },
                                },
                              },
                            },
                          }));
                        }}
                        placeholder="Chip skill name"
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />

                      <input
                        value={skill?.chip_power ?? ""}
                        onChange={(e) => {
                          const n = e.target.value ? Number(e.target.value) : undefined;
                          setState((s) => ({
                            ...s,
                            chip_sets: {
                              ...s.chip_sets,
                              [tt]: {
                                ...s.chip_sets[tt],
                                skills: {
                                  ...s.chip_sets[tt].skills,
                                  [skillType]: {
                                    ...(s.chip_sets[tt].skills[skillType] ?? { troop_type: tt, skill_type: skillType, name: "" }),
                                    chip_power: Number.isFinite(n as any) ? n : undefined,
                                  },
                                },
                              },
                            },
                          }));
                        }}
                        placeholder="Chip power (e.g., 155100)"
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />

                      <textarea
                        value={skill?.description ?? ""}
                        onChange={(e) => {
                          const description = e.target.value;
                          setState((s) => ({
                            ...s,
                            chip_sets: {
                              ...s.chip_sets,
                              [tt]: {
                                ...s.chip_sets[tt],
                                skills: {
                                  ...s.chip_sets[tt].skills,
                                  [skillType]: {
                                    ...(s.chip_sets[tt].skills[skillType] ?? { troop_type: tt, skill_type: skillType, name: "" }),
                                    description,
                                  },
                                },
                              },
                            },
                          }));
                        }}
                        placeholder="Paste the chip effect text here (or later: Extract from Image)"
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
