"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { HeroGearEditor } from "@/components/hero/HeroGearEditor";
import { HeroSkillsEditor } from "@/components/hero/HeroSkillsEditor";

import { DroneComponentsEditor } from "@/components/drone/DroneComponentsEditor";
import { DroneCombatBoostEditor } from "@/components/drone/DroneCombatBoostEditor";

import { OverlordProfileEditor } from "@/components/overlord/OverlordProfileEditor";
import { OverlordSkillsEditor } from "@/components/overlord/OverlordSkillsEditor";
import { OverlordPromoteEditor } from "@/components/overlord/OverlordPromoteEditor";
import { OverlordBondEditor } from "@/components/overlord/OverlordBondEditor";
import { OverlordTrainEditor } from "@/components/overlord/OverlordTrainEditor";

type SquadSlot = 1 | 2 | 3 | 4;
type HeroSlotIndex = 1 | 2 | 3 | 4 | 5;

type UploadRow = {
  id: number;
  kind: string;
  url: string | null;
  created_at?: string;
  storage_path?: string;
};

type PlayerStateResponse = {
  ok?: boolean;
  state?: any;
  error?: string;
};

type HeroDetailsResponse = {
  ok?: boolean;
  image_url?: string | null;
  facts?: {
    value?: any;
  } | null;
  error?: string;
};

type HeroForm = {
  name: string;
  level: string;
  stars: string;
  power: string;
  attack: string;
  hp: string;
  defense: string;
  march_size: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function emptyHeroForm(): HeroForm {
  return {
    name: "",
    level: "",
    stars: "",
    power: "",
    attack: "",
    hp: "",
    defense: "",
    march_size: "",
  };
}

function normalizeSlotsFromState(state: any): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const squads = state?.squads ?? {};
  for (const squad of [1, 2, 3, 4] as const) {
    const slots = squads?.[String(squad)]?.slots ?? {};
    for (const slot of [1, 2, 3, 4, 5] as const) {
      const raw = slots?.[String(slot)];
      out[`${squad}-${slot}`] = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    }
  }
  return out;
}

function ownerIdFromStoragePath(path?: string | null): string | null {
  if (!path) return null;
  const first = String(path).split("/")[0]?.trim();
  return first || null;
}

function fmtDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
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

function ModalShell({
  title,
  subtitle,
  open,
  onClose,
  children,
  maxWidthClass = "max-w-6xl",
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 md:items-center md:p-6">
      <div
        className={cn(
          "max-h-[94vh] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] shadow-2xl",
          maxWidthClass
        )}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4 md:px-6">
          <div>
            <div className="text-xl font-semibold text-white">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-white/55">{subtitle}</div> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(94vh-76px)] overflow-y-auto p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}

function HomeButton({
  label,
  subtitle,
  onClick,
}: {
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/20 hover:bg-white/10"
    >
      <div className="text-base font-semibold text-white">{label}</div>
      <div className="mt-1 text-sm text-white/55">{subtitle}</div>
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default function Home() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);

  const [heroDetailOpen, setHeroDetailOpen] = useState(false);

  const [heroUploads, setHeroUploads] = useState<UploadRow[]>([]);
  const [droneUploads, setDroneUploads] = useState<UploadRow[]>([]);
  const [overlordUploads, setOverlordUploads] = useState<UploadRow[]>([]);

  const [heroUploadsBusy, setHeroUploadsBusy] = useState(false);
  const [droneUploadsBusy, setDroneUploadsBusy] = useState(false);
  const [overlordUploadsBusy, setOverlordUploadsBusy] = useState(false);

  const [slots, setSlots] = useState<Record<string, number | null>>({});
  const [squadsBusy, setSquadsBusy] = useState(false);
  const [squadsMsg, setSquadsMsg] = useState<string | null>(null);
  const [squadsErr, setSquadsErr] = useState<string | null>(null);

  const [selectedDroneUploadId, setSelectedDroneUploadId] = useState<number | null>(null);
  const [selectedOverlordUploadId, setSelectedOverlordUploadId] = useState<number | null>(null);

  const [selectedHeroSlot, setSelectedHeroSlot] = useState<{ squad: SquadSlot; slot: HeroSlotIndex } | null>(null);
  const [heroDetailUploadId, setHeroDetailUploadId] = useState<number | null>(null);
  const [heroDetailBusy, setHeroDetailBusy] = useState(false);
  const [heroExtractBusy, setHeroExtractBusy] = useState(false);
  const [heroSaveBusy, setHeroSaveBusy] = useState(false);
  const [heroDetailErr, setHeroDetailErr] = useState<string | null>(null);
  const [heroDetailMsg, setHeroDetailMsg] = useState<string | null>(null);
  const [heroDetailImg, setHeroDetailImg] = useState<string | null>(null);
  const [heroDetailFacts, setHeroDetailFacts] = useState<any>(null);
  const [heroForm, setHeroForm] = useState<HeroForm>(emptyHeroForm());
  const [heroTab, setHeroTab] = useState<"profile" | "gear" | "skills">("profile");

  const [droneTab, setDroneTab] = useState<"overview_components" | "combat_chips">("overview_components");
  const [overlordTab, setOverlordTab] = useState<"overview" | "skills" | "promote" | "bond" | "train">("overview");

  const selectedDroneUpload = useMemo(
    () => droneUploads.find((u) => u.id === selectedDroneUploadId) ?? null,
    [droneUploads, selectedDroneUploadId]
  );

  const selectedOverlordUpload = useMemo(
    () => overlordUploads.find((u) => u.id === selectedOverlordUploadId) ?? null,
    [overlordUploads, selectedOverlordUploadId]
  );

  const droneOwnerId = useMemo(
    () => ownerIdFromStoragePath(selectedDroneUpload?.storage_path),
    [selectedDroneUpload?.storage_path]
  );

  const loadUploads = useCallback(async (kind: string): Promise<UploadRow[]> => {
    const res = await fetch(`/api/uploads/list?kind=${encodeURIComponent(kind)}&limit=120`, {
      credentials: "include",
    });
    const payload = await safeReadResponse(res);
    if (!res.ok) return [];
    return Array.isArray(payload.json?.uploads) ? payload.json.uploads : [];
  }, []);

  const loadHeroUploads = useCallback(async () => {
    setHeroUploadsBusy(true);
    try {
      const items = await loadUploads("hero_profile");
      setHeroUploads(items);
    } finally {
      setHeroUploadsBusy(false);
    }
  }, [loadUploads]);

  const loadDroneUploads = useCallback(async () => {
    setDroneUploadsBusy(true);
    try {
      const items = await loadUploads("drone");
      setDroneUploads(items);
      if (!selectedDroneUploadId && items[0]) setSelectedDroneUploadId(items[0].id);
    } finally {
      setDroneUploadsBusy(false);
    }
  }, [loadUploads, selectedDroneUploadId]);

  const loadOverlordUploads = useCallback(async () => {
    setOverlordUploadsBusy(true);
    try {
      const items = await loadUploads("overlord");
      setOverlordUploads(items);
      if (!selectedOverlordUploadId && items[0]) setSelectedOverlordUploadId(items[0].id);
    } finally {
      setOverlordUploadsBusy(false);
    }
  }, [loadUploads, selectedOverlordUploadId]);

  const loadPlayerState = useCallback(async () => {
    setSquadsBusy(true);
    setSquadsErr(null);
    try {
      const res = await fetch("/api/player/state", {
        credentials: "include",
      });
      const payload = await safeReadResponse(res);
      if (!res.ok) {
        setSquadsErr(payload.json?.error ?? `Failed to load squads (${res.status})`);
        return;
      }
      setSlots(normalizeSlotsFromState(payload.json?.state ?? {}));
    } catch (e: any) {
      setSquadsErr(e?.message ?? "Failed to load squads");
    } finally {
      setSquadsBusy(false);
    }
  }, []);

  const savePlayerState = useCallback(
    async (nextSlots: Record<string, number | null>) => {
      setSquadsErr(null);
      setSquadsMsg(null);
      const nextState = {
        squads: {
          "1": { slots: { "1": nextSlots["1-1"], "2": nextSlots["1-2"], "3": nextSlots["1-3"], "4": nextSlots["1-4"], "5": nextSlots["1-5"] } },
          "2": { slots: { "1": nextSlots["2-1"], "2": nextSlots["2-2"], "3": nextSlots["2-3"], "4": nextSlots["2-4"], "5": nextSlots["2-5"] } },
          "3": { slots: { "1": nextSlots["3-1"], "2": nextSlots["3-2"], "3": nextSlots["3-3"], "4": nextSlots["3-4"], "5": nextSlots["3-5"] } },
          "4": { slots: { "1": nextSlots["4-1"], "2": nextSlots["4-2"], "3": nextSlots["4-3"], "4": nextSlots["4-4"], "5": nextSlots["4-5"] } },
        },
      };

      const res = await fetch("/api/player/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(nextState),
      });

      const payload = await safeReadResponse(res);
      if (!res.ok) {
        setSquadsErr(payload.json?.error ?? `Failed to save squads (${res.status})`);
        return false;
      }

      setSquadsMsg("Squads saved ✅");
      return true;
    },
    []
  );

  const assignHeroToSlot = useCallback(
    async (squad: SquadSlot, slot: HeroSlotIndex, uploadId: number | null) => {
      const key = `${squad}-${slot}`;
      const next = { ...slots, [key]: uploadId };
      setSlots(next);
      await savePlayerState(next);
    },
    [savePlayerState, slots]
  );

  const loadHeroDetails = useCallback(async (uploadId: number | null) => {
    if (!uploadId) return;

    setHeroDetailBusy(true);
    setHeroDetailErr(null);
    setHeroDetailMsg(null);

    try {
      const res = await fetch(`/api/hero/details?upload_id=${uploadId}`, {
        credentials: "include",
      });
      const payload = (await safeReadResponse(res)).json as HeroDetailsResponse | null;

      if (!res.ok) {
        setHeroDetailErr(payload?.error ?? `Failed to load hero (${res.status})`);
        return;
      }

      const factsValue = payload?.facts?.value ?? {};
      setHeroDetailImg(payload?.image_url ?? null);
      setHeroDetailFacts(factsValue);
      setHeroForm({
        name: factsValue?.name ? String(factsValue.name) : "",
        level: factsValue?.level != null ? String(factsValue.level) : "",
        stars: factsValue?.stars != null ? String(factsValue.stars) : "",
        power: factsValue?.power != null ? String(factsValue.power) : "",
        attack: factsValue?.stats?.attack != null ? String(factsValue.stats.attack) : "",
        hp: factsValue?.stats?.hp != null ? String(factsValue.stats.hp) : "",
        defense: factsValue?.stats?.defense != null ? String(factsValue.stats.defense) : "",
        march_size: factsValue?.stats?.march_size != null ? String(factsValue.stats.march_size) : "",
      });
    } catch (e: any) {
      setHeroDetailErr(e?.message ?? "Failed to load hero");
    } finally {
      setHeroDetailBusy(false);
    }
  }, []);

  const openHeroDetail = useCallback(
    async (uploadId: number | null, slotRef?: { squad: SquadSlot; slot: HeroSlotIndex } | null) => {
      if (!uploadId) return;
      if (slotRef) setSelectedHeroSlot(slotRef);
      setHeroDetailUploadId(uploadId);
      setHeroTab("profile");
      setHeroDetailOpen(true);
      await loadHeroDetails(uploadId);
    },
    [loadHeroDetails]
  );

  const extractHero = useCallback(async () => {
    if (!heroDetailUploadId) return;

    setHeroExtractBusy(true);
    setHeroDetailErr(null);
    setHeroDetailMsg(null);

    try {
      const res = await fetch("/api/hero/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: heroDetailUploadId }),
      });
      const payload = await safeReadResponse(res);

      if (!res.ok) {
        setHeroDetailErr(payload.json?.error ?? `Extract failed (${res.status})`);
        return;
      }

      const extracted = payload.json?.extracted;
      if (!extracted) {
        setHeroDetailErr("Extract returned no data.");
        return;
      }

      setHeroForm({
        name: extracted?.name ? String(extracted.name) : "",
        level: extracted?.level != null ? String(extracted.level) : "",
        stars: extracted?.stars != null ? String(extracted.stars) : "",
        power: extracted?.power != null ? String(extracted.power) : "",
        attack: extracted?.stats?.attack != null ? String(extracted.stats.attack) : "",
        hp: extracted?.stats?.hp != null ? String(extracted.stats.hp) : "",
        defense: extracted?.stats?.defense != null ? String(extracted.stats.defense) : "",
        march_size: extracted?.stats?.march_size != null ? String(extracted.stats.march_size) : "",
      });

      setHeroDetailMsg("Extracted ✅ (review, then Save)");
    } catch (e: any) {
      setHeroDetailErr(e?.message ?? "Extract failed");
    } finally {
      setHeroExtractBusy(false);
    }
  }, [heroDetailUploadId]);

  const saveHero = useCallback(async () => {
    if (!heroDetailUploadId) return;

    setHeroSaveBusy(true);
    setHeroDetailErr(null);
    setHeroDetailMsg(null);

    try {
      const res = await fetch("/api/hero/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          upload_id: heroDetailUploadId,
          name: heroForm.name,
          level: heroForm.level,
          stars: heroForm.stars,
          power: heroForm.power,
          attack: heroForm.attack,
          hp: heroForm.hp,
          defense: heroForm.defense,
          march_size: heroForm.march_size,
        }),
      });

      const payload = await safeReadResponse(res);
      if (!res.ok) {
        setHeroDetailErr(payload.json?.error ?? `Save failed (${res.status})`);
        return;
      }

      await loadHeroDetails(heroDetailUploadId);
      setHeroDetailMsg("Saved ✅");
    } catch (e: any) {
      setHeroDetailErr(e?.message ?? "Save failed");
    } finally {
      setHeroSaveBusy(false);
    }
  }, [heroDetailUploadId, heroForm, loadHeroDetails]);

  useEffect(() => {
    void loadHeroUploads();
    void loadDroneUploads();
    void loadOverlordUploads();
    void loadPlayerState();
  }, [loadHeroUploads, loadDroneUploads, loadOverlordUploads, loadPlayerState]);

  const squadCards = useMemo(() => {
    const result: Array<{ squad: SquadSlot; slots: Array<{ slot: HeroSlotIndex; upload: UploadRow | null }> }> = [];
    for (const squad of [1, 2, 3, 4] as const) {
      const row = {
        squad,
        slots: [1, 2, 3, 4, 5].map((slot) => {
          const uploadId = slots[`${squad}-${slot}`];
          const upload = heroUploads.find((u) => u.id === uploadId) ?? null;
          return { slot: slot as HeroSlotIndex, upload };
        }),
      };
      result.push(row);
    }
    return result;
  }, [heroUploads, slots]);

  return (
    <main className="min-h-screen bg-[#070c15] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-b from-[#101828] to-[#0a1020] p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-white md:text-4xl">SquadAssistant</div>
              <div className="mt-2 max-w-3xl text-sm text-white/55 md:text-base">
                Clean launcher page with working entry points for uploads, squads, hero profile submodal, drone, and overlord.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <HomeButton label="Upload" subtitle="View saved screenshots" onClick={() => setUploadOpen(true)} />
              <HomeButton label="Squads" subtitle="Assign heroes and open hero profiles" onClick={() => setSquadsOpen(true)} />
              <HomeButton label="Drone" subtitle="Overview, components, combat, chips" onClick={() => setDroneOpen(true)} />
              <HomeButton label="Overlord" subtitle="Profile, skills, promote, bond, train" onClick={() => setOverlordOpen(true)} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-lg font-semibold text-white">Quick Snapshot</div>
              <div className="mt-1 text-sm text-white/55">Current counts loaded from your saved uploads.</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatCard label="Heroes" value={heroUploads.length} />
                <StatCard label="Drone" value={droneUploads.length} />
                <StatCard label="Overlord" value={overlordUploads.length} />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-lg font-semibold text-white">Current Squad Summary</div>
              <div className="mt-1 text-sm text-white/55">Hero uploads currently assigned into squad slots.</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {squadCards.slice(0, 2).map((group) => (
                  <div key={group.squad} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Squad {group.squad}</div>
                    <div className="mt-3 text-sm text-white/70">
                      {group.slots.filter((s) => s.upload).length} / 5 hero slots assigned
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalShell
        title="Uploads"
        subtitle="Saved screenshots grouped by section."
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        maxWidthClass="max-w-7xl"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold text-white">Hero Uploads</div>
            <div className="mt-1 text-sm text-white/55">{heroUploadsBusy ? "Loading…" : `${heroUploads.length} items`}</div>
            <div className="mt-4 grid gap-3">
              {heroUploads.map((u) => (
                <div key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-medium text-white">Hero #{u.id}</div>
                  <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold text-white">Drone Uploads</div>
            <div className="mt-1 text-sm text-white/55">{droneUploadsBusy ? "Loading…" : `${droneUploads.length} items`}</div>
            <div className="mt-4 grid gap-3">
              {droneUploads.map((u) => (
                <div key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-medium text-white">Drone #{u.id}</div>
                  <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold text-white">Overlord Uploads</div>
            <div className="mt-1 text-sm text-white/55">{overlordUploadsBusy ? "Loading…" : `${overlordUploads.length} items`}</div>
            <div className="mt-4 grid gap-3">
              {overlordUploads.map((u) => (
                <div key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-medium text-white">Overlord #{u.id}</div>
                  <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Squads"
        subtitle="Assign hero uploads into squad slots. Open the hero profile submodal from here."
        open={squadsOpen}
        onClose={() => setSquadsOpen(false)}
        maxWidthClass="max-w-7xl"
      >
        {squadsErr ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{squadsErr}</div>
        ) : null}
        {squadsMsg ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{squadsMsg}</div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
          {squadCards.map((group) => (
            <div key={group.squad} className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-lg font-semibold text-white">Squad {group.squad}</div>
              <div className="mt-1 text-sm text-white/55">{squadsBusy ? "Loading…" : "Each slot can point to one hero upload."}</div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {group.slots.map(({ slot, upload }) => (
                  <div key={`${group.squad}-${slot}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Slot {slot}</div>

                    <div className="mt-3 h-28 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                      {upload?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={upload.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-white/35">No hero</div>
                      )}
                    </div>

                    <select
                      value={upload?.id ?? ""}
                      onChange={(e) => {
                        const next = e.target.value ? Number(e.target.value) : null;
                        void assignHeroToSlot(group.squad, slot, next);
                      }}
                      className="mt-3 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    >
                      <option value="">— none —</option>
                      {heroUploads.map((hero) => (
                        <option key={hero.id} value={hero.id}>
                          Hero #{hero.id}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => void openHeroDetail(upload?.id ?? null, { squad: group.squad, slot })}
                      disabled={!upload?.id}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
                    >
                      Open Hero
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ModalShell>

      <ModalShell
        title="Hero Profile"
        subtitle={
          selectedHeroSlot
            ? `Squad ${selectedHeroSlot.squad} • Slot ${selectedHeroSlot.slot} • Upload #${heroDetailUploadId ?? "—"}`
            : `Upload #${heroDetailUploadId ?? "—"}`
        }
        open={heroDetailOpen}
        onClose={() => setHeroDetailOpen(false)}
        maxWidthClass="max-w-7xl"
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setHeroTab("profile")}
            className={cn(
              "rounded-2xl border px-4 py-2 text-sm",
              heroTab === "profile"
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                : "border-white/10 bg-white/5 text-white/70"
            )}
          >
            Profile
          </button>
          <button
            onClick={() => setHeroTab("gear")}
            className={cn(
              "rounded-2xl border px-4 py-2 text-sm",
              heroTab === "gear"
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                : "border-white/10 bg-white/5 text-white/70"
            )}
          >
            Gear
          </button>
          <button
            onClick={() => setHeroTab("skills")}
            className={cn(
              "rounded-2xl border px-4 py-2 text-sm",
              heroTab === "skills"
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                : "border-white/10 bg-white/5 text-white/70"
            )}
          >
            Skills
          </button>
        </div>

        {heroTab === "profile" ? (
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-lg font-semibold text-white">Hero Card</div>
              <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                {heroDetailImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroDetailImg} alt="" className="h-[420px] w-full object-cover" />
                ) : (
                  <div className="flex h-[420px] items-center justify-center text-sm text-white/35">
                    {heroDetailBusy ? "Loading hero image…" : "No hero image available"}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void extractHero()}
                  disabled={heroExtractBusy || !heroDetailUploadId}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
                >
                  {heroExtractBusy ? "Extracting…" : "Extract"}
                </button>
                <button
                  onClick={() => void loadHeroDetails(heroDetailUploadId)}
                  disabled={heroDetailBusy || !heroDetailUploadId}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
                >
                  {heroDetailBusy ? "Loading…" : "Reload"}
                </button>
                <button
                  onClick={() => void saveHero()}
                  disabled={heroSaveBusy || !heroDetailUploadId}
                  className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 disabled:opacity-40"
                >
                  {heroSaveBusy ? "Saving…" : "Save"}
                </button>
              </div>

              {heroDetailErr ? (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{heroDetailErr}</div>
              ) : null}
              {heroDetailMsg ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{heroDetailMsg}</div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">Name</div>
                  <input value={heroForm.name} onChange={(e) => setHeroForm((s) => ({ ...s, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">Level</div>
                  <input value={heroForm.level} onChange={(e) => setHeroForm((s) => ({ ...s, level: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">Stars</div>
                  <input value={heroForm.stars} onChange={(e) => setHeroForm((s) => ({ ...s, stars: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">Power</div>
                  <input value={heroForm.power} onChange={(e) => setHeroForm((s) => ({ ...s, power: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white" />
                </label>

                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">Attack</div>
                  <input value={heroForm.attack} onChange={(e) => setHeroForm((s) => ({ ...s, attack: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">HP</div>
                  <input value={heroForm.hp} onChange={(e) => setHeroForm((s) => ({ ...s, hp: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">Defense</div>
                  <input value={heroForm.defense} onChange={(e) => setHeroForm((s) => ({ ...s, defense: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">March Size</div>
                  <input value={heroForm.march_size} onChange={(e) => setHeroForm((s) => ({ ...s, march_size: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white" />
                </label>
              </div>

              {heroDetailFacts?.stats ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  Detected stats snapshot — Attack: {heroDetailFacts.stats.attack ?? "—"} • HP: {heroDetailFacts.stats.hp ?? "—"} • Defense: {heroDetailFacts.stats.defense ?? "—"} • March Size: {heroDetailFacts.stats.march_size ?? "—"}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {heroTab === "gear" ? <HeroGearEditor selectedUploadId={heroDetailUploadId} /> : null}
        {heroTab === "skills" ? <HeroSkillsEditor selectedUploadId={heroDetailUploadId} /> : null}
      </ModalShell>

      <ModalShell
        title="Drone"
        subtitle="Two-tab layout: Overview + Components, then Combat Boost + Skill Chips."
        open={droneOpen}
        onClose={() => setDroneOpen(false)}
        maxWidthClass="max-w-7xl"
      >
        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold text-white">Drone Uploads</div>
            <div className="mt-1 text-sm text-white/55">{droneUploadsBusy ? "Loading…" : `${droneUploads.length} items`}</div>

            <div className="mt-4 grid gap-3">
              {droneUploads.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedDroneUploadId(u.id)}
                  className={cn(
                    "rounded-2xl border p-3 text-left",
                    selectedDroneUploadId === u.id ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-black/20"
                  )}
                >
                  <div className="text-sm font-medium text-white">Drone #{u.id}</div>
                  <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setDroneTab("overview_components")}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm",
                  droneTab === "overview_components"
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Overview + Components
              </button>
              <button
                onClick={() => setDroneTab("combat_chips")}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm",
                  droneTab === "combat_chips"
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Combat Boost + Skill Chips
              </button>
            </div>

            {droneTab === "overview_components" ? (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                  {selectedDroneUpload?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedDroneUpload.url} alt="" className="h-[340px] w-full object-cover" />
                  ) : (
                    <div className="flex h-[340px] items-center justify-center text-sm text-white/35">No drone image selected</div>
                  )}
                </div>

                {droneOwnerId ? (
                  <DroneComponentsEditor ownerId={droneOwnerId} selectedUploadId={selectedDroneUploadId} />
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                    Select a drone upload with a valid storage path first.
                  </div>
                )}
              </div>
            ) : null}

            {droneTab === "combat_chips" ? (
              <div className="space-y-5">
                {droneOwnerId ? (
                  <DroneCombatBoostEditor ownerId={droneOwnerId} selectedUploadId={selectedDroneUploadId} />
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                    Select a drone upload with a valid storage path first.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Overlord"
        subtitle="Profile-style modal for overview, skills, promote, bond, and train."
        open={overlordOpen}
        onClose={() => setOverlordOpen(false)}
        maxWidthClass="max-w-7xl"
      >
        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold text-white">Overlord Uploads</div>
            <div className="mt-1 text-sm text-white/55">{overlordUploadsBusy ? "Loading…" : `${overlordUploads.length} items`}</div>

            <div className="mt-4 grid gap-3">
              {overlordUploads.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedOverlordUploadId(u.id)}
                  className={cn(
                    "rounded-2xl border p-3 text-left",
                    selectedOverlordUploadId === u.id ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-black/20"
                  )}
                >
                  <div className="text-sm font-medium text-white">Overlord #{u.id}</div>
                  <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setOverlordTab("overview")}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm",
                  overlordTab === "overview"
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Overview
              </button>
              <button
                onClick={() => setOverlordTab("skills")}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm",
                  overlordTab === "skills"
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Skills
              </button>
              <button
                onClick={() => setOverlordTab("promote")}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm",
                  overlordTab === "promote"
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Promote
              </button>
              <button
                onClick={() => setOverlordTab("bond")}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm",
                  overlordTab === "bond"
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Bond
              </button>
              <button
                onClick={() => setOverlordTab("train")}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm",
                  overlordTab === "train"
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                Train
              </button>
            </div>

            {overlordTab === "overview" ? (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                  {selectedOverlordUpload?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedOverlordUpload.url} alt="" className="h-[340px] w-full object-cover" />
                  ) : (
                    <div className="flex h-[340px] items-center justify-center text-sm text-white/35">No overlord image selected</div>
                  )}
                </div>
                <OverlordProfileEditor selectedUploadId={selectedOverlordUploadId} />
              </div>
            ) : null}

            {overlordTab === "skills" ? <OverlordSkillsEditor selectedUploadId={selectedOverlordUploadId} /> : null}
            {overlordTab === "promote" ? <OverlordPromoteEditor selectedUploadId={selectedOverlordUploadId} /> : null}
            {overlordTab === "bond" ? <OverlordBondEditor selectedUploadId={selectedOverlordUploadId} /> : null}
            {overlordTab === "train" ? <OverlordTrainEditor selectedUploadId={selectedOverlordUploadId} /> : null}
          </div>
        </div>
      </ModalShell>
    </main>
  );
            }
