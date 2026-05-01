"use client";

import React, { useEffect, useState } from "react";

type GearSlotKey = "weapon" | "data_chip" | "armor" | "radar";

type GearBoost = {
  stat: string | null;
  value_raw: string | null;
  value_numeric: number | null;
};

type GearPiece = {
  slot: GearSlotKey;
  item_name: string | null;
  stars: number | null;
  level: number | null;
  rarity: string | null;
  boosts: GearBoost[];
  notes: string | null;
};

type HeroGearValue = {
  kind: "hero_gear";
  pieces: Record<GearSlotKey, GearPiece>;
  source_upload_id?: number;
  saved_at?: string;
};

const gearSlots: Array<{ key: GearSlotKey; label: string }> = [
  { key: "weapon", label: "Weapon" },
  { key: "data_chip", label: "Data Chip" },
  { key: "armor", label: "Armor" },
  { key: "radar", label: "Radar" },
];

function blankPiece(slot: GearSlotKey): GearPiece {
  return {
    slot,
    item_name: null,
    stars: null,
    level: null,
    rarity: null,
    boosts: [],
    notes: null,
  };
}

function blankValue(): HeroGearValue {
  return {
    kind: "hero_gear",
    pieces: {
      weapon: blankPiece("weapon"),
      data_chip: blankPiece("data_chip"),
      armor: blankPiece("armor"),
      radar: blankPiece("radar"),
    },
  };
}

function hasBoostData(boost: GearBoost | undefined): boolean {
  return Boolean(
    boost?.stat ||
      boost?.value_raw ||
      boost?.value_numeric != null
  );
}

function hasPieceData(piece: GearPiece | undefined): boolean {
  return Boolean(
    piece?.item_name ||
      piece?.stars != null ||
      piece?.level != null ||
      piece?.rarity ||
      piece?.notes ||
      piece?.boosts?.some(hasBoostData)
  );
}

function mergeBoosts(
  currentBoosts: GearBoost[],
  extractedBoosts: GearBoost[]
): GearBoost[] {
  const next = [...currentBoosts];

  for (let i = 0; i < extractedBoosts.length; i++) {
    const extractedBoost = extractedBoosts[i];
    if (!hasBoostData(extractedBoost)) continue;

    const oldBoost = next[i] ?? {
      stat: null,
      value_raw: null,
      value_numeric: null,
    };

    next[i] = {
      ...oldBoost,
      stat: extractedBoost.stat ?? oldBoost.stat,
      value_raw: extractedBoost.value_raw ?? oldBoost.value_raw,
      value_numeric: extractedBoost.value_numeric ?? oldBoost.value_numeric,
    };
  }

  return next;
}

function mergeExtractedHeroGear(
  current: HeroGearValue,
  extracted: HeroGearValue
): HeroGearValue {
  const next: HeroGearValue = {
    ...current,
    source_upload_id: extracted.source_upload_id ?? current.source_upload_id,
    pieces: { ...current.pieces },
  };

  for (const { key } of gearSlots) {
    const extractedPiece = extracted.pieces?.[key];
    if (!hasPieceData(extractedPiece)) continue;

    const oldPiece = current.pieces[key] ?? blankPiece(key);

    next.pieces[key] = {
      ...oldPiece,
      slot: key,
      item_name: extractedPiece.item_name ?? oldPiece.item_name,
      stars: extractedPiece.stars ?? oldPiece.stars,
      level: extractedPiece.level ?? oldPiece.level,
      rarity: extractedPiece.rarity ?? oldPiece.rarity,
      notes: extractedPiece.notes ?? oldPiece.notes,
      boosts: mergeBoosts(oldPiece.boosts ?? [], extractedPiece.boosts ?? []),
    };
  }

  return next;
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

export function HeroGearEditor({ selectedUploadId }: { selectedUploadId: number | null }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [value, setValue] = useState<HeroGearValue>(blankValue());

  async function load() {
    if (!selectedUploadId) {
      setValue(blankValue());
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/hero/gear/details?upload_id=${selectedUploadId}`, {
        credentials: "include",
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const serverMsg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setErr(`Load failed: ${String(serverMsg)}`);
        return;
      }

      const factsValue = payload.json?.facts?.value;
      if (factsValue?.kind === "hero_gear") {
        setValue(factsValue as HeroGearValue);
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
      const res = await fetch("/api/hero/gear/extract", {
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
      if (!extracted || extracted.kind !== "hero_gear") {
        setErr("Extract returned unexpected format.");
        return;
      }

      setValue((current) =>
  mergeExtractedHeroGear(current, extracted as HeroGearValue)
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
      const res = await fetch("/api/hero/gear/save", {
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

  function updatePiece(slot: GearSlotKey, patch: Partial<GearPiece>) {
    setValue((s) => ({
      ...s,
      pieces: {
        ...s.pieces,
        [slot]: {
          ...s.pieces[slot],
          ...patch,
        },
      },
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
        <div className="text-sm text-white/70">Extract and review Weapon, Data Chip, Armor, and Radar.</div>
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

      <div className="grid gap-4">
        {gearSlots.map(({ key, label }) => {
          const piece = value.pieces[key] ?? blankPiece(key);

          return (
            <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-lg font-semibold text-white">{label}</div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <label className="block">
                  <div className="text-xs text-white/60">Item</div>
                  <input
                    value={piece.item_name ?? ""}
                    onChange={(e) => updatePiece(key, { item_name: e.target.value || null })}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-white/60">Stars</div>
                  <input
                    value={piece.stars ?? ""}
                    onChange={(e) => updatePiece(key, { stars: e.target.value ? Number(e.target.value) : null })}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-white/60">Level</div>
                  <input
                    value={piece.level ?? ""}
                    onChange={(e) => updatePiece(key, { level: e.target.value ? Number(e.target.value) : null })}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-white/60">Rarity</div>
                  <input
                    value={piece.rarity ?? ""}
                    onChange={(e) => updatePiece(key, { rarity: e.target.value || null })}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Boosts</div>
                <div className="mt-2 space-y-2">
                  {piece.boosts.map((boost, idx) => (
                    <div key={`${key}-boost-${idx}`} className="grid gap-2 md:grid-cols-2">
                      <input
                        value={boost.stat ?? ""}
                        onChange={(e) => {
                          const next = [...piece.boosts];
                          next[idx] = { ...next[idx], stat: e.target.value || null };
                          updatePiece(key, { boosts: next });
                        }}
                        placeholder="Stat"
                        className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                      <input
                        value={boost.value_raw ?? ""}
                        onChange={(e) => {
                          const next = [...piece.boosts];
                          next[idx] = { ...next[idx], value_raw: e.target.value || null };
                          updatePiece(key, { boosts: next });
                        }}
                        placeholder="Value"
                        className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => updatePiece(key, { boosts: [...piece.boosts, { stat: null, value_raw: null, value_numeric: null }] })}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
                  >
                    Add Boost
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-white/60">Notes</div>
                <textarea
                  value={piece.notes ?? ""}
                  onChange={(e) => updatePiece(key, { notes: e.target.value || null })}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
