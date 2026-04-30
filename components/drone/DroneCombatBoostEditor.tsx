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

function defaultSkill(troop_type: TroopType, skill_type: ChipSkillType, name: string): ChipSkill {
  return { troop_type, skill_type, name, description: "" };
}

function defaultSet(troop_type: TroopType): ChipSet {
  return {
    troop_type,
    label: `${troop_type} Chip Set`,
    assigned_squad_slot: null,
    skills: {
      initial_move: defaultSkill(troop_type, "initial_move", ""),
      offensive: defaultSkill(troop_type, "offensive", ""),
      defense: defaultSkill(troop_type, "defense", ""),
      interference: defaultSkill(troop_type, "interference", ""),
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

    if (!selectedUploadId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/drone/combat_boost/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);

      if (json?.row?.value?.kind === "drone_combat_boost") {
        setValue(json.row.value);
      }
    } catch (e: any) {
      setErr(e?.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!selectedUploadId) {
      setErr("Select a screenshot first.");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const res = await fetch(`/api/drone/combat_boost/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          upload_id: selectedUploadId,
          value: { ...value, saved_at: nowIso() },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);

      setMsg("Saved ✅");
    } catch (e: any) {
      setErr(e?.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [selectedUploadId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {err && <div style={{ color: "red" }}>{err}</div>}
      {msg && <div>{msg}</div>}

      <button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
