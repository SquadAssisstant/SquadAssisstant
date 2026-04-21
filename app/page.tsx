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

type PlayerState = {
  squads?: any;
};

type PlayerStateResponse = {
  ok?: boolean;
  state?: PlayerState;
  error?: string;
};

type UploadKind =
  | "hero_profile"
  | "hero_skills"
  | "gear"
  | "drone"
  | "drone_components"
  | "drone_skill_chips"
  | "overlord"
  | "overlord_skills"
  | "overlord_promote"
  | "overlord_training"
  | "overlord_bond"
  | "battle_report";

type UploadApiKind = "hero_profile" | "hero_skills" | "gear" | "drone" | "overlord" | "battle_report";

type BattleRange = "Individual" | "24hrs" | "Week" | "Month" | "Custom Range" | "All";

type BattleAnalysisRow = {
  id: number | string;
  created_at: string | null;
  analysis: any;
};

type BattleAnalyzeGetResponse = {
  ok?: boolean;
  fetched?: number;
  battleCount?: number;
  summary?: string;
  context_summary?: string;
  context?: any;
  analyses?: BattleAnalysisRow[];
  error?: string;
};

type BattleAnalyzePostResponse = {
  ok?: boolean;
  summary?: string;
  context_summary?: string;
  context?: any;
  answer?: string;
  mode?: string;
  error?: string;
};

type BattleGroupSummary = {
  id: number;
  profile_id?: string;
  label: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  item_count?: number;
};

type BattleGroupItem = {
  id: number;
  group_id: number;
  upload_id: number;
  position: number;
  created_at?: string;
  upload?: UploadItem | null;
};

type BattleGroupListResponse = {
  ok?: boolean;
  groups?: BattleGroupSummary[];
  error?: string;
};

type BattleGroupDetailResponse = {
  ok?: boolean;
  group?: BattleGroupSummary;
  items?: BattleGroupItem[];
  error?: string;
};

const HERO_KINDS = ["hero_profile", "hero"];
const DRONE_KINDS = ["drone", "drone_profile", "drone_components", "drone_combat_boost", "drone_skill_chips"];
const OVERLORD_KINDS = ["overlord", "lord", "over_lord"];
const BATTLE_KINDS = ["battle_report"];

const UPLOAD_KIND_OPTIONS: Array<{ value: UploadKind; label: string }> = [
  { value: "hero_profile", label: "Hero Profile" },
  { value: "hero_skills", label: "Hero Skills" },
  { value: "gear", label: "Hero Gear" },
  { value: "drone", label: "Drone Overview" },
  { value: "drone_components", label: "Drone Components" },
  { value: "drone_skill_chips", label: "Drone Skill Chips" },
  { value: "overlord", label: "Overlord Overview" },
  { value: "overlord_skills", label: "Overlord Skills" },
  { value: "overlord_promote", label: "Overlord Promote" },
  { value: "overlord_training", label: "Overlord Training" },
  { value: "overlord_bond", label: "Overlord Bond" },
  { value: "battle_report", label: "Battle Report" },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function firstPathSegment(path?: string | null) {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  return raw.split("/")[0] ?? "";
}

function fmtDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
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

function normalizeUploadKindForApi(kind: UploadKind): UploadApiKind {
  if (kind === "drone" || kind === "drone_components" || kind === "drone_skill_chips") return "drone";
  if (
    kind === "overlord" ||
    kind === "overlord_skills" ||
    kind === "overlord_promote" ||
    kind === "overlord_training" ||
    kind === "overlord_bond"
  ) {
    return "overlord";
  }
  if (kind === "battle_report") return "battle_report";
  if (kind === "hero_skills") return "hero_skills";
  if (kind === "gear") return "gear";
  return "hero_profile";
}

function isBattleUploadKind(kind: UploadKind) {
  return kind === "battle_report";
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

function buildEmptySquadAssignments(): Record<number, Record<number, number | null>> {
  const out = {} as Record<number, Record<number, number | null>>;
  for (const squad of [1, 2, 3, 4]) {
    out[squad] = {} as Record<number, number | null>;
    for (const slot of [1, 2, 3, 4, 5]) {
      out[squad][slot] = null;
    }
  }
  return out;
}

function normalizeSquadAssignments(state: PlayerState | null | undefined): Record<number, Record<number, number | null>> {
  const base = buildEmptySquadAssignments();
  const raw = state?.squads;

  if (!raw) return base;

  if (Array.isArray(raw?.slots)) {
    const legacySlots = raw.slots;
    for (let i = 0; i < Math.min(legacySlots.length, 4); i++) {
      const row = legacySlots[i];
      const uploadId = Number.isFinite(Number(row?.hero_upload_id)) ? Number(row.hero_upload_id) : null;
      base[i + 1][1] = uploadId;
    }
    return base;
  }

  for (const squad of [1, 2, 3, 4]) {
    const squadNode = raw?.[String(squad)] ?? raw?.[squad] ?? null;
    const slotsNode = squadNode?.slots ?? squadNode ?? null;

    for (const slot of [1, 2, 3, 4, 5]) {
      const v = slotsNode?.[String(slot)] ?? slotsNode?.[slot];
      base[squad][slot] = Number.isFinite(Number(v)) ? Number(v) : null;
    }
  }

  return base;
}

function squadAssignmentsToState(assignments: Record<number, Record<number, number | null>>): PlayerState {
  return {
    squads: {
      "1": { slots: { "1": assignments[1][1], "2": assignments[1][2], "3": assignments[1][3], "4": assignments[1][4], "5": assignments[1][5] } },
      "2": { slots: { "1": assignments[2][1], "2": assignments[2][2], "3": assignments[2][3], "4": assignments[2][4], "5": assignments[2][5] } },
      "3": { slots: { "1": assignments[3][1], "2": assignments[3][2], "3": assignments[3][3], "4": assignments[3][4], "5": assignments[3][5] } },
      "4": { slots: { "1": assignments[4][1], "2": assignments[4][2], "3": assignments[4][3], "4": assignments[4][4], "5": assignments[4][5] } },
    },
  };
}

function getBattleRangeStart(range: BattleRange): Date | null {
  const now = new Date();
  if (range === "24hrs") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === "Week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "Month") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

function summarizeFilteredBattles(
  rows: BattleAnalysisRow[],
  range: BattleRange,
  contextSummary: string,
  begin?: string,
  finish?: string,
  groupLabel?: string
) {
  const newest = rows[0]?.created_at ? fmtDate(rows[0].created_at) : "unknown";
  const oldest = rows.length ? fmtDate(rows[rows.length - 1]?.created_at) : "unknown";

  const lines: string[] = [];
  lines.push("Battle report analyzer");
  lines.push(`Range: ${range}`);
  if (groupLabel) lines.push(`Selected file: ${groupLabel}`);
  if (range === "Custom Range") {
    lines.push(`Begin: ${begin || "—"}`);
    lines.push(`Finish: ${finish || "—"}`);
  }
  lines.push(`Reports in selection: ${rows.length}`);
  lines.push(`Newest in selection: ${newest}`);
  lines.push(`Oldest in selection: ${oldest}`);
  lines.push("");
  lines.push("Saved player data loaded first.");
  lines.push(contextSummary || "No context summary available.");

  return lines.join("\n");
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
  const [battleOpen, setBattleOpen] = useState(false);

  const [heroSubModalOpen, setHeroSubModalOpen] = useState(false);

  const [heroUploads, setHeroUploads] = useState<UploadItem[]>([]);
  const [droneUploads, setDroneUploads] = useState<UploadItem[]>([]);
  const [overlordUploads, setOverlordUploads] = useState<UploadItem[]>([]);
  const [battleUploads, setBattleUploads] = useState<UploadItem[]>([]);

  const [loadingHeroUploads, setLoadingHeroUploads] = useState(false);
  const [loadingDroneUploads, setLoadingDroneUploads] = useState(false);
  const [loadingOverlordUploads, setLoadingOverlordUploads] = useState(false);
  const [loadingBattleUploads, setLoadingBattleUploads] = useState(false);

  const [playerState, setPlayerState] = useState<PlayerState>({ squads: {} });
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

  const [battleRange, setBattleRange] = useState<BattleRange>("Individual");
  const [battleCustomBegin, setBattleCustomBegin] = useState("");
  const [battleCustomFinish, setBattleCustomFinish] = useState("");
  const [battleQuestion, setBattleQuestion] = useState("");
  const [battleBusy, setBattleBusy] = useState(false);
  const [battleErr, setBattleErr] = useState<string | null>(null);
  const [battleSummary, setBattleSummary] = useState<string>("");
  const [battleAnswer, setBattleAnswer] = useState<string>("");
  const [battleContextSummary, setBattleContextSummary] = useState<string>("");
  const [battleAnalyses, setBattleAnalyses] = useState<BattleAnalysisRow[]>([]);
  const [selectedBattleReportId, setSelectedBattleReportId] = useState<string>("");

  const [battleGroups, setBattleGroups] = useState<BattleGroupSummary[]>([]);
  const [loadingBattleGroups, setLoadingBattleGroups] = useState(false);
  const [selectedBattleGroupId, setSelectedBattleGroupId] = useState<string>("");
  const [selectedBattleGroup, setSelectedBattleGroup] = useState<BattleGroupSummary | null>(null);
  const [selectedBattleGroupItems, setSelectedBattleGroupItems] = useState<BattleGroupItem[]>([]);
  const [battleGroupErr, setBattleGroupErr] = useState<string | null>(null);

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

  const squadAssignments = useMemo(() => normalizeSquadAssignments(playerState), [playerState]);

  const squadCards = useMemo(() => {
    return [1, 2, 3, 4].map((squad) => ({
      squad,
      slots: [1, 2, 3, 4, 5].map((slot) => {
        const uploadId = squadAssignments[squad][slot];
        const upload = heroUploads.find((u) => u.id === uploadId) ?? null;
        return { slot, uploadId, upload };
      }),
    }));
  }, [heroUploads, squadAssignments]);

  const assignedHeroUploads = useMemo(() => {
    const ids = new Set<number>();
    for (const squad of [1, 2, 3, 4]) {
      for (const slot of [1, 2, 3, 4, 5]) {
        const id = squadAssignments[squad][slot];
        if (id != null) ids.add(id);
      }
    }
    return heroUploads.filter((u) => ids.has(u.id));
  }, [heroUploads, squadAssignments]);

  const filteredBattleAnalyses = useMemo(() => {
    const rows = [...battleAnalyses];

    if (battleRange === "All") return rows;
    if (battleRange === "Individual") return rows;

    if (battleRange === "Custom Range") {
      const begin = battleCustomBegin ? new Date(`${battleCustomBegin}T00:00:00`) : null;
      const finish = battleCustomFinish ? new Date(`${battleCustomFinish}T23:59:59`) : null;

      return rows.filter((r) => {
        if (!r.created_at) return false;
        const t = new Date(r.created_at);
        if (Number.isNaN(t.getTime())) return false;
        if (begin && t < begin) return false;
        if (finish && t > finish) return false;
        return true;
      });
    }

    const start = getBattleRangeStart(battleRange);
    if (!start) return rows;

    return rows.filter((r) => {
      if (!r.created_at) return false;
      const t = new Date(r.created_at);
      return !Number.isNaN(t.getTime()) && t >= start;
    });
  }, [battleAnalyses, battleCustomBegin, battleCustomFinish, battleRange]);

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

  const loadBattleUploads = useCallback(async () => {
    setLoadingBattleUploads(true);
    try {
      const items = await loadUploadsByKinds(BATTLE_KINDS);
      setBattleUploads(items);
    } finally {
      setLoadingBattleUploads(false);
    }
  }, [loadUploadsByKinds]);

  const loadBattleGroups = useCallback(async () => {
    setLoadingBattleGroups(true);
    setBattleGroupErr(null);

    try {
      const res = await fetch("/api/battle/groups?limit=200", {
        credentials: "include",
      });
      const json = await safeJson<BattleGroupListResponse>(res);

      if (!res.ok) {
        setBattleGroupErr(json?.error ?? `Failed to load battle files (${res.status})`);
        return;
      }

      const groups = Array.isArray(json?.groups) ? json.groups : [];
      setBattleGroups(groups);

      if (!selectedBattleGroupId && groups[0]) {
        setSelectedBattleGroupId(String(groups[0].id));
      }
    } catch (e: any) {
      setBattleGroupErr(e?.message ?? "Failed to load battle files");
    } finally {
      setLoadingBattleGroups(false);
    }
  }, [selectedBattleGroupId]);

  const loadBattleGroupDetail = useCallback(async (groupId: string) => {
    if (!groupId) {
      setSelectedBattleGroup(null);
      setSelectedBattleGroupItems([]);
      return;
    }

    setBattleGroupErr(null);

    try {
      const res = await fetch(`/api/battle/groups?group_id=${encodeURIComponent(groupId)}`, {
        credentials: "include",
      });
      const json = await safeJson<BattleGroupDetailResponse>(res);

      if (!res.ok) {
        setBattleGroupErr(json?.error ?? `Failed to load battle file (${res.status})`);
        return;
      }

      setSelectedBattleGroup(json?.group ?? null);
      setSelectedBattleGroupItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setBattleGroupErr(e?.message ?? "Failed to load battle file");
    }
  }, []);

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
      setPlayerState(json?.state ?? { squads: {} });
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

  const updateSquadHeroSlot = useCallback(
    async (squadNumber: number, heroSlotNumber: number, heroUploadId: number | null) => {
      const nextAssignments = {
        ...squadAssignments,
        [squadNumber]: {
          ...squadAssignments[squadNumber],
          [heroSlotNumber]: heroUploadId,
        },
      };

      const nextState = squadAssignmentsToState(nextAssignments);
      setPlayerState(nextState);
      await savePlayerState(nextState);
    },
    [savePlayerState, squadAssignments]
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

  const loadBattleAnalyzerData = useCallback(async () => {
    setBattleBusy(true);
    setBattleErr(null);

    try {
      const res = await fetch("/api/battle/analyze?limit=200", {
        credentials: "include",
      });
      const json = await safeJson<BattleAnalyzeGetResponse>(res);

      if (!res.ok) {
        setBattleErr(json?.error ?? `Failed to load battle analyzer (${res.status})`);
        return;
      }

      const analyses = Array.isArray(json?.analyses) ? json.analyses : [];
      setBattleAnalyses(analyses);
      setBattleContextSummary(json?.context_summary ?? "");
      setBattleSummary(json?.summary ?? "");
      setBattleAnswer("");

      if (!selectedBattleReportId && analyses[0]) {
        setSelectedBattleReportId(String(analyses[0].id));
      }
    } catch (e: any) {
      setBattleErr(e?.message ?? "Failed to load battle analyzer");
    } finally {
      setBattleBusy(false);
    }
  }, [selectedBattleReportId]);

  const runBattleAnalyzer = useCallback(async () => {
    setBattleBusy(true);
    setBattleErr(null);
    setBattleAnswer("");

    try {
      if (battleRange === "Individual") {
        if (!selectedBattleReportId) {
          setBattleErr("Select an individual analyzed report first.");
          return;
        }

        const res = await fetch(`/api/battle/analyze/${selectedBattleReportId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message:
              battleQuestion ||
              `Explain this report${selectedBattleGroup?.label ? ` for battle file "${selectedBattleGroup.label}"` : ""}.`,
            detail: true,
          }),
        });

        const json = await safeJson<BattleAnalyzePostResponse>(res);
        if (!res.ok) {
          setBattleErr(json?.error ?? `Battle analyzer failed (${res.status})`);
          return;
        }

        setBattleSummary(
          summarizeFilteredBattles(
            filteredBattleAnalyses.filter((r) => String(r.id) === selectedBattleReportId),
            battleRange,
            json?.context_summary ?? battleContextSummary,
            battleCustomBegin,
            battleCustomFinish,
            selectedBattleGroup?.label
          )
        );
        setBattleAnswer(json?.answer ?? "");
        setBattleContextSummary(json?.context_summary ?? battleContextSummary);
        return;
      }

      const res = await fetch("/api/battle/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message:
            battleQuestion ||
            `Analyze my ${battleRange} performance using saved player data first, then fill gaps with estimation.`,
          detail: true,
          limit: 200,
        }),
      });

      const json = await safeJson<BattleAnalyzePostResponse>(res);
      if (!res.ok) {
        setBattleErr(json?.error ?? `Battle analyzer failed (${res.status})`);
        return;
      }

      setBattleSummary(
        summarizeFilteredBattles(
          filteredBattleAnalyses,
          battleRange,
          json?.context_summary ?? battleContextSummary,
          battleCustomBegin,
          battleCustomFinish,
          selectedBattleGroup?.label
        )
      );
      setBattleAnswer(json?.answer ?? "");
      setBattleContextSummary(json?.context_summary ?? battleContextSummary);
    } catch (e: any) {
      setBattleErr(e?.message ?? "Battle analyzer failed");
    } finally {
      setBattleBusy(false);
    }
  }, [
    battleContextSummary,
    battleCustomBegin,
    battleCustomFinish,
    battleQuestion,
    battleRange,
    filteredBattleAnalyses,
    selectedBattleGroup?.label,
    selectedBattleReportId,
  ]);

  const submitUploads = useCallback(async () => {
    if (!uploadFiles.length) {
      setUploadErr("Choose at least one screenshot first.");
      return;
    }

    setUploadBusy(true);
    setUploadErr(null);
    setUploadMsg(null);

    try {
      const apiKind = normalizeUploadKindForApi(uploadKind);
      const createdUploadIds: number[] = [];

      for (const file of uploadFiles) {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", apiKind);

        const res = await fetch("/api/uploads/image", {
          method: "POST",
          credentials: "include",
          body: form,
        });

        const payload = await safeJson<any>(res);
        if (!res.ok) {
          throw new Error(payload?.error ?? `Upload failed (${res.status})`);
        }

        const uploadId = Number(payload?.upload?.id ?? payload?.id);
        if (Number.isFinite(uploadId) && uploadId > 0) {
          createdUploadIds.push(uploadId);
        }
      }

      let extraMsg = "";

      if (isBattleUploadKind(uploadKind)) {
        const label = window.prompt("Name this battle report grouping:", "");

        if (label && label.trim()) {
          const groupRes = await fetch("/api/battle/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              label: label.trim(),
              upload_ids: createdUploadIds,
            }),
          });

          const groupJson = await safeJson<any>(groupRes);
          if (!groupRes.ok) {
            throw new Error(groupJson?.error ?? `Failed to create battle report file (${groupRes.status})`);
          }

          extraMsg = ` Battle file saved: ${label.trim()}`;
        } else {
          extraMsg = " Battle screenshots uploaded, but no file label was saved.";
        }
      }

      setUploadMsg(`Uploaded ${uploadFiles.length} screenshot${uploadFiles.length === 1 ? "" : "s"} ✅${extraMsg}`);
      setUploadFiles([]);

      if (apiKind === "hero_profile" || apiKind === "hero_skills" || apiKind === "gear") {
        await loadHeroUploads();
      }
      if (apiKind === "drone") {
        await loadDroneUploads();
      }
      if (apiKind === "overlord") {
        await loadOverlordUploads();
      }
      if (apiKind === "battle_report") {
        await loadBattleUploads();
        await loadBattleGroups();
        await loadBattleAnalyzerData();
      }
    } catch (e: any) {
      setUploadErr(e?.message ?? "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }, [
    loadBattleAnalyzerData,
    loadBattleGroups,
    loadBattleUploads,
    loadDroneUploads,
    loadHeroUploads,
    loadOverlordUploads,
    uploadFiles,
    uploadKind,
  ]);

  useEffect(() => {
    void loadHeroUploads();
    void loadDroneUploads();
    void loadOverlordUploads();
    void loadBattleUploads();
    void loadBattleGroups();
    void loadPlayerState();
  }, [loadBattleGroups, loadBattleUploads, loadDroneUploads, loadHeroUploads, loadOverlordUploads, loadPlayerState]);

  useEffect(() => {
    if (heroSubModalOpen) {
      void loadHeroProfile(selectedHeroUploadId);
    }
  }, [heroSubModalOpen, loadHeroProfile, selectedHeroUploadId]);

  useEffect(() => {
    if (battleOpen) {
      void loadBattleAnalyzerData();
      void loadBattleGroups();
    }
  }, [battleOpen, loadBattleAnalyzerData, loadBattleGroups]);

  useEffect(() => {
    if (selectedBattleGroupId) {
      void loadBattleGroupDetail(selectedBattleGroupId);
    } else {
      setSelectedBattleGroup(null);
      setSelectedBattleGroupItems([]);
    }
  }, [loadBattleGroupDetail, selectedBattleGroupId]);

  return (
    <main className="min-h-screen bg-[#060b14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-b from-[#101828] to-[#0a1020] p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-white md:text-4xl">SquadAssistant</div>
              <div className="mt-2 max-w-3xl text-sm text-white/55 md:text-base">
                Home launcher for uploads, squads, hero profile submodal, drone, overlord, and battle report analyzer.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <AppCard title="Upload" subtitle="Add and review screenshots" onClick={() => setUploadOpen(true)} />
              <AppCard title="Squads" subtitle="Assign heroes and open profiles" onClick={() => setSquadsOpen(true)} />
              <AppCard title="Drone" subtitle="Overview, components, boost, chips" onClick={() => setDroneOpen(true)} />
              <AppCard title="Overlord" subtitle="Profile, skills, bond, train" onClick={() => setOverlordOpen(true)} />
              <AppCard title="Battle Reports" subtitle="Analyze report data" onClick={() => setBattleOpen(true)} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title="Current Squad Snapshot" subtitle="Four squads, five hero slots each">
              {loadingPlayerState ? (
                <div className="text-sm text-white/55">Loading squads…</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {squadCards.map((group) => {
                    const assigned = group.slots.filter((s) => s.upload).length;
                    const firstHero = group.slots.find((s) => s.upload)?.upload ?? null;

                    return (
                      <button
                        key={group.squad}
                        onClick={() => setSquadsOpen(true)}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"
                      >
                        <div className="text-xs uppercase tracking-[0.25em] text-white/40">Squad {group.squad}</div>
                        <div className="mt-3 h-32 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                          {firstHero?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={firstHero.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-white/35">No hero</div>
                          )}
                        </div>
                        <div className="mt-3 text-sm text-white/75">{assigned} / 5 hero slots assigned</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Library Snapshot" subtitle="Quick count of currently loaded screenshot groups">
              <div className="grid gap-3 sm:grid-cols-4">
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
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Battle Files</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{battleGroups.length}</div>
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

            <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Section</div>
                <select
                  value={uploadKind}
                  onChange={(e) => {
                    setUploadKind(e.target.value as UploadKind);
                    setUploadErr(null);
                    setUploadMsg(null);
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                >
                  {UPLOAD_KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {isBattleUploadKind(uploadKind) ? (
                  <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Please upload images for one report at a time.
                  </div>
                ) : null}
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

          <div className="grid gap-6 xl:grid-cols-4">
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

            <SectionCard
              title="Battle Files"
              subtitle={loadingBattleGroups ? "Loading…" : `${battleGroups.length} items`}
            >
              <div className="grid gap-3">
                {battleGroups.map((g) => (
                  <div key={g.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-sm font-medium text-white">{g.label}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {g.item_count ?? 0} image{(g.item_count ?? 0) === 1 ? "" : "s"} • {fmtDate(g.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Squads"
        subtitle="Assign up to five heroes per squad and open the same hero profile submodal from each slot."
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

          <div className="grid gap-5 xl:grid-cols-2">
            {squadCards.map((group) => (
              <SectionCard
                key={group.squad}
                title={`Squad ${group.squad}`}
                subtitle={savingPlayerState ? "Saving…" : "Five hero slots per squad"}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {group.slots.map(({ slot, upload }) => (
                    <div key={`${group.squad}-${slot}`} className="rounded-3xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs uppercase tracking-[0.25em] text-white/45">Hero {slot}</div>

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
                          void updateSquadHeroSlot(group.squad, slot, next);
                        }}
                        className="mt-3 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                      >
                        <option value="">— Select hero upload —</option>
                        {heroUploads.map((hero) => (
                          <option key={hero.id} value={hero.id}>
                            Hero #{hero.id}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          if (!upload?.id) return;
                          setSelectedHeroUploadId(upload.id);
                          setHeroSubModalTab("profile");
                          setHeroSubModalOpen(true);
                        }}
                        disabled={!upload?.id}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
                      >
                        Open Hero
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ))}
          </div>

          <SectionCard title="Assigned Hero Strip" subtitle="Quick access to heroes currently mapped into squads">
            {assignedHeroUploads.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <ModalShell
        title="Battle Report Analyzer"
        subtitle="Saved player data is loaded first, then gaps are filled as needed."
        onClose={() => setBattleOpen(false)}
        open={battleOpen}
        wide
      >
        <div className="space-y-6">
          {battleErr ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{battleErr}</div>
          ) : null}
          {battleGroupErr ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{battleGroupErr}</div>
          ) : null}

          <SectionCard title="Analyzer Controls" subtitle="Choose the report scope and run an analysis">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Scope</div>
                <select
                  value={battleRange}
                  onChange={(e) => setBattleRange(e.target.value as BattleRange)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                >
                  <option value="Individual">Individual</option>
                  <option value="24hrs">24hrs</option>
                  <option value="Week">Week</option>
                  <option value="Month">Month</option>
                  <option value="Custom Range">Custom Range</option>
                  <option value="All">All</option>
                </select>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Question</div>
                <input
                  value={battleQuestion}
                  onChange={(e) => setBattleQuestion(e.target.value)}
                  placeholder="ex: Why did I lose? What should I improve first?"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            {battleRange === "Custom Range" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">Begin</div>
                  <input
                    type="date"
                    value={battleCustomBegin}
                    onChange={(e) => setBattleCustomBegin(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/55">Finish</div>
                  <input
                    type="date"
                    value={battleCustomFinish}
                    onChange={(e) => setBattleCustomFinish(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
            ) : null}

            {battleRange === "Individual" ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Saved Report File</div>
                  <select
                    value={selectedBattleGroupId}
                    onChange={(e) => setSelectedBattleGroupId(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                  >
                    <option value="">— Select report file —</option>
                    {battleGroups.map((group) => (
                      <option key={group.id} value={String(group.id)}>
                        {group.label} • {group.item_count ?? 0} image{(group.item_count ?? 0) === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Analyzed Report Record</div>
                  <select
                    value={selectedBattleReportId}
                    onChange={(e) => setSelectedBattleReportId(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                  >
                    <option value="">— Select analyzed report —</option>
                    {battleAnalyses.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        Report #{row.id} • {fmtDate(row.created_at)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  void loadBattleGroups();
                  void loadBattleAnalyzerData();
                }}
                disabled={battleBusy || loadingBattleGroups}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
              >
                {battleBusy || loadingBattleGroups ? "Loading…" : "Reload Reports"}
              </button>
              <button
                onClick={() => void runBattleAnalyzer()}
                disabled={battleBusy}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 disabled:opacity-40"
              >
                {battleBusy ? "Analyzing…" : "Run Analysis"}
              </button>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <SectionCard
              title="Saved Report Files"
              subtitle={`${battleGroups.length} file${battleGroups.length === 1 ? "" : "s"} saved`}
            >
              <div className="space-y-4">
                <div className="grid gap-3">
                  {battleGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedBattleGroupId(String(group.id))}
                      className={cx(
                        "rounded-2xl border p-3 text-left",
                        String(group.id) === selectedBattleGroupId
                          ? "border-emerald-400/30 bg-emerald-500/10"
                          : "border-white/10 bg-black/20"
                      )}
                    >
                      <div className="text-sm font-medium text-white">{group.label}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {group.item_count ?? 0} image{(group.item_count ?? 0) === 1 ? "" : "s"} • {fmtDate(group.created_at)}
                      </div>
                    </button>
                  ))}
                  {!battleGroups.length ? (
                    <div className="text-sm text-white/50">No saved report files yet.</div>
                  ) : null}
                </div>

                {selectedBattleGroup ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-medium text-white">{selectedBattleGroup.label}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {selectedBattleGroupItems.length} image{selectedBattleGroupItems.length === 1 ? "" : "s"} in this file
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selectedBattleGroupItems.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-sm text-white">Image #{item.position + 1}</div>
                          <div className="mt-1 text-xs text-white/45">
                            Upload #{item.upload_id} • {fmtDate(item.upload?.created_at ?? item.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Analysis Output" subtitle={battleContextSummary || "Run the analyzer to load current context"}>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Summary</div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-white/80">{battleSummary || "No summary yet."}</pre>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Detailed Analysis</div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-white/80">
                    {battleAnswer || "No detailed analysis yet."}
                  </pre>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </ModalShell>
    </main>
  );
  }
