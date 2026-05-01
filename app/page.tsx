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

import { HeroesModal } from "@/components/heroes/HeroesModal";
import { MainChat } from "@/components/chat/MainChat";
import { OptimizerSavedRunsPanel } from "@/components/optimizer/OptimizerSavedRunsPanel";

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

  comparison?: any;
  factor_breakdown?: any;
  damage_model?: any;
  reasons?: string[];
  missing_data?: string[];

  error?: string;
};

type BattleAnalyzePostResponse = {
  ok?: boolean;
  summary?: string;
  context_summary?: string;
  context?: any;
  answer?: string;
  mode?: string;

  comparison?: any;
  factor_breakdown?: any;
  damage_model?: any;
  reasons?: string[];
  missing_data?: string[];

  error?: string;
};

type BattleReportPage = {
  id: string;
  storage_path: string;
  page_index: number;
};

type BattleReport = {
  id: string;
  created_at: string;
  battle_report_pages: BattleReportPage[];
};

type BattleReportListResponse = {
  reports: BattleReport[];
  error?: string;
};

type HeroRosterListItem = {
  hero_key: string;
  name: string;
  troop_type: string;
  level: number;
  stars: number;
  profile_upload_id: number | null;
  image_url: string | null;
  base_stats: {
    hp: number;
    atk: number;
    def: number;
    power: number;
    morale: number;
    march_size: number;
  };
  completeness: {
    has_profile: boolean;
    has_gear: boolean;
    has_skills: boolean;
  };
};

type OptimizerMode =
  | "balanced"
  | "highest_total_power"
  | "pure_offence"
  | "offence_leaning_sustain"
  | "defense_leaning_sustain"
  | "pure_defense";

type OptimizerResult = {
  mode: OptimizerMode;
  squad_count: number;
  locked_heroes: string[];
  squads: Array<{
    squad_number: number;
    heroes: Array<{
      hero_key: string;
      name: string;
      troop_type: string;
      level: number;
      stars: number;
      base_stats: {
        hp: number;
        atk: number;
        def: number;
        power: number;
        morale: number;
        march_size: number;
      };
    }>;
    placements: Array<{
      slot: number;
      hero_key: string;
      hero_name: string;
      troop_type: string;
      assigned_role: string;
      score_note: string;
    }>;
    gear_assignments: Array<{
      hero_key: string;
      slot: string;
      piece: {
        name: string | null;
        level: number;
        stars: number;
      } | null;
      reason: string;
    }>;
    scores: {
      total: number;
      offence: number;
      defense: number;
      sustain: number;
      effective_power: number;
    };
    explanation: string[];
  }>;
  unused_heroes: Array<{
    hero_key: string;
    name: string;
    reason: string;
  }>;
  summary: string[];
  assumptions: string[];
  context_snapshot: {
    hero_count: number;
    drone_ready: boolean;
    overlord_ready: boolean;
  };
};

type OptimizerRunResponse = {
  ok?: boolean;
  result?: OptimizerResult;
  error?: string;
};

type SavedOptimizerFile = {
  id: number;
  label: string;
  mode: string;
  squad_count: number;
  locked_heroes?: string[];
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  result?: OptimizerResult;
};

type SavedOptimizerListResponse = {
  ok?: boolean;
  files?: SavedOptimizerFile[];
  error?: string;
};

type SavedOptimizerDetailResponse = {
  ok?: boolean;
  saved?: SavedOptimizerFile;
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

const OPTIMIZER_MODE_OPTIONS: Array<{ value: OptimizerMode; label: string }> = [
  { value: "balanced", label: "Balanced/Combat Sustainability" },
  { value: "highest_total_power", label: "Highest Total Power Possible" },
  { value: "pure_offence", label: "Best Pure Offence" },
  { value: "offence_leaning_sustain", label: "Offence Leaning Combat Sustainability" },
  { value: "defense_leaning_sustain", label: "Defense Leaning Combat Sustainability" },
  { value: "pure_defense", label: "Best Pure Defense" },
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

function squadAssignmentsToState(
  assignments: Record<number, Record<number, number | null>>
): PlayerState {
  const squads: PlayerState["squads"] = {};

  for (const squad of [1, 2, 3, 4]) {
    squads[String(squad)] = { slots: {} };

    for (const slot of [1, 2, 3, 4, 5]) {
      squads[String(squad)].slots[String(slot)] =
        assignments[squad]?.[slot] ?? undefined;
    }
  }

  return { squads };
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
  open,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70">
      <div className="fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#0b1220]">
        <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-xl font-semibold text-white">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-white/65">{subtitle}</div> : null}
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
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
  const [heroesOpen, setHeroesOpen] = useState(false);
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);

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
  const [battleBusy, setBattleBusy] = useState(false);
  const [battleErr, setBattleErr] = useState<string | null>(null);
  const [battleSummary, setBattleSummary] = useState<string>("");
  const [battleAnswer, setBattleAnswer] = useState<string>("");
  const [mainChatTransfer, setMainChatTransfer] = useState<string | null>(null);
  const [battleContextSummary, setBattleContextSummary] = useState<string>("");
const [battleComparison, setBattleComparison] = useState<any>(null);
const [battleFactorBreakdown, setBattleFactorBreakdown] = useState<any>(null);
const [battleDamageModel, setBattleDamageModel] = useState<any>(null);
const [battleMissingData, setBattleMissingData] = useState<string[]>([]);
const [battleReasons, setBattleReasons] = useState<string[]>([]);
const [battleAnalyses, setBattleAnalyses] = useState<BattleAnalysisRow[]>([]);
  const [selectedBattleReportId, setSelectedBattleReportId] = useState<string>("");

  const [battleReports, setBattleReports] = useState<BattleReport[]>([]);
const [loadingBattleReports, setLoadingBattleReports] = useState(false);
const [selectedBattleReportFileId, setSelectedBattleReportFileId] = useState<string>("");
const [selectedBattleReportFile, setSelectedBattleReportFile] = useState<BattleReport | null>(null);
const [battleReportFileErr, setBattleReportFileErr] = useState<string | null>(null);
  const selectedBattleReportFileLabel = selectedBattleReportFile
  ? `Report #${selectedBattleReportFile.id.slice(0, 8)}`
  : "";

  const [heroesRoster, setHeroesRoster] = useState<HeroRosterListItem[]>([]);
  const [loadingHeroesRoster, setLoadingHeroesRoster] = useState(false);
  const [heroesRosterErr, setHeroesRosterErr] = useState<string | null>(null);

  const [optimizerMode, setOptimizerMode] = useState<OptimizerMode>("balanced");
  const [optimizerSquadCount, setOptimizerSquadCount] = useState(1);
  const [optimizerLockedHeroes, setOptimizerLockedHeroes] = useState<string[]>([]);
  const [optimizerBusy, setOptimizerBusy] = useState(false);
  const [optimizerErr, setOptimizerErr] = useState<string | null>(null);
  const [optimizerResult, setOptimizerResult] = useState<OptimizerResult | null>(null);

  const [optimizerQuestion, setOptimizerQuestion] = useState("");
  const [optimizerChatBusy, setOptimizerChatBusy] = useState(false);
  const [optimizerChatAnswer, setOptimizerChatAnswer] = useState("");

  const [optimizerSaveBusy, setOptimizerSaveBusy] = useState(false);
  const [optimizerSaveMsg, setOptimizerSaveMsg] = useState<string | null>(null);
  const [optimizerSavedFiles, setOptimizerSavedFiles] = useState<SavedOptimizerFile[]>([]);
  const [loadingOptimizerSavedFiles, setLoadingOptimizerSavedFiles] = useState(false);
  const [selectedOptimizerSavedId, setSelectedOptimizerSavedId] = useState<string>("");
  const [optimizerSavedDetail, setOptimizerSavedDetail] = useState<SavedOptimizerFile | null>(null);
  const [optimizerSavedErr, setOptimizerSavedErr] = useState<string | null>(null);

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

  const lockedHeroOptions = useMemo(() => {
    return [...heroesRoster].sort((a, b) => {
      const pa = Number(a.base_stats?.power || 0);
      const pb = Number(b.base_stats?.power || 0);
      return pb - pa || String(a.name).localeCompare(String(b.name));
    });
  }, [heroesRoster]);
  const optimizerSavedResult = useMemo(
    () => optimizerSavedDetail?.result ?? null,
    [optimizerSavedDetail]
  );
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
      if (!heroSubModalOpen && !selectedHeroUploadId && items[0]) {
  setSelectedHeroUploadId(items[0].id);
      }
    } finally {
      setLoadingHeroUploads(false);
    }
  }, [heroSubModalOpen, loadUploadsByKinds, selectedHeroUploadId]);

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

  const loadBattleReports = useCallback(async () => {
  setLoadingBattleReports(true);
  setBattleReportFileErr(null);

  try {
    const res = await fetch("/api/battle/reports", { cache: "no-store" });
    const data = await safeJson<BattleReportListResponse>(res);

    if (!res.ok || !data?.reports) {
      throw new Error(data?.error || "Failed to load saved battle reports");
    }

    setBattleReports(data.reports ?? []);
  } catch (e: any) {
    setBattleReportFileErr(e?.message ?? "Failed to load saved battle reports");
    setBattleReports([]);
  } finally {
    setLoadingBattleReports(false);
  }
}, []);

  const loadBattleReportDetail = useCallback(
  async (reportId: string) => {
    if (!reportId) {
      setSelectedBattleReportFile(null);
      return;
    }

    const found =
      battleReports.find((report) => String(report.id) === String(reportId)) ?? null;

    setSelectedBattleReportFile(found);
  },
  [battleReports]
);
    const loadHeroesRoster = useCallback(async () => {
    setLoadingHeroesRoster(true);
    setHeroesRosterErr(null);

        try {
      const res = await fetch("/api/heroes", { credentials: "include" });
      const json = await safeJson<{ ok?: boolean; heroes?: HeroRosterListItem[]; error?: string }>(res);

      if (!res.ok) {
        setHeroesRosterErr(json?.error ?? `Failed to load heroes (${res.status})`);
        return;
      }

      const heroes: HeroRosterListItem[] =
        json && Array.isArray(json.heroes) ? json.heroes : [];

      setHeroesRoster(heroes);
    } catch (e: any) {
      setHeroesRosterErr(e?.message ?? "Failed to load heroes");
    } finally {
      setLoadingHeroesRoster(false);
    }
  }, []);

    const loadOptimizerSavedFiles = useCallback(async () => {
    setLoadingOptimizerSavedFiles(true);
    setOptimizerSavedErr(null);
    try {
      const res = await fetch("/api/optimizer/saved?limit=100", {
        credentials: "include",
      });
      const json = await safeJson<SavedOptimizerListResponse>(res);

      if (!res.ok) {
        setOptimizerSavedErr(json?.error ?? `Failed to load saved optimizer files (${res.status})`);
        return;
      }

      const files: SavedOptimizerFile[] =
        json && Array.isArray(json.files) ? (json.files as SavedOptimizerFile[]) : [];

      setOptimizerSavedFiles(files);

      if (!selectedOptimizerSavedId && files[0]) {
        setSelectedOptimizerSavedId(String(files[0].id));
      }
    } catch (e: any) {
      setOptimizerSavedErr(e?.message ?? "Failed to load saved optimizer files");
    } finally {
      setLoadingOptimizerSavedFiles(false);
    }
  }, [selectedOptimizerSavedId]);

  const loadOptimizerSavedDetail = useCallback(async (savedId: string) => {
    if (!savedId) {
      setOptimizerSavedDetail(null);
      return;
    }

    setOptimizerSavedErr(null);

    try {
      const res = await fetch(`/api/optimizer/saved?saved_id=${encodeURIComponent(savedId)}`, {
        credentials: "include",
      });
      const json = await safeJson<SavedOptimizerDetailResponse>(res);

      if (!res.ok) {
        setOptimizerSavedErr(json?.error ?? `Failed to load saved optimizer file (${res.status})`);
        return;
      }

      const saved = json?.saved ?? null;
      setOptimizerSavedDetail(saved);
    } catch (e: any) {
      setOptimizerSavedErr(e?.message ?? "Failed to load saved optimizer file");
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
        body: JSON.stringify({ state: nextState }),
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
    setSavingPlayerState(true);
    setPlayerStateErr(null);
    setPlayerStateMsg(null);

    try {
      const res = await fetch("/api/player/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          op: "set_slot",
          squad: squadNumber,
          slot: heroSlotNumber,
          upload_id: heroUploadId,
        }),
      });

      const json = await safeJson<PlayerStateResponse>(res);

      if (!res.ok || !json?.ok) {
        setPlayerStateErr(json?.error ?? `Failed to save squads (${res.status})`);
        return;
      }

      setPlayerState(json.state ?? { squads: {} });
      setPlayerStateMsg("Squads saved ✅");
    } catch (e: any) {
      setPlayerStateErr(e?.message ?? "Failed to save squads");
    } finally {
      setSavingPlayerState(false);
    }
  },
  []
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
      await loadHeroesRoster();
    } catch (e: any) {
      setHeroProfileErr(e?.message ?? "Save failed");
    } finally {
      setHeroProfileSaving(false);
    }
  }, [heroProfile, loadHeroProfile, selectedHeroUploadId, loadHeroesRoster]);

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

      const analyses: BattleAnalysisRow[] =
        json && Array.isArray(json.analyses) ? (json.analyses as BattleAnalysisRow[]) : [];

      setBattleAnalyses(analyses);
      setBattleContextSummary(json?.context_summary ?? "");
      setBattleSummary(json?.summary ?? "");
      setBattleAnswer("");
      setBattleComparison(json?.comparison ?? null);
setBattleFactorBreakdown(json?.factor_breakdown ?? null);
setBattleDamageModel(json?.damage_model ?? null);
setBattleMissingData(Array.isArray(json?.missing_data) ? json?.missing_data : []);
setBattleReasons(Array.isArray(json?.reasons) ? json?.reasons : []);

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
      if (!selectedBattleReportFileId) {
        setBattleErr("Select a saved report file first.");
        return;
      }

      const res = await fetch(`/api/battle/analyze/${selectedBattleReportFileId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message:
            "Generate a simple battle report summary and include the full deterministic breakdown payload for Main Chat handoff.",
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
          filteredBattleAnalyses.filter((r) => String(r.id) === selectedBattleReportFileId),
          battleRange,
          json?.context_summary ?? battleContextSummary,
          battleCustomBegin,
          battleCustomFinish,
          selectedBattleReportFileLabel
        )
      );

      setBattleAnswer(json?.answer ?? "");
      setBattleContextSummary(json?.context_summary ?? battleContextSummary);
      setBattleComparison(json?.comparison ?? null);
      setBattleFactorBreakdown(json?.factor_breakdown ?? null);
      setBattleDamageModel(json?.damage_model ?? null);
      setBattleMissingData(Array.isArray(json?.missing_data) ? json.missing_data : []);
      setBattleReasons(Array.isArray(json?.reasons) ? json.reasons : []);
      return;
    }

    const res = await fetch("/api/battle/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        message:
          "Analyze all selected battle reports and include full deterministic breakdown payload for Main Chat.",
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
        selectedBattleReportFileLabel
      )
    );

    setBattleAnswer(json?.answer ?? "");
    setBattleContextSummary(json?.context_summary ?? battleContextSummary);
    setBattleComparison(json?.comparison ?? null);
    setBattleFactorBreakdown(json?.factor_breakdown ?? null);
    setBattleDamageModel(json?.damage_model ?? null);
    setBattleMissingData(Array.isArray(json?.missing_data) ? json.missing_data : []);
    setBattleReasons(Array.isArray(json?.reasons) ? json.reasons : []);
  } catch (e: any) {
    setBattleErr(e?.message ?? "Battle analyzer failed");
  } finally {
    setBattleBusy(false);
  }
}, [
  battleContextSummary,
  battleCustomBegin,
  battleCustomFinish,
  battleRange,
  filteredBattleAnalyses,
  selectedBattleReportFileLabel,
  selectedBattleReportFileId,
]);

  const runOptimizer = useCallback(async () => {
    setOptimizerBusy(true);
    setOptimizerErr(null);
    setOptimizerSaveMsg(null);
    setOptimizerChatAnswer("");

    try {
      const res = await fetch("/api/optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: optimizerMode,
          squad_count: optimizerSquadCount,
          locked_heroes: optimizerLockedHeroes,
        }),
      });

      const json = await safeJson<OptimizerRunResponse>(res);
      if (!res.ok) {
        setOptimizerErr(json?.error ?? `Optimizer failed (${res.status})`);
        return;
      }

      setOptimizerResult(json?.result ?? null);
    } catch (e: any) {
      setOptimizerErr(e?.message ?? "Optimizer failed");
    } finally {
      setOptimizerBusy(false);
    }
  }, [optimizerLockedHeroes, optimizerMode, optimizerSquadCount]);

  const askOptimizer = useCallback(async () => {
    if (!optimizerQuestion.trim()) {
      setOptimizerErr("Enter a question for the optimizer.");
      return;
    }

    if (!optimizerResult && !selectedOptimizerSavedId) {
      setOptimizerErr("Run or load an optimizer file first.");
      return;
    }

    setOptimizerChatBusy(true);
    setOptimizerErr(null);

    try {
      const res = await fetch("/api/optimizer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          selectedOptimizerSavedId && !optimizerResult
            ? {
                question: optimizerQuestion,
                saved_optimizer_id: Number(selectedOptimizerSavedId),
              }
            : {
                question: optimizerQuestion,
                optimizer_result: optimizerResult,
              }
        ),
      });

      const json = await safeJson<{ ok?: boolean; answer?: string; error?: string }>(res);
      if (!res.ok) {
        setOptimizerErr(json?.error ?? `Optimizer chat failed (${res.status})`);
        return;
      }

      setOptimizerChatAnswer(String(json?.answer ?? ""));
    } catch (e: any) {
      setOptimizerErr(e?.message ?? "Optimizer chat failed");
    } finally {
      setOptimizerChatBusy(false);
    }
  }, [optimizerQuestion, optimizerResult, selectedOptimizerSavedId]);

  const saveOptimizerResult = useCallback(async () => {
    if (!optimizerResult) {
      setOptimizerErr("Run the optimizer first.");
      return;
    }

    const label = window.prompt("Name this optimizer file:", "");
    if (!label || !label.trim()) return;

    setOptimizerSaveBusy(true);
    setOptimizerErr(null);
    setOptimizerSaveMsg(null);

    try {
      const res = await fetch("/api/optimizer/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: label.trim(),
          mode: optimizerResult.mode,
          squad_count: optimizerResult.squad_count,
          locked_heroes: optimizerResult.locked_heroes,
          result: optimizerResult,
        }),
      });

      const json = await safeJson<SavedOptimizerDetailResponse>(res);
      if (!res.ok) {
        setOptimizerErr(json?.error ?? `Failed to save optimizer file (${res.status})`);
        return;
      }

      setOptimizerSaveMsg(`Optimizer file saved: ${label.trim()}`);
      await loadOptimizerSavedFiles();
    } catch (e: any) {
      setOptimizerErr(e?.message ?? "Failed to save optimizer file");
    } finally {
      setOptimizerSaveBusy(false);
    }
  }, [optimizerResult, loadOptimizerSavedFiles]);

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
      }

      let extraMsg = "";

if (isBattleUploadKind(uploadKind)) {
  extraMsg = " Battle report file saved.";
}
      setUploadMsg(`Uploaded ${uploadFiles.length} screenshot${uploadFiles.length === 1 ? "" : "s"} ✅${extraMsg}`);
      setUploadFiles([]);

      if (apiKind === "hero_profile" || apiKind === "hero_skills" || apiKind === "gear") {
        await loadHeroUploads();
        await loadHeroesRoster();
      }
      if (apiKind === "drone") {
        await loadDroneUploads();
      }
      if (apiKind === "overlord") {
        await loadOverlordUploads();
      }
      if (apiKind === "battle_report") {
  await loadBattleUploads();
  await loadBattleReports();
  await loadBattleAnalyzerData();
      }
    } catch (e: any) {
      setUploadErr(e?.message ?? "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }, [
    loadBattleAnalyzerData,
    loadBattleReports,
    loadBattleUploads,
    loadDroneUploads,
    loadHeroUploads,
    loadHeroesRoster,
    loadOverlordUploads,
    uploadFiles,
    uploadKind,
  ]);

  useEffect(() => {
    void loadHeroUploads();
    void loadDroneUploads();
    void loadOverlordUploads();
    void loadBattleUploads();
    void loadBattleReports();
    void loadHeroesRoster();
    void loadOptimizerSavedFiles();
    void loadPlayerState();
  }, [
    loadBattleReports,
    loadBattleUploads,
    loadDroneUploads,
    loadHeroUploads,
    loadHeroesRoster,
    loadOptimizerSavedFiles,
    loadOverlordUploads,
    loadPlayerState,
  ]);

  useEffect(() => {
    if (heroSubModalOpen) {
      void loadHeroProfile(selectedHeroUploadId);
    }
  }, [heroSubModalOpen, loadHeroProfile, selectedHeroUploadId]);

  useEffect(() => {
  if (battleOpen) {
    void loadBattleAnalyzerData();
    void loadBattleReports();
  }
}, [battleOpen, loadBattleAnalyzerData, loadBattleReports]);
  useEffect(() => {
    if (optimizerOpen) {
      void loadHeroesRoster();
      void loadOptimizerSavedFiles();
    }
  }, [optimizerOpen, loadHeroesRoster, loadOptimizerSavedFiles]);

    useEffect(() => {
  if (selectedBattleReportFileId) {
    void loadBattleReportDetail(selectedBattleReportFileId);
  } else {
    setSelectedBattleReportFile(null);
  }
}, [loadBattleReportDetail, selectedBattleReportFileId]);

  useEffect(() => {
    if (selectedOptimizerSavedId) {
      void loadOptimizerSavedDetail(selectedOptimizerSavedId);
    } else {
      setOptimizerSavedDetail(null);
    }
  }, [loadOptimizerSavedDetail, selectedOptimizerSavedId]);

  const handleLogout = useCallback(async () => {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {}

  window.location.href = "/login";
}, []);
  return (
    <main className="min-h-screen bg-[#060b14] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-b from-[#101828] to-[#0a1020] p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-white md:text-4xl">SquadAssistant</div>
              <div className="mt-2 max-w-3xl text-sm text-white/55 md:text-base">
                Home launcher for uploads, heroes, squads, hero profile submodal, drone, overlord, battle report analyzer, and optimizer.
              </div>
            </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <button
            onClick={() => void handleLogout()}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Logout
          </button>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
            <AppCard title="Upload" subtitle="Add and review screenshots" onClick={() => setUploadOpen(true)} />
            <AppCard title="Heroes" subtitle="Full owned roster" onClick={() => setHeroesOpen(true)} />
            <AppCard title="Squads" subtitle="Assign heroes and open profiles" onClick={() => setSquadsOpen(true)} />
            <AppCard title="Drone" subtitle="Overview, components, boost, chips" onClick={() => setDroneOpen(true)} />
            <AppCard title="Overlord" subtitle="Profile, skills, bond, train" onClick={() => setOverlordOpen(true)} />
            <AppCard title="Battle Reports" subtitle="Analyze report data" onClick={() => setBattleOpen(true)} />
            <AppCard title="Optimizer" subtitle="Best squad spread builder" onClick={() => setOptimizerOpen(true)} />
          </div>
        </div>
      </div>
    </div>
  </div>

    <MainChat
  injectedMessage={mainChatTransfer}
  onInjectedMessageConsumed={() => setMainChatTransfer(null)}
/>

      <HeroesModal
        open={heroesOpen}
        onClose={() => setHeroesOpen(false)}
        onOpenHero={(uploadId) => {
          if (!uploadId) return;
          setSelectedHeroUploadId(uploadId);
          setHeroSubModalTab("profile");
          setHeroSubModalOpen(true);
        }}
      />

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
  subtitle={loadingBattleReports ? "Loading…" : `${battleReports.length} items`}
>
  <div className="grid gap-3">
    {battleReports.map((report) => (
      <div key={report.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="text-sm font-medium text-white">Report #{report.id.slice(0, 8)}</div>
        <div className="mt-1 text-xs text-white/45">
          {report.battle_report_pages?.length ?? 0} page{(report.battle_report_pages?.length ?? 0) === 1 ? "" : "s"} • {fmtDate(report.created_at)}
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
                          <img src={upload.url} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-white/35">No hero</div>
                        )}
                      </div>

                      <div className="mt-3 grid max-h-48 grid-cols-3 gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-2">
  {heroUploads.map((hero) => (
    <button
      key={hero.id}
      type="button"
      onClick={() =>
  void updateSquadHeroSlot(group.squad, slot, hero.id)
}
className={`overflow-hidden rounded-xl border ${
        upload?.id === hero.id
          ? "border-emerald-400 bg-emerald-500/15"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="h-20 overflow-hidden bg-black/30">
        {hero.url ? (
          <img
            src={hero.url}
            alt=""
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/40">
            No image
          </div>
        )}
      </div>

      <div className="truncate px-2 py-1 text-xs text-white/80">
        Hero #{hero.id}
      </div>
    </button>
  ))}
</div>

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
                    <img src={heroProfileImageUrl} alt="" className="max-h-[70vh] w-full object-contain bg-black/30" />
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
                      <img src={selectedDroneUpload.url} alt="" className="max-h-[70vh] w-full object-contain bg-black/30" />
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
                      <DroneCombatBoostEditor selectedUploadId={selectedDroneUploadId} />
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
                      <img src={selectedOverlordUpload.url} alt="" className="max-h-[70vh] w-full object-contain bg-black/30" />
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
          {battleReportFileErr ? (
  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{battleReportFileErr}</div>
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
  <div className="mt-4">
    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Saved Report File</div>
    <select
      value={selectedBattleReportFileId}
      onChange={(e) => setSelectedBattleReportFileId(e.target.value)}
      className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
    >
      <option value="">— Select report file —</option>
      {battleReports.map((report) => (
        <option key={report.id} value={String(report.id)}>
          Report #{report.id.slice(0, 8)} • {report.battle_report_pages?.length ?? 0} page{(report.battle_report_pages?.length ?? 0) === 1 ? "" : "s"} • {fmtDate(report.created_at)}
        </option>
      ))}
    </select>
  </div>
) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  void loadBattleReports();
                  void loadBattleAnalyzerData();
                }}
                disabled={battleBusy || loadingBattleReports}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
              >
                {battleBusy || loadingBattleReports ? "Loading…" : "Reload Reports"}
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
    subtitle={`${battleReports.length} file${battleReports.length === 1 ? "" : "s"} saved`}
  >
    <div className="space-y-4">
      <div className="grid gap-3">
        {battleReports.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedBattleReportFileId(String(report.id))}
            className={cx(
              "rounded-2xl border p-3 text-left",
              String(report.id) === selectedBattleReportFileId
                ? "border-emerald-400/30 bg-emerald-500/10"
                : "border-white/10 bg-black/20"
            )}
          >
            <div className="text-sm font-medium text-white">Report #{report.id.slice(0, 8)}</div>
            <div className="mt-1 text-xs text-white/45">
              {report.battle_report_pages?.length ?? 0} page{(report.battle_report_pages?.length ?? 0) === 1 ? "" : "s"} • {fmtDate(report.created_at)}
            </div>
          </button>
        ))}

        {!battleReports.length ? (
          <div className="text-sm text-white/50">No saved report files yet.</div>
        ) : null}
      </div>
    </div>
  </SectionCard>

            <SectionCard title="Analysis Output" subtitle={battleContextSummary || "Run the analyzer to load current context"}>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
  <div className="text-xs uppercase tracking-[0.25em] text-white/45">
    Yours vs Theirs
  </div>

  {battleComparison ? (
    <div className="mt-3 grid gap-3 text-sm text-white/75 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="font-semibold text-white">Yours</div>
        <div className="mt-2">Power: {battleComparison?.yours?.visible_power?.toLocaleString?.() ?? "Unknown"}</div>
        <div>Hero Power: {battleComparison?.yours?.saved_hero_power?.toLocaleString?.() ?? "Unknown"}</div>
        <div>Attack: {battleComparison?.yours?.attack?.toLocaleString?.() ?? "Unknown"}</div>
        <div>HP: {battleComparison?.yours?.hp?.toLocaleString?.() ?? "Unknown"}</div>
        <div>Defense: {battleComparison?.yours?.defense?.toLocaleString?.() ?? "Unknown"}</div>
        <div>March Size: {battleComparison?.yours?.march_size?.toLocaleString?.() ?? "Unknown"}</div>
        <div>Final Effective Value: {battleComparison?.yours?.final_effective_value?.toLocaleString?.() ?? "Unknown"}</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="font-semibold text-white">Theirs</div>
        <div>Power: {battleComparison?.theirs?.visible_power?.toLocaleString?.() ?? "Unknown"}</div>
        <div>Hero Power: {battleComparison?.theirs?.hero_power?.toLocaleString?.() ?? "Unknown"}</div>
        <div>Attack: {battleComparison?.theirs?.attack?.toLocaleString?.() ?? "Unknown"}</div>
        <div>HP: {battleComparison?.theirs?.hp?.toLocaleString?.() ?? "Unknown"}</div>
        <div>Defense: {battleComparison?.theirs?.defense?.toLocaleString?.() ?? "Unknown"}</div>
        <div>March Size: {battleComparison?.theirs?.march_size?.toLocaleString?.() ?? "Unknown"}</div>
        <div>Final Effective Estimate: {battleComparison?.theirs?.final_effective_value_estimate?.toLocaleString?.() ?? "Unknown"}</div>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 md:col-span-2">
        <div className="font-semibold text-emerald-100">Your Advantages</div>
        <pre className="mt-2 whitespace-pre-wrap text-sm text-emerald-100/80">
          {(battleComparison?.advantages?.length
            ? battleComparison.advantages
            : ["None clearly detected."]).join("\n")}
        </pre>
      </div>

      <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 md:col-span-2">
        <div className="font-semibold text-red-100">Enemy Advantages / Your Disadvantages</div>
        <pre className="mt-2 whitespace-pre-wrap text-sm text-red-100/80">
          {(battleComparison?.disadvantages?.length
            ? battleComparison.disadvantages
            : ["None clearly detected."]).join("\n")}
        </pre>
      </div>
    </div>
  ) : (
    <div className="mt-3 text-sm text-white/50">
      Run the analyzer to generate yours-vs-theirs comparison.
    </div>
  )}
</div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Detailed Analysis</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
  <div className="text-xs uppercase tracking-[0.25em] text-white/45">
    Detailed Analysis
  </div>

  <pre className="mt-3 whitespace-pre-wrap text-sm text-white/80">
    {battleAnswer || "No detailed analysis yet."}
  </pre>

  <button
    type="button"
    disabled={!battleSummary && !battleAnswer}
    onClick={() => {
      const payload = {
  summary: battleSummary,
  analysis: battleAnswer,
  context_summary: battleContextSummary,
  comparison: battleComparison,
  factor_breakdown: battleFactorBreakdown,
  damage_model: battleDamageModel,
  reasons: battleReasons,
  missing_data: battleMissingData,
  analyses: battleAnalyses,
};

      setMainChatTransfer(
        `Battle Analyzer Handoff:\n\n${JSON.stringify(payload, null, 2)}`
      );

      setBattleOpen(false);
    }}
    className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 disabled:opacity-40"
  >
    Transfer to Main Chat
  </button>
</div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Optimizer"
        subtitle="Build the best legal squad spread from your full owned roster, then save and chat about the result."
        onClose={() => setOptimizerOpen(false)}
        open={optimizerOpen}
        wide
      >
        <div className="space-y-6">
          {optimizerErr ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{optimizerErr}</div>
          ) : null}
          {optimizerSavedErr ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{optimizerSavedErr}</div>
          ) : null}
          {optimizerSaveMsg ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{optimizerSaveMsg}</div>
          ) : null}
          {heroesRosterErr ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{heroesRosterErr}</div>
          ) : null}

          <SectionCard title="Optimizer Controls" subtitle="Choose your optimization style, squad count, and optional locked heroes">
            <div className="grid gap-4 xl:grid-cols-[260px_180px_1fr]">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Mode</div>
                <select
                  value={optimizerMode}
                  onChange={(e) => setOptimizerMode(e.target.value as OptimizerMode)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                >
                  {OPTIMIZER_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Squads</div>
                <select
                  value={optimizerSquadCount}
                  onChange={(e) => setOptimizerSquadCount(Number(e.target.value))}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                >
                  <option value={1}>1 Squad</option>
                  <option value={2}>2 Squads</option>
                  <option value={3}>3 Squads</option>
                  <option value={4}>4 Squads</option>
                </select>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Lock Specific Heroes</div>
                <select
                  multiple
                  value={optimizerLockedHeroes}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                    setOptimizerLockedHeroes(values);
                  }}
                  className="mt-2 min-h-[120px] w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                >
                  {lockedHeroOptions.map((hero) => (
                    <option key={hero.hero_key} value={hero.hero_key}>
                      {hero.name} • {hero.troop_type} • Power {hero.base_stats?.power || 0}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-white/45">
                  Locked heroes stay in the optimization pool and are forced into the output if legal.
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void runOptimizer()}
                disabled={optimizerBusy || loadingHeroesRoster}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 disabled:opacity-40"
              >
                {optimizerBusy ? "Optimizing…" : "Run Optimizer"}
              </button>

              <button
                onClick={() => void saveOptimizerResult()}
                disabled={optimizerSaveBusy || !optimizerResult}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
              >
                {optimizerSaveBusy ? "Saving…" : "Save Optimizer File"}
              </button>

              <button
                onClick={() => {
                  setOptimizerLockedHeroes([]);
                  setOptimizerResult(null);
                  setOptimizerChatAnswer("");
                  setOptimizerErr(null);
                  setOptimizerSaveMsg(null);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
              >
                Clear Current Result
              </button>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
            <OptimizerSavedRunsPanel
              files={optimizerSavedFiles}
              loading={loadingOptimizerSavedFiles}
              selectedId={selectedOptimizerSavedId}
                            onSelect={(id: string) => {
                setSelectedOptimizerSavedId(id);
                setOptimizerResult(null);
                setOptimizerChatAnswer("");
              }}
            />

            <SectionCard title="Optimizer Output" subtitle="Live result or loaded saved optimizer file">
              {!optimizerResult && !optimizerSavedDetail ? (
                <div className="text-sm text-white/50">Run the optimizer or select a saved optimizer file.</div>
              ) : null}

              {optimizerResult ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Summary</div>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-white/80">
                      {(optimizerResult.summary || []).join("\n")}
                      {optimizerResult.assumptions?.length ? `\n\nAssumptions:\n${optimizerResult.assumptions.join("\n")}` : ""}
                    </pre>
                  </div>

                  {optimizerResult.squads.map((squad) => (
                    <div key={squad.squad_number} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="text-lg font-semibold text-white">Squad {squad.squad_number}</div>
                      <div className="mt-2 grid gap-2 text-sm text-white/75 md:grid-cols-4">
                        <div>Total: {Math.round(squad.scores.total)}</div>
                        <div>Offence: {Math.round(squad.scores.offence)}</div>
                        <div>Defense: {Math.round(squad.scores.defense)}</div>
                        <div>Sustain: {Math.round(squad.scores.sustain)}</div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        {squad.placements.map((p) => {
                          const hero = squad.heroes.find((h) => h.hero_key === p.hero_key);
                          return (
                            <div key={`${squad.squad_number}-${p.slot}-${p.hero_key}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Slot {p.slot}</div>
                              <div className="mt-2 text-sm font-medium text-white">{p.hero_name}</div>
                              <div className="mt-1 text-xs text-white/50">{p.assigned_role}</div>
                              <div className="mt-2 text-xs text-white/65">
                                {hero ? `Lv ${hero.level} • ${hero.troop_type}` : p.troop_type}
                              </div>
                              <div className="mt-2 text-xs text-white/60">{p.score_note}</div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-sm font-medium text-white">Gear Assignment</div>
                          <div className="mt-3 grid gap-2">
                            {squad.gear_assignments.map((g, idx) => (
                              <div key={`${g.hero_key}-${g.slot}-${idx}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <div className="text-sm text-white">
                                  {g.hero_key} • {g.slot}
                                </div>
                                <div className="mt-1 text-xs text-white/50">
                                  {g.piece ? `${g.piece.name ?? "Gear"} • Lv ${g.piece.level} • ${g.piece.stars}★` : "No piece assigned"}
                                </div>
                                <div className="mt-2 text-xs text-white/60">{g.reason}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-sm font-medium text-white">Why This Squad</div>
                          <pre className="mt-3 whitespace-pre-wrap text-sm text-white/75">
                            {(squad.explanation || []).join("\n")}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}

                  {optimizerResult.unused_heroes?.length ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-sm font-medium text-white">Unused Heroes</div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {optimizerResult.unused_heroes.map((u) => (
                          <div key={u.hero_key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="text-sm text-white">{u.name}</div>
                            <div className="mt-1 text-xs text-white/55">{u.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

                            {!optimizerResult && optimizerSavedDetail && optimizerSavedResult ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Loaded Saved File</div>
                    <div className="mt-2 text-sm text-white">
                      {optimizerSavedDetail.label} • {optimizerSavedDetail.mode} • {optimizerSavedDetail.squad_count} squad
                      {optimizerSavedDetail.squad_count === 1 ? "" : "s"}
                    </div>
                    <div className="mt-1 text-xs text-white/45">{fmtDate(optimizerSavedDetail.created_at)}</div>
                    {optimizerSavedDetail.note ? <div className="mt-2 text-xs text-white/60">{optimizerSavedDetail.note}</div> : null}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Saved Result Summary</div>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-white/80">
                      {(optimizerSavedResult.summary || []).join("\n")}
                      {optimizerSavedResult.assumptions?.length
                        ? `\n\nAssumptions:\n${optimizerSavedResult.assumptions.join("\n")}`
                        : ""}
                    </pre>
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </div>

          <SectionCard title="Optimizer Chat" subtitle="Ask why the optimizer chose this layout, placement, or gear assignment">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <input
                value={optimizerQuestion}
                onChange={(e) => setOptimizerQuestion(e.target.value)}
                placeholder='ex: Why is this hero in slot 1? Why did you assign that radar there?'
                className="w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
              />
              <button
                onClick={() => void askOptimizer()}
                disabled={optimizerChatBusy || (!optimizerResult && !selectedOptimizerSavedId)}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 disabled:opacity-40"
              >
                {optimizerChatBusy ? "Thinking…" : "Ask Optimizer"}
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Explanation</div>
              <pre className="mt-3 whitespace-pre-wrap text-sm text-white/80">
                {optimizerChatAnswer || "No optimizer explanation yet."}
              </pre>
            </div>
          </SectionCard>
        </div>
      </ModalShell>
    </main>
  );
}
