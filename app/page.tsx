"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { HeroGearEditor } from "@/components/hero/HeroGearEditor";
import { HeroSkillsEditor } from "@/components/hero/HeroSkillsEditor";

import { DroneComponentsEditor } from "@/components/drone/DroneComponentsEditor";
import { DroneCombatBoostEditor } from "@/components/drone/DroneCombatBoostEditor";
import { DroneBoostChipsEditor } from "@/components/drone/DroneBoostChipsEditor";

import { OverlordProfileEditor } from "@/components/overlord/OverlordProfileEditor";
import { OverlordSkillsEditor } from "@/components/overlord/OverlordSkillsEditor";
import { OverlordPromoteEditor } from "@/components/overlord/OverlordPromoteEditor";
import { OverlordBondEditor } from "@/components/overlord/OverlordBondEditor";
import { OverlordTrainEditor } from "@/components/overlord/OverlordTrainEditor";

type UploadItem = {
  id: number;
  kind: string;
  created_at?: string;
  storage_path?: string;
  url?: string | null;
};

type HeroProfileValue = {
  name: string;
  level: string;
  stars: string;
  power: string;
  attack: string;
  hp: string;
  defense: string;
  march_size: string;
};

type HeroProfileDetailsResponse = {
  ok?: boolean;
  image_url?: string | null;
  facts?: {
    value?: any;
  } | null;
  error?: string;
};

type SquadSlot = {
  slot: number;
  hero_upload_id: number | null;
};

type PlayerState = {
  squads?: {
    slots?: SquadSlot[];
  };
};

type PlayerStateResponse = {
  ok?: boolean;
  state?: PlayerState;
  error?: string;
};

type UploadKind = "hero_profile" | "hero_skills" | "gear" | "drone" | "overlord" | "battle_report";

const HERO_KINDS = ["hero_profile", "hero"];
const DRONE_KINDS = ["drone", "drone_profile", "drone_components", "drone_combat_boost", "drone_skill_chips"];
const OVERLORD_KINDS = ["overlord", "lord", "over_lord"];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function firstPathSegment(path?: string | null) {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  return raw.split("/")[0] ?? "";
}

function fmtDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function emptyHeroProfile(): HeroProfileValue {
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

async function safeJson<T = any>(res: Response): Promise<T | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function AppCard({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/20 hover:bg-white/10"
    >
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-base font-semibold text-white">{title}</div>
        <div className="mt-1 text-sm text-white/55">{subtitle}</div>
      </div>
    </button>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  open,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  open: boolean;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 md:items-center md:p-6">
      <div
        className={cx(
          "max-h-[92vh] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] shadow-2xl",
          wide ? "max-w-7xl" : "max-w-5xl"
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
        <div className="max-h-[calc(92vh-78px)] overflow-y-auto p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
      <div className="mb-4">
        <div className="text-lg font-semibold text-white">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-white/55">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-2xl border px-4 py-2 text-sm transition",
        active
          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}

export default function Page() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);

  const [heroSubModalOpen, setHeroSubModalOpen] = useState(false);

  const [heroUploads, setHeroUploads] = useState<UploadItem[]>([]);
  const [droneUploads, setDroneUploads] = useState<UploadItem[]>([]);
  const [overlordUploads, setOverlordUploads] = useState<UploadItem[]>([]);

  const [loadingHeroUploads, setLoadingHeroUploads] = useState(false);
  const [loadingDroneUploads, setLoadingDroneUploads] = useState(false);
  const [loadingOverlordUploads, setLoadingOverlordUploads] = useState(false);

  const [playerState, setPlayerState] = useState<PlayerState>({ squads: { slots: [] } });
  const [loadingPlayerState, setLoadingPlayerState] = useState(false);
  const [savingPlayerState, setSavingPlayerState] = useState(false);
  const [playerStateMsg, setPlayerStateMsg] = useState<string | null>(null);
  const [playerStateErr, setPlayerStateErr] = useState<string | null>(null);

  const [selectedHeroUploadId, setSelectedHeroUploadId] = useState<number | null>(null);
  const [selectedDroneUploadId, setSelectedDroneUploadId] = useState<number | null>(null);
  const [selectedOverlordUploadId, setSelectedOverlordUploadId] = useState<number | null>(null);

  const [heroSubModalTab, setHeroSubModalTab] = useState<"profile" | "gear" | "skills">("profile");
  const [heroProfileLoading, setHeroProfileLoading] = useState(false);
  const [heroProfileSaving, setHeroProfileSaving] = useState(false);
  const [heroProfileExtracting, setHeroProfileExtracting] = useState(false);
  const [heroProfileErr, setHeroProfileErr] = useState<string | null>(null);
  const [heroProfileMsg, setHeroProfileMsg] = useState<string | null>(null);
  const [heroProfileImageUrl, setHeroProfileImageUrl] = useState<string | null>(null);
  const [heroProfile, setHeroProfile] = useState<HeroProfileValue>(emptyHeroProfile());

  const [droneTab, setDroneTab] = useState<"overview_components" | "combat_chips">("overview_components");
  const [overlordTab, setOverlordTab] = useState<"overview" | "skills" | "promote" | "bond" | "train">("overview");

  const [uploadKind, setUploadKind] = useState<UploadKind>("hero_profile");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const selectedHeroUpload = useMemo(
    () => heroUploads.find((u) => u.id === selectedHeroUploadId) ?? null,
    [heroUploads, selectedHeroUploadId]
  );

  const selectedDroneUpload = useMemo(
    () => droneUploads.find((u) => u.id === selectedDroneUploadId) ?? null,
    [droneUploads, selectedDroneUploadId]
  );

  const selectedOverlordUpload = useMemo(
    () => overlordUploads.find((u) => u.id === selectedOverlordUploadId) ?? null,
    [overlordUploads, selectedOverlordUploadId]
  );

  const droneOwnerId = useMemo(() => firstPathSegment(selectedDroneUpload?.storage_path), [selectedDroneUpload]);

  const squadSlots = useMemo(() => {
    const raw = playerState?.squads?.slots;
    if (Array.isArray(raw) && raw.length) {
      return raw
        .map((s: any, idx: number) => ({
          slot: Number(s?.slot ?? idx + 1),
          hero_upload_id: Number.isFinite(Number(s?.hero_upload_id)) ? Number(s.hero_upload_id) : null,
        }))
        .slice(0, 4);
    }
    return [1, 2, 3, 4].map((slot) => ({ slot, hero_upload_id: null }));
  }, [playerState]);

  const loadUploadsByKinds = useCallback(async (kinds: string[]) => {
    const merged = new Map<number, UploadItem>();

    for (const kind of kinds) {
      const res = await fetch(`/api/uploads/list?kind=${encodeURIComponent(kind)}&limit=120`, {
        credentials: "include",
      });

      const json = await safeJson<{
        ok?: boolean;
        uploads?: UploadItem[];
        error?: string;
      }>(res);

      if (!res.ok) continue;

      const uploads: UploadItem[] = json && Array.isArray(json.uploads) ? json.uploads : [];
      for (const item of uploads) {
        merged.set(item.id, item);
      }
    }

    return Array.from(merged.values()).sort((a, b) => {
      const aa = new Date(a.created_at ?? 0).getTime();
      const bb = new Date(b.created_at ?? 0).getTime();
      return bb - aa;
    });
  }, []);

  const loadHeroUploads = useCallback(async () => {
    setLoadingHeroUploads(true);
    try {
      const items = await loadUploadsByKinds(HERO_KINDS);
      setHeroUploads(items);
      if (!selectedHeroUploadId && items[0]) setSelectedHeroUploadId(items[0].id);
    } finally {
      setLoadingHeroUploads(false);
    }
  }, [loadUploadsByKinds, selectedHeroUploadId]);

  const loadDroneUploads = useCallback(async () => {
    setLoadingDroneUploads(true);
    try {
      const items = await loadUploadsByKinds(DRONE_KINDS);
      setDroneUploads(items);
      if (!selectedDroneUploadId && items[0]) setSelectedDroneUploadId(items[0].id);
    } finally {
      setLoadingDroneUploads(false);
    }
  }, [loadUploadsByKinds, selectedDroneUploadId]);

  const loadOverlordUploads = useCallback(async () => {
    setLoadingOverlordUploads(true);
    try {
      const items = await loadUploadsByKinds(OVERLORD_KINDS);
      setOverlordUploads(items);
      if (!selectedOverlordUploadId && items[0]) setSelectedOverlordUploadId(items[0].id);
    } finally {
      setLoadingOverlordUploads(false);
    }
  }, [loadUploadsByKinds, selectedOverlordUploadId]);

  const loadPlayerState = useCallback(async () => {
    setLoadingPlayerState(true);
    setPlayerStateErr(null);
    try {
      const res = await fetch("/api/player/state", { credentials: "include" });
      const json = await safeJson<PlayerStateResponse>(res);
      if (!res.ok) {
        setPlayerStateErr(json?.error ?? `Failed to load squads (${res.status})`);
        return;
      }
      setPlayerState(json?.state ?? { squads: { slots: [] } });
    } catch (e: any) {
      setPlayerStateErr(e?.message ?? "Failed to load squads");
    } finally {
      setLoadingPlayerState(false);
    }
  }, []);

  const savePlayerState = useCallback(async (nextState: PlayerState) => {
    setSavingPlayerState(true);
    setPlayerStateErr(null);
    setPlayerStateMsg(null);

    try {
      const res = await fetch("/api/player/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(nextState),
      });

      const json = await safeJson<PlayerStateResponse>(res);
      if (!res.ok) {
        setPlayerStateErr(json?.error ?? `Failed to save squads (${res.status})`);
        return;
      }

      setPlayerState(json?.state ?? nextState);
      setPlayerStateMsg("Squads saved ✅");
    } catch (e: any) {
      setPlayerStateErr(e?.message ?? "Failed to save squads");
    } finally {
      setSavingPlayerState(false);
    }
  }, []);

  const updateSquadSlot = useCallback(
    async (slotNumber: number, heroUploadId: number | null) => {
      const nextSlots = squadSlots.map((slot) =>
        slot.slot === slotNumber ? { ...slot, hero_upload_id: heroUploadId } : slot
      );
      const nextState: PlayerState = {
        ...playerState,
        squads: {
          ...(playerState.squads ?? {}),
          slots: nextSlots,
        },
      };
      setPlayerState(nextState);
      await savePlayerState(nextState);
    },
    [playerState, savePlayerState, squadSlots]
  );

  const loadHeroProfile = useCallback(async (uploadId: number | null) => {
    if (!uploadId) {
      setHeroProfile(emptyHeroProfile());
      setHeroProfileImageUrl(null);
      return;
    }

    setHeroProfileLoading(true);
    setHeroProfileErr(null);
    setHeroProfileMsg(null);

    try {
      const res = await fetch(`/api/hero/details?upload_id=${uploadId}`, {
        credentials: "include",
      });
      const json = await safeJson<HeroProfileDetailsResponse>(res);

      if (!res.ok) {
        setHeroProfileErr(json?.error ?? `Load failed (${res.status})`);
        return;
      }

      const facts = json?.facts?.value ?? {};
      setHeroProfileImageUrl(json?.image_url ?? null);
      setHeroProfile({
        name: facts?.name ? String(facts.name) : "",
        level: facts?.level != null ? String(facts.level) : "",
        stars: facts?.stars != null ? String(facts.stars) : "",
        power: facts?.power != null ? String(facts.power) : "",
        attack: facts?.stats?.attack != null ? String(facts.stats.attack) : "",
        hp: facts?.stats?.hp != null ? String(facts.stats.hp) : "",
        defense: facts?.stats?.defense != null ? String(facts.stats.defense) : "",
        march_size: facts?.stats?.march_size != null ? String(facts.stats.march_size) : "",
      });
    } catch (e: any) {
      setHeroProfileErr(e?.message ?? "Load failed");
    } finally {
      setHeroProfileLoading(false);
    }
  }, []);

  const extractHeroProfile = useCallback(async () => {
    if (!selectedHeroUploadId) {
      setHeroProfileErr("Select a hero screenshot first.");
      return;
    }

    setHeroProfileExtracting(true);
    setHeroProfileErr(null);
    setHeroProfileMsg(null);

    try {
      const res = await fetch("/api/hero/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: selectedHeroUploadId }),
      });

      const json = await safeJson<{ ok?: boolean; extracted?: any; error?: string }>(res);
      if (!res.ok) {
        setHeroProfileErr(json?.error ?? `Extract failed (${res.status})`);
        return;
      }

      const extracted = json?.extracted;
      if (!extracted) {
        setHeroProfileErr("Extract returned no data.");
        return;
      }

      setHeroProfile({
        name: extracted?.name ? String(extracted.name) : "",
        level: extracted?.level != null ? String(extracted.level) : "",
        stars: extracted?.stars != null ? String(extracted.stars) : "",
        power: extracted?.power != null ? String(extracted.power) : "",
        attack: extracted?.stats?.attack != null ? String(extracted.stats.attack) : "",
        hp: extracted?.stats?.hp != null ? String(extracted.stats.hp) : "",
        defense: extracted?.stats?.defense != null ? String(extracted.stats.defense) : "",
        march_size: extracted?.stats?.march_size != null ? String(extracted.stats.march_size) : "",
      });

      setHeroProfileMsg("Extracted ✅ (review, then Save)");
    } catch (e: any) {
      setHeroProfileErr(e?.message ?? "Extract failed");
    } finally {
      setHeroProfileExtracting(false);
    }
  }, [selectedHeroUploadId]);

  const saveHeroProfile = useCallback(async () => {
    if (!selectedHeroUploadId) {
      setHeroProfileErr("Select a hero screenshot first.");
      return;
    }

    setHeroProfileSaving(true);
    setHeroProfileErr(null);
    setHeroProfileMsg(null);

    try {
      const res = await fetch("/api/hero/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          upload_id: selectedHeroUploadId,
          name: heroProfile.name,
          level: heroProfile.level,
          stars: heroProfile.stars,
          power: heroProfile.power,
          attack: heroProfile.attack,
          hp: heroProfile.hp,
          defense: heroProfile.defense,
          march_size: heroProfile.march_size,
        }),
      });

      const json = await safeJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok) {
        setHeroProfileErr(json?.error ?? `Save failed (${res.status})`);
        return;
      }

      await loadHeroProfile(selectedHeroUploadId);
      setHeroProfileMsg("Saved ✅");
    } catch (e: any) {
      setHeroProfileErr(e?.message ?? "Save failed");
    } finally {
      setHeroProfileSaving(false);
    }
  }, [heroProfile, loadHeroProfile, selectedHeroUploadId]);

  const submitUploads = useCallback(async () => {
    if (!uploadFiles.length) {
      setUploadErr("Choose at least one screenshot first.");
      return;
    }

    setUploadBusy(true);
    setUploadErr(null);
    setUploadMsg(null);

    try {
      for (const file of uploadFiles) {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", uploadKind);

        const res = await fetch("/api/uploads/image", {
          method: "POST",
          credentials: "include",
          body: form,
        });

        const payload = await safeJson<{ ok?: boolean; error?: string }>(res);
        if (!res.ok) {
          throw new Error(payload?.error ?? `Upload failed (${res.status})`);
        }
      }

      setUploadMsg(`Uploaded ${uploadFiles.length} screenshot${uploadFiles.length === 1 ? "" : "s"} ✅`);
      setUploadFiles([]);

      if (uploadKind === "hero_profile" || uploadKind === "hero_skills" || uploadKind === "gear") {
        await loadHeroUploads();
      }
      if (uploadKind === "drone") {
        await loadDroneUploads();
      }
      if (uploadKind === "overlord") {
        await loadOverlordUploads();
      }
    } catch (e: any) {
      setUploadErr(e?.message ?? "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }, [loadDroneUploads, loadHeroUploads, loadOverlordUploads, uploadFiles, uploadKind]);

  useEffect(() => {
    void loadHeroUploads();
    void loadDroneUploads();
    void loadOverlordUploads();
    void loadPlayerState();
  }, [loadDroneUploads, loadHeroUploads, loadOverlordUploads, loadPlayerState]);

  useEffect(() => {
    if (heroSubModalOpen) {
      void loadHeroProfile(selectedHeroUploadId);
    }
  }, [heroSubModalOpen, loadHeroProfile, selectedHeroUploadId]);

  const assignedHeroUploads = useMemo(() => {
    const ids = new Set(squadSlots.map((s) => s.hero_upload_id).filter((v): v is number => v != null));
    return heroUploads.filter((u) => ids.has(u.id));
  }, [heroUploads, squadSlots]);

  return (
    <main className="min-h-screen bg-[#060b14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-b from-[#101828] to-[#0a1020] p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-white md:text-4xl">SquadAssistant</div>
              <div className="mt-2 max-w-2xl text-sm text-white/55 md:text-base">
                Home launcher for uploads, squads, hero profile submodal, drone, and overlord.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <AppCard title="Upload" subtitle="Add and review screenshots" onClick={() => setUploadOpen(true)} />
              <AppCard title="Squads" subtitle="Assign heroes and open profiles" onClick={() => setSquadsOpen(true)} />
              <AppCard title="Drone" subtitle="Overview, components, boost, chips" onClick={() => setDroneOpen(true)} />
              <AppCard title="Overlord" subtitle="Profile, skills, bond, train" onClick={() => setOverlordOpen(true)} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title="Current Squad Snapshot" subtitle="Assigned hero uploads from squad slots 1 through 4">
              {loadingPlayerState ? (
                <div className="text-sm text-white/55">Loading squads…</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {squadSlots.map((slot) => {
                    const hero = heroUploads.find((u) => u.id === slot.hero_upload_id) ?? null;
                    return (
                      <button
                        key={slot.slot}
                        onClick={() => {
                          if (!hero?.id) return;
                          setSelectedHeroUploadId(hero.id);
                          setHeroSubModalTab("profile");
                          setHeroSubModalOpen(true);
                          setSquadsOpen(true);
                        }}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"
                      >
                        <div className="text-xs uppercase tracking-[0.25em] text-white/40">Squad {slot.slot}</div>
                        <div className="mt-3 h-32 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                          {hero?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={hero.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-white/35">No hero</div>
                          )}
                        </div>
                        <div className="mt-3 text-sm text-white/75">{hero ? `Upload #${hero.id}` : "Tap Squads to assign"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Library Snapshot" subtitle="Quick count of currently loaded screenshot groups">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Heroes</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{heroUploads.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Drone</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{droneUploads.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Overlord</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{overlordUploads.length}</div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      <ModalShell
        title="Uploads"
        subtitle="Upload new screenshots and review your saved library."
        onClose={() => setUploadOpen(false)}
        open={uploadOpen}
        wide
      >
        <div className="space-y-6">
          {uploadErr ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{uploadErr}</div>
          ) : null}

          {uploadMsg ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{uploadMsg}</div>
          ) : null}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
            <div className="text-lg font-semibold text-white">Upload New Screenshots</div>
            <div className="mt-1 text-sm text-white/55">
              Choose the section, pick one or more screenshots, and upload them into your saved library.
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Section</div>
                <select
                  value={uploadKind}
                  onChange={(e) => setUploadKind(e.target.value as UploadKind)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                >
                  <option value="hero_profile">Hero Profile</option>
                  <option value="hero_skills">Hero Skills</option>
                  <option value="gear">Hero Gear</option>
                  <option value="drone">Drone</option>
                  <option value="overlord">Overlord</option>
                  <option value="battle_report">Battle Report</option>
                </select>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Screenshots</div>
                <label className="mt-2 flex min-h-[120px] cursor-pointer items-center justify-center rounded-3xl border border-dashed border-white/15 bg-black/20 p-4 text-center hover:bg-black/30">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      setUploadFiles(files);
                      setUploadErr(null);
                      setUploadMsg(null);
                    }}
                  />
                  <div>
                    <div className="text-sm font-medium text-white">Tap to choose screenshots</div>
                    <div className="mt-1 text-xs text-white/45">PNG, JPG, WEBP, or GIF</div>
                  </div>
                </label>
              </div>
            </div>

            {uploadFiles.length ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium text-white">Ready to upload</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {uploadFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="truncate text-sm text-white">{file.name}</div>
                      <div className="mt-1 text-xs text-white/45">{Math.round(file.size / 1024)} KB</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void submitUploads()}
                    disabled={uploadBusy}
                    className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 disabled:opacity-40"
                  >
                    {uploadBusy ? "Uploading…" : "Upload Screenshots"}
                  </button>

                  <button
                    onClick={() => {
                      setUploadFiles([]);
                      setUploadErr(null);
                      setUploadMsg(null);
                    }}
                    disabled={uploadBusy}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard title="Hero Uploads" subtitle={loadingHeroUploads ? "Loading…" : `${heroUploads.length} items`}>
              <div className="grid gap-3">
                {heroUploads.map((u) => (
                  <div key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-sm font-medium text-white">Hero #{u.id}</div>
                    <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Drone Uploads" subtitle={loadingDroneUploads ? "Loading…" : `${droneUploads.length} items`}>
              <div className="grid gap-3">
                {droneUploads.map((u) => (
                  <div key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-sm font-medium text-white">Drone #{u.id}</div>
                    <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Overlord Uploads"
              subtitle={loadingOverlordUploads ? "Loading…" : `${overlordUploads.length} items`}
            >
              <div className="grid gap-3">
                {overlordUploads.map((u) => (
                  <div key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-sm font-medium text-white">Overlord #{u.id}</div>
                    <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Squads"
        subtitle="Assign hero screenshots to squad slots and open the hero profile submodal from inside squads."
        onClose={() => setSquadsOpen(false)}
        open={squadsOpen}
        wide
      >
        <div className="space-y-6">
          {playerStateErr ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{playerStateErr}</div>
          ) : null}
          {playerStateMsg ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{playerStateMsg}</div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard title="Squad Slots" subtitle={savingPlayerState ? "Saving…" : "Select which hero belongs in each slot"}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {squadSlots.map((slot) => {
                  const selectedId = slot.hero_upload_id;
                  const hero = heroUploads.find((u) => u.id === selectedId) ?? null;

                  return (
                    <div key={slot.slot} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.25em] text-white/45">Squad {slot.slot}</div>

                      <div className="mt-3 h-36 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        {hero?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hero.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-white/35">No hero assigned</div>
                        )}
                      </div>

                      <select
                        value={selectedId ?? ""}
                        onChange={(e) => {
                          const next = e.target.value ? Number(e.target.value) : null;
                          void updateSquadSlot(slot.slot, next);
                        }}
                        className="mt-3 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                      >
                        <option value="">— Select hero upload —</option>
                        {heroUploads.map((upload) => (
                          <option key={upload.id} value={upload.id}>
                            Hero #{upload.id}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          if (!hero?.id) return;
                          setSelectedHeroUploadId(hero.id);
                          setHeroSubModalTab("profile");
                          setHeroSubModalOpen(true);
                        }}
                        disabled={!hero?.id}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
                      >
                        Open Hero Profile
                      </button>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Assigned Hero Strip" subtitle="Quick access to the heroes currently mapped into squads">
              {assignedHeroUploads.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {assignedHeroUploads.map((hero) => (
                    <button
                      key={hero.id}
                      onClick={() => {
                        setSelectedHeroUploadId(hero.id);
                        setHeroSubModalTab("profile");
                        setHeroSubModalOpen(true);
                      }}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"
                    >
                      <div className="h-36 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        {hero.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hero.url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="mt-3 text-sm font-medium text-white">Hero #{hero.id}</div>
                      <div className="text-xs text-white/45">{fmtDate(hero.created_at)}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/50">No heroes are assigned yet.</div>
              )}
            </SectionCard>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Hero Profile"
        subtitle={selectedHeroUpload ? `Hero upload #${selectedHeroUpload.id}` : "Hero submodal inside squads"}
        onClose={() => setHeroSubModalOpen(false)}
        open={heroSubModalOpen}
        wide
      >
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <TabButton active={heroSubModalTab === "profile"} label="Profile" onClick={() => setHeroSubModalTab("profile")} />
            <TabButton active={heroSubModalTab === "gear"} label="Gear" onClick={() => setHeroSubModalTab("gear")} />
            <TabButton active={heroSubModalTab === "skills"} label="Skills" onClick={() => setHeroSubModalTab("skills")} />
          </div>

          {heroSubModalTab === "profile" ? (
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <SectionCard title="Profile Card" subtitle="Social-profile style hero header">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                  {heroProfileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={heroProfileImageUrl} alt="" className="h-[420px] w-full object-cover" />
                  ) : (
                    <div className="flex h-[420px] items-center justify-center text-sm text-white/35">No hero image loaded</div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Hero Stats" subtitle={heroProfileLoading ? "Loading…" : "Extract, review, then save"}>
                {heroProfileErr ? (
                  <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {heroProfileErr}
                  </div>
                ) : null}
                {heroProfileMsg ? (
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                    {heroProfileMsg}
                  </div>
                ) : null}

                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void extractHeroProfile()}
                    disabled={heroProfileExtracting || !selectedHeroUploadId}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
                  >
                    {heroProfileExtracting ? "Extracting…" : "Extract from Image"}
                  </button>
                  <button
                    onClick={() => void loadHeroProfile(selectedHeroUploadId)}
                    disabled={heroProfileLoading}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                  >
                    {heroProfileLoading ? "Loading…" : "Reload"}
                  </button>
                  <button
                    onClick={() => void saveHeroProfile()}
                    disabled={heroProfileSaving || !selectedHeroUploadId}
                    className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 disabled:opacity-40"
                  >
                    {heroProfileSaving ? "Saving…" : "Save"}
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/55">Name</div>
                    <input
                      value={heroProfile.name}
                      onChange={(e) => setHeroProfile((s) => ({ ...s, name: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/55">Level</div>
                    <input
                      value={heroProfile.level}
                      onChange={(e) => setHeroProfile((s) => ({ ...s, level: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/55">Stars</div>
                    <input
                      value={heroProfile.stars}
                      onChange={(e) => setHeroProfile((s) => ({ ...s, stars: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/55">Power</div>
                    <input
                      value={heroProfile.power}
                      onChange={(e) => setHeroProfile((s) => ({ ...s, power: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/55">Attack</div>
                    <input
                      value={heroProfile.attack}
                      onChange={(e) => setHeroProfile((s) => ({ ...s, attack: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/55">HP</div>
                    <input
                      value={heroProfile.hp}
                      onChange={(e) => setHeroProfile((s) => ({ ...s, hp: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/55">Defense</div>
                    <input
                      value={heroProfile.defense}
                      onChange={(e) => setHeroProfile((s) => ({ ...s, defense: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/55">March Size</div>
                    <input
                      value={heroProfile.march_size}
                      onChange={(e) => setHeroProfile((s) => ({ ...s, march_size: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {heroSubModalTab === "gear" ? <HeroGearEditor selectedUploadId={selectedHeroUploadId} /> : null}
          {heroSubModalTab === "skills" ? <HeroSkillsEditor selectedUploadId={selectedHeroUploadId} /> : null}
        </div>
      </ModalShell>

      <ModalShell
        title="Drone"
        subtitle="Two-tab layout: Overview + Components, then Combat Boost + Skill Chips."
        onClose={() => setDroneOpen(false)}
        open={droneOpen}
        wide
      >
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
            <SectionCard title="Drone Screenshots" subtitle={loadingDroneUploads ? "Loading…" : `${droneUploads.length} uploads`}>
              <div className="grid gap-3">
                {droneUploads.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedDroneUploadId(u.id)}
                    className={cx(
                      "rounded-3xl border p-3 text-left",
                      selectedDroneUploadId === u.id ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-black/20"
                    )}
                  >
                    <div className="text-sm font-medium text-white">Drone #{u.id}</div>
                    <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Drone Workspace" subtitle={selectedDroneUpload ? `Selected upload #${selectedDroneUpload.id}` : "Pick a drone screenshot"}>
              <div className="mb-4 flex flex-wrap gap-2">
                <TabButton
                  active={droneTab === "overview_components"}
                  label="Overview + Components"
                  onClick={() => setDroneTab("overview_components")}
                />
                <TabButton
                  active={droneTab === "combat_chips"}
                  label="Combat Boost + Skill Chips"
                  onClick={() => setDroneTab("combat_chips")}
                />
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
                      Select a drone upload with a valid storage path so the drone owner id can be derived.
                    </div>
                  )}
                </div>
              ) : null}

              {droneTab === "combat_chips" ? (
                <div className="space-y-6">
                  {droneOwnerId ? (
                    <>
                      <DroneCombatBoostEditor ownerId={droneOwnerId} selectedUploadId={selectedDroneUploadId} />
                      <DroneBoostChipsEditor ownerId={droneOwnerId} selectedUploadId={selectedDroneUploadId} />
                    </>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                      Select a drone upload with a valid storage path first.
                    </div>
                  )}
                </div>
              ) : null}
            </SectionCard>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Overlord"
        subtitle="Profile-style modal with progression sections for profile, skills, promote, bond, and train."
        onClose={() => setOverlordOpen(false)}
        open={overlordOpen}
        wide
      >
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
            <SectionCard title="Overlord Screenshots" subtitle={loadingOverlordUploads ? "Loading…" : `${overlordUploads.length} uploads`}>
              <div className="grid gap-3">
                {overlordUploads.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedOverlordUploadId(u.id)}
                    className={cx(
                      "rounded-3xl border p-3 text-left",
                      selectedOverlordUploadId === u.id ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-black/20"
                    )}
                  >
                    <div className="text-sm font-medium text-white">Overlord #{u.id}</div>
                    <div className="mt-1 text-xs text-white/45">{fmtDate(u.created_at)}</div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Overlord Workspace"
              subtitle={selectedOverlordUpload ? `Selected upload #${selectedOverlordUpload.id}` : "Pick an overlord screenshot"}
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <TabButton active={overlordTab === "overview"} label="Overview" onClick={() => setOverlordTab("overview")} />
                <TabButton active={overlordTab === "skills"} label="Skills" onClick={() => setOverlordTab("skills")} />
                <TabButton active={overlordTab === "promote"} label="Promote" onClick={() => setOverlordTab("promote")} />
                <TabButton active={overlordTab === "bond"} label="Bond" onClick={() => setOverlordTab("bond")} />
                <TabButton active={overlordTab === "train"} label="Train" onClick={() => setOverlordTab("train")} />
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
            </SectionCard>
          </div>
        </div>
      </ModalShell>
    </main>
  );
                     }
