"use client";

import React, { useMemo, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { DroneComponentsEditor } from "@/components/drone/DroneComponentsEditor";
import { DroneCombatBoostEditor } from "@/components/drone/DroneCombatBoostEditor";

type SquadSlot = 1 | 2 | 3 | 4;
type HeroSlotIndex = 1 | 2 | 3 | 4 | 5;

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
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
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-white/50">
              {title.toUpperCase()}
            </div>
            {subtitle ? <div className="mt-1 text-sm text-white/70">{subtitle}</div> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="max-h-[78vh] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function BottomButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] uppercase tracking-[0.25em] text-white/75 hover:bg-white/10"
    >
      {label}
    </button>
  );
}

/**
 * Backend allowed kinds (current):
 * battle_report | hero_profile | drone | overlord | gear | unknown
 * We map hero_skills to hero_profile for now.
 */
type UploadUIKind =
  | "battle_report"
  | "hero_profile"
  | "hero_skills"
  | "gear"
  | "drone"
  | "overlord";

type UploadResult = { fileName: string; ok: boolean; message: string };

type HeroUpload = {
  id: number;
  url: string | null;
  created_at?: string;
  storage_path?: string;
};

type PlayerStateResponse = {
  ok: boolean;
  state?: any;
  error?: string;
};

function normalizeSlotsFromState(state: any): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const squads = state?.squads ?? {};
  for (const s of ["1", "2", "3", "4"]) {
    const slots = squads?.[s]?.slots ?? {};
    for (const k of ["1", "2", "3", "4", "5"]) {
      const v = slots?.[k];
      out[`${s}-${k}`] = typeof v === "number" && Number.isFinite(v) ? v : null;
    }
  }
  return out;
}

function SquadGrid({
  squad,
  slots,
  heroUploads,
  selectedSlot,
  setSelectedSlot,
  onAssign,
  onClear,
  onOpenHeroDetails,
}: {
  squad: SquadSlot;
  slots: Record<string, number | null>;
  heroUploads: HeroUpload[];
  selectedSlot: { squad: number; slot: number } | null;
  setSelectedSlot: (v: { squad: number; slot: number } | null) => void;
  onAssign: (squad: SquadSlot, slot: HeroSlotIndex, uploadId: number) => Promise<void>;
  onClear: (squad: SquadSlot, slot: HeroSlotIndex) => Promise<void>;
  onOpenHeroDetails: (uploadId: number) => Promise<void>;
}) {
  const selectedThisSquad = selectedSlot?.squad === squad ? (selectedSlot.slot as HeroSlotIndex) : null;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Squad {squad}</div>
          <div className="mt-1 text-sm text-white/70">Tap a slot, then tap a hero below.</div>
        </div>

        <button
          type="button"
          onClick={async () => {
            if (!selectedSlot || selectedSlot.squad !== squad) return;
            const key = `${squad}-${selectedSlot.slot}`;
            const uploadId = slots[key];
            if (!uploadId) return;
            await onOpenHeroDetails(uploadId);
          }}
          disabled={!selectedThisSquad || !slots[`${squad}-${selectedThisSquad}`]}
          className={cn(
            "rounded-2xl border border-white/10 bg-white/5 px-3 py-2",
            "text-[10px] uppercase tracking-[0.25em] text-white/70 hover:bg-white/10",
            (!selectedThisSquad || !slots[`${squad}-${selectedThisSquad}`]) &&
              "opacity-50 cursor-not-allowed"
          )}
          title="Open details for the hero assigned to the selected slot"
        >
          Open Hero Details
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((sl) => {
          const slot = sl as HeroSlotIndex;
          const key = `${squad}-${slot}`;
          const val = slots[key] ?? null;
          const isSelected = selectedSlot?.squad === squad && selectedSlot?.slot === slot;
          return (
            <button
              key={key}
              type="button"
              className={cn(
                "rounded-2xl border px-3 py-3 text-left",
                isSelected
                  ? "border-fuchsia-300/40 bg-fuchsia-950/20"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              )}
              onClick={() => setSelectedSlot({ squad, slot })}
            >
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">Slot {slot}</div>
              <div className="mt-1 text-xs text-white/75">{val ? `Upload #${val}` : "Empty"}</div>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-white/70 hover:bg-white/10",
                    !val && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onClear(squad, slot);
                  }}
                  disabled={!val}
                >
                  Clear
                </button>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-xs uppercase tracking-[0.25em] text-white/45">Hero profiles</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {heroUploads.map((u) => (
            <button
              key={u.id}
              type="button"
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
              onClick={() => {
                if (!selectedThisSquad) return;
                void onAssign(squad, selectedThisSquad, u.id);
              }}
              title={u.storage_path ?? ""}
            >
              #{u.id}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
        <div>
          Selected slot:{" "}
          <span className="text-white/80">
            {selectedThisSquad ? `slot ${selectedThisSquad}` : "none"}
          </span>
          <span className="ml-2 text-white/40">(Pick a slot, then pick a hero.)</span>
        </div>

        <button
          type="button"
          onClick={async () => {
            if (!selectedSlot || selectedSlot.squad !== squad) return;
            const key = `${squad}-${selectedSlot.slot}`;
            const uploadId = slots[key];
            if (!uploadId) return;
            await onOpenHeroDetails(uploadId);
          }}
          disabled={!selectedThisSquad || !slots[`${squad}-${selectedThisSquad}`]}
          className={cn(
            "rounded-2xl border border-white/10 bg-white/5 px-3 py-2",
            "text-[10px] uppercase tracking-[0.25em] text-white/70 hover:bg-white/10",
            (!selectedThisSquad || !slots[`${squad}-${selectedThisSquad}`]) &&
              "opacity-50 cursor-not-allowed"
          )}
          title="Open details for the hero assigned to the selected slot"
        >
          Open Hero Details
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);

  const [droneTab, setDroneTab] = useState<"overview" | "components" | "combat_boost" | "chips">("overview");
  const [droneUploads, setDroneUploads] = useState<any[]>([]);
  const [droneBusy, setDroneBusy] = useState(false);
  const [droneMsg, setDroneMsg] = useState<string | null>(null);
  const [selectedDroneUploadId, setSelectedDroneUploadId] = useState<number | null>(null);
  const [selectedDroneImageUrl, setSelectedDroneImageUrl] = useState<string | null>(null);
  const [droneOwnerId, setDroneOwnerId] = useState<string | null>(null);

  const [overlordOpen, setOverlordOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [heroDetailsOpen, setHeroDetailsOpen] = useState(false);

  // Analyzer output + chat input
  const [battleOut, setBattleOut] = useState<string>("");
  const [battleBusy, setBattleBusy] = useState(false);
  const [battleMsg, setBattleMsg] = useState<string>("");

  // Upload state
  const [uploadKind, setUploadKind] = useState<UploadUIKind>("battle_report");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  // Squads wiring
  const [squadsBusy, setSquadsBusy] = useState(false);
  const [squadsMsg, setSquadsMsg] = useState<string | null>(null);
  const [heroUploads, setHeroUploads] = useState<HeroUpload[]>([]);
  const [slots, setSlots] = useState<Record<string, number | null>>({});
  const [selectedSlot, setSelectedSlot] = useState<{ squad: number; slot: number } | null>(null);

  // Hero details wiring
  const [heroDetailsUploadId, setHeroDetailsUploadId] = useState<number | null>(null);
  const [heroDetailsBusy, setHeroDetailsBusy] = useState(false);
  const [heroExtractBusy, setHeroExtractBusy] = useState(false);
  const [heroExtractMsg, setHeroExtractMsg] = useState<string | null>(null);
  const [heroDetailsErr, setHeroDetailsErr] = useState<string | null>(null);
  const [heroDetailsImg, setHeroDetailsImg] = useState<string | null>(null);
  const [heroDetailsFacts, setHeroDetailsFacts] = useState<any | null>(null);

  // Editable hero fields (manual override)
  const [heroName, setHeroName] = useState("");
  const [heroLevel, setHeroLevel] = useState("");
  const [heroStars, setHeroStars] = useState("");
  const [heroPower, setHeroPower] = useState("");

  const kindLabel = useMemo(() => {
    switch (uploadKind) {
      case "battle_report":
        return "Battle report";
      case "hero_profile":
        return "Hero profile";
      case "hero_skills":
        return "Hero skills";
      case "gear":
        return "Gear";
      case "drone":
        return "Drone";
      case "overlord":
        return "Overlord";
      default:
        return "Upload";
    }
  }, [uploadKind]);

  function mapToBackendKind(k: UploadUIKind) {
    if (k === "hero_skills") return "hero_profile";
    return k;
  }

  async function safeReadResponse(res: Response): Promise<{ json?: any; text?: string }> {
    const ct = res.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) return { json: await res.json() };
    } catch {}
    try {
      const t = await res.text();
      if (t?.startsWith("<!DOCTYPE html")) {
        return { text: "HTML response received (likely 404 route missing or wrong path)." };
      }
      return { text: t };
    } catch {
      return { text: "" };
    }
  }

  async function uploadSingle(file: File, uiKind: UploadUIKind) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", mapToBackendKind(uiKind));

    const res = await fetch("/api/uploads/image", {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    const payload = await safeReadResponse(res);

    if (!res.ok) {
      const serverMsg = payload.json?.error ?? payload.json?.message ?? payload.text?.slice(0, 180) ?? "";
      const msgBase = serverMsg && typeof serverMsg === "string" ? serverMsg : "Upload failed.";
      return { ok: false, message: `${msgBase} (HTTP ${res.status})` };
    }

    const rid = payload.json?.reportId ?? payload.json?.id ?? payload.json?.uploadId ?? null;
    return { ok: true, message: rid ? `Uploaded ✅ id=${rid}` : "Uploaded ✅" };
  }

  async function handleUploadFiles(files: FileList | null) {
    setUploadMsg(null);
    setUploadResults([]);
    setUploadProgress(null);

    if (!files || files.length === 0) return;

    const arr = Array.from(files);

    if (arr.length > 20) {
      setUploadMsg("Please select 20 images or fewer.");
      return;
    }

    const nonImages = arr.filter((f) => !f.type.startsWith("image/"));
    if (nonImages.length > 0) {
      setUploadMsg("Only image files are supported.");
      return;
    }

    setUploadBusy(true);

    try {
      setUploadProgress({ current: 0, total: arr.length });

      const results: UploadResult[] = [];

      for (let i = 0; i < arr.length; i++) {
        setUploadProgress({ current: i + 1, total: arr.length });

        const file = arr[i];
        const r = await uploadSingle(file, uploadKind);

        results.push({ fileName: file.name, ok: r.ok, message: r.message });
        setUploadResults([...results]);
      }

      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.length - okCount;

      setUploadMsg(
        failCount === 0
          ? `Done ✅ Uploaded ${okCount}/${results.length} (${kindLabel}).`
          : `Done ⚠️ Uploaded ${okCount}/${results.length} (${kindLabel}). Failed: ${failCount}.`
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setUploadMsg(`Upload failed: ${msg}`);
    } finally {
      setUploadBusy(false);
      setUploadProgress(null);
    }
  }

  async function runBattleSummary() {
    setBattleBusy(true);
    try {
      const res = await fetch("/api/battle/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: 200 }),
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const msg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setBattleOut(`Error: ${String(msg)}`);
        return;
      }

      const summary = String(payload.json?.summary ?? "");
      setBattleOut(summary || "No summary returned.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      setBattleOut(`Error: ${msg}`);
    } finally {
      setBattleBusy(false);
    }
  }

  async function askBattleAnalyzer() {
    const msg = battleMsg.trim();
    if (!msg) return;

    setBattleBusy(true);
    try {
      const res = await fetch("/api/battle/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: 200, message: msg }),
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const m = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setBattleOut((prev) => `${prev}\n\n---\n\nAsk failed: ${String(m)}`);
        return;
      }

      const answer = String(payload.json?.answer ?? payload.json?.summary ?? "");
      setBattleOut((prev) => {
        const parts = [prev].filter(Boolean);
        parts.push(`Question:\n${msg}`);
        parts.push(`Answer:\n${answer}`);
        return parts.join("\n\n---\n\n");
      });

      setBattleMsg("");
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "unknown";
      setBattleOut((prev) => `${prev}\n\n---\n\nAsk failed: ${m}`);
    } finally {
      setBattleBusy(false);
    }
  }

  async function loadSquadsAndUploads() {
    setSquadsBusy(true);
    setSquadsMsg(null);
    try {
      const [stateRes, uploadsRes] = await Promise.all([
        fetch("/api/player/state", { credentials: "include" }),
        fetch("/api/uploads/list?kind=hero_profile&limit=120", { credentials: "include" }),
      ]);

      const statePayload = (await stateRes.json().catch(() => null)) as PlayerStateResponse | null;
      const uploadsPayload = (await uploadsRes.json().catch(() => null)) as
        | { ok?: boolean; uploads?: HeroUpload[]; error?: string }
        | null;

      if (!stateRes.ok || !statePayload?.ok) {
        setSquadsMsg(`State load failed: ${statePayload?.error ?? `HTTP ${stateRes.status}`}`);
      } else {
        setSlots(normalizeSlotsFromState(statePayload.state ?? {}));
      }

      if (!uploadsRes.ok || !uploadsPayload?.ok) {
        setSquadsMsg((prev) => prev ?? `Hero uploads load failed: ${uploadsPayload?.error ?? `HTTP ${uploadsRes.status}`}`);
        setHeroUploads([]);
      } else {
        setHeroUploads(uploadsPayload.uploads ?? []);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      setSquadsMsg(`Load failed: ${msg}`);
    } finally {
      setSquadsBusy(false);
    }
  }

  async function loadDroneUploads() {
    setDroneBusy(true);
    setDroneMsg(null);
    try {
      const res = await fetch("/api/uploads/list?kind=drone&limit=200", { credentials: "include" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setDroneUploads([]);
        setDroneMsg(json?.error ?? `Drone uploads load failed (HTTP ${res.status})`);
        return;
      }

      const uploads = Array.isArray(json.uploads) ? json.uploads : [];
      setDroneUploads(uploads);

      if (selectedDroneUploadId) {
        const match = uploads.find((u: any) => u.id === selectedDroneUploadId);
        if (!match) {
          setSelectedDroneUploadId(null);
          setSelectedDroneImageUrl(null);
          setDroneOwnerId(null);
        } else {
          await selectDroneUpload(match.id, match);
        }
      }
    } catch (e: any) {
      setDroneMsg(e?.message ?? "Drone uploads load failed");
      setDroneUploads([]);
    } finally {
      setDroneBusy(false);
    }
  }

  function ownerIdFromStoragePath(path?: string | null): string | null {
    if (!path) return null;
    const first = String(path).split("/")[0];
    return first && first.length >= 8 ? first : null;
  }

  async function selectDroneUpload(uploadId: number, row?: any) {
    setSelectedDroneUploadId(uploadId);

    const r = row ?? droneUploads.find((u: any) => u.id === uploadId);
    const owner =
      ownerIdFromStoragePath(r?.storage_path) ??
      ownerIdFromStoragePath(r?.storagePath) ??
      null;
    setDroneOwnerId(owner);

    const url = r?.url ?? r?.public_url ?? r?.publicUrl ?? null;
    if (url) {
      setSelectedDroneImageUrl(url);
      return;
    }

    try {
      const res = await fetch(`/api/drone/details?upload_id=${uploadId}`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok) setSelectedDroneImageUrl(json?.image_url ?? null);
    } catch {}
  }

  async function setSlot(squad: SquadSlot, slot: HeroSlotIndex, uploadId: number | null) {
    setSquadsBusy(true);
    setSquadsMsg(null);

    try {
      const res = await fetch("/api/player/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ op: "set_slot", squad, slot, upload_id: uploadId }),
      });

      const json = (await res.json().catch(() => null)) as PlayerStateResponse | null;

      if (!res.ok || !json?.ok) {
        setSquadsMsg(`Save failed: ${json?.error ?? `HTTP ${res.status}`}`);
        return;
      }

      setSlots(normalizeSlotsFromState(json.state ?? {}));
      setSquadsMsg("Saved ✅");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      setSquadsMsg(`Save failed: ${msg}`);
    } finally {
      setSquadsBusy(false);
    }
  }

  async function openHeroDetails(uploadId: number) {
    setHeroDetailsUploadId(uploadId);
    setHeroDetailsBusy(true);
    setHeroDetailsErr(null);
    setHeroExtractMsg(null);
    setHeroDetailsFacts(null);
    setHeroDetailsImg(null);

    try {
      const res = await fetch(`/api/hero/details?upload_id=${uploadId}`, { credentials: "include" });
      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const msg = payload.json?.error ?? payload.json?.message ?? payload.text ?? `HTTP ${res.status}`;
        setHeroDetailsErr(`Load failed: ${String(msg)}`);
        return;
      }

      setHeroDetailsImg(payload.json?.image_url ?? null);
      setHeroDetailsFacts(payload.json?.facts ?? null);

      const v = payload.json?.facts?.value ?? null;
      setHeroName(v?.name ?? "");
      setHeroLevel(String(v?.level ?? ""));
      setHeroStars(String(v?.stars ?? ""));
      setHeroPower(String(v?.power ?? ""));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      setHeroDetailsErr(`Load failed: ${msg}`);
    } finally {
      setHeroDetailsBusy(false);
      setHeroDetailsOpen(true);
    }
  }

  async function extractHeroDetails() {
    if (!heroDetailsUploadId) return;

    setHeroExtractBusy(true);
    setHeroExtractMsg(null);
    setHeroDetailsErr(null);

    try {
      const res = await fetch("/api/hero/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: heroDetailsUploadId }),
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const msg = payload.json?.error ?? payload.json?.message ?? payload.text ?? `HTTP ${res.status}`;
        setHeroDetailsErr(`Extract failed: ${String(msg)}`);
        return;
      }

      const ex = payload.json?.extracted ?? {};
      setHeroName(ex?.name ?? "");
      setHeroLevel(String(ex?.level ?? ""));
      setHeroStars(String(ex?.stars ?? ""));
      setHeroPower(String(ex?.power ?? ""));
      setHeroExtractMsg("Extracted ✅ (review fields, then Save)");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      setHeroDetailsErr(`Extract failed: ${msg}`);
    } finally {
      setHeroExtractBusy(false);
    }
  }

  async function saveHeroDetails() {
    if (!heroDetailsUploadId) return;

    setHeroDetailsBusy(true);
    setHeroDetailsErr(null);

    try {
      const res = await fetch("/api/hero/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          upload_id: heroDetailsUploadId,
          name: heroName,
          level: heroLevel,
          stars: heroStars,
          power: heroPower,
        }),
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const msg = payload.json?.error ?? payload.json?.message ?? payload.text ?? `HTTP ${res.status}`;
        setHeroDetailsErr(`Save failed: ${String(msg)}`);
        return;
      }

      await openHeroDetails(heroDetailsUploadId);
      setHeroExtractMsg("Saved ✅");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      setHeroDetailsErr(`Save failed: ${msg}`);
    } finally {
      setHeroDetailsBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      {/* Main Chat Area */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-28 pt-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-[0.35em] text-white/50">Main Chat</div>
          <div className="mt-3">
            <ChatWindow
              endpoint="/api/chat"
              emoji="🧠"
              emptyStateComponent={
                <div className="text-sm text-slate-400/80">
                  Ask anything. You can reference squads, heroes, drone, and battle reports once saved.
                </div>
              }
            />
          </div>
        </div>
      </div>

      {/* Bottom Buttons (kept at bottom) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-3">
          <BottomButton label="Upload" onClick={() => setUploadOpen(true)} />
          <BottomButton
            label="Squads"
            onClick={async () => {
              await loadSquadsAndUploads();
              setSquadsOpen(true);
            }}
          />
          <BottomButton
            label="Drone"
            onClick={async () => {
              await loadDroneUploads();
              setDroneTab("overview");
              setDroneOpen(true);
            }}
          />
          <BottomButton label="Overlord" onClick={() => setOverlordOpen(true)} />
          <BottomButton label="Battle Report" onClick={() => setBattleOpen(true)} />
          <BottomButton label="Optimizer" onClick={() => setOptimizerOpen(true)} />
        </div>
      </div>

      {/* Upload Modal */}
      <ModalShell title="Upload" subtitle={`Kind: ${kindLabel}`} open={uploadOpen} onClose={() => setUploadOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Upload kind</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: "battle_report", label: "Battle report" },
                  { k: "hero_profile", label: "Hero profile" },
                  { k: "hero_skills", label: "Hero skills" },
                  { k: "gear", label: "Gear" },
                  { k: "drone", label: "Drone" },
                  { k: "overlord", label: "Overlord" },
                ].map((opt) => (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => setUploadKind(opt.k as UploadUIKind)}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-left text-sm transition",
                      uploadKind === opt.k
                        ? "border-fuchsia-300/40 bg-fuchsia-950/20 text-fuchsia-100/90"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    )}
                  >
                    <div className="text-xs uppercase tracking-[0.25em] opacity-70">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploadBusy}
                onChange={(e) => void handleUploadFiles(e.target.files)}
                className="block w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/70"
              />
              {uploadProgress ? (
                <div className="mt-2 text-xs text-white/55">
                  Uploading {uploadProgress.current}/{uploadProgress.total}
                </div>
              ) : null}
              {uploadMsg ? (
                <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                  {uploadMsg}
                </div>
              ) : null}
            </div>
          </div>

          {uploadResults.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Results</div>
              <div className="mt-2 space-y-1 text-sm text-white/70">
                {uploadResults.map((r, i) => (
                  <div
                    key={i}
                    className={cn("rounded-xl px-2 py-1", r.ok ? "bg-emerald-500/10" : "bg-rose-500/10")}
                  >
                    {r.fileName}: {r.message}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </ModalShell>

      {/* Squads Modal */}
      <ModalShell title="Squads" subtitle="Assign heroes to slots" open={squadsOpen} onClose={() => setSquadsOpen(false)}>
        <div className="space-y-4">
          {squadsMsg ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
              {squadsMsg}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((sq) => (
              <SquadGrid
                key={sq}
                squad={sq as SquadSlot}
                slots={slots}
                heroUploads={heroUploads}
                selectedSlot={selectedSlot}
                setSelectedSlot={setSelectedSlot}
                onAssign={async (s, sl, id) => setSlot(s, sl, id)}
                onClear={async (s, sl) => setSlot(s, sl, null)}
                onOpenHeroDetails={openHeroDetails}
              />
            ))}
          </div>
        </div>
      </ModalShell>

      {/* Hero Details Modal */}
      <ModalShell
        title="Hero Profile"
        subtitle={heroDetailsUploadId ? `Upload ID: ${heroDetailsUploadId}` : "Hero details"}
        open={heroDetailsOpen}
        onClose={() => setHeroDetailsOpen(false)}
      >
        <div className="space-y-4">
          {heroDetailsErr ? (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-950/20 p-3 text-sm text-rose-100/80">
              {heroDetailsErr}
            </div>
          ) : null}

          {heroExtractMsg ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
              {heroExtractMsg}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Hero image</div>

              {heroDetailsImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroDetailsImg}
                  alt="Hero screenshot"
                  className="mt-3 w-full rounded-2xl border border-white/10"
                />
              ) : (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/60">
                  No image.
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void extractHeroDetails()}
                  disabled={heroDetailsBusy || heroExtractBusy || !heroDetailsUploadId}
                  className={cn(
                    "rounded-2xl border border-white/10 bg-white/5 px-4 py-2",
                    "text-xs uppercase tracking-widest text-white/70 hover:bg-white/10",
                    (heroDetailsBusy || heroExtractBusy || !heroDetailsUploadId) && "opacity-50 cursor-not-allowed"
                  )}
                  title="Use AI to read the hero image and fill fields (low-cost mode)."
                >
                  {heroExtractBusy ? "Extracting…" : "Extract from Image"}
                </button>

                <button
                  type="button"
                  onClick={() => void saveHeroDetails()}
                  disabled={heroDetailsBusy || !heroDetailsUploadId}
                  className={cn(
                    "rounded-2xl border border-fuchsia-400/25 bg-fuchsia-950/20 px-4 py-2",
                    "text-xs uppercase tracking-widest text-fuchsia-200/90 hover:border-fuchsia-300/40 transition",
                    heroDetailsBusy && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {heroDetailsBusy ? "Saving..." : "Save"}
                </button>

                {heroDetailsUploadId ? (
                  <button
                    type="button"
                    onClick={() => void openHeroDetails(heroDetailsUploadId)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
                  >
                    Reload
                  </button>
                ) : null}
              </div>

              <div className="text-xs text-white/45">
                Saved data is stored in <span className="text-white/75">facts</span> and linked back to this upload. This avoids
                duplicates and makes it persist after reload.
              </div>

              {heroDetailsFacts ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Current facts row</div>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-white/70">
                    {JSON.stringify(heroDetailsFacts, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Hero name</div>
              <input
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 placeholder:text-white/35 outline-none focus:border-white/20"
                placeholder="e.g., Murphy"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Level</div>
                  <input
                    value={heroLevel}
                    onChange={(e) => setHeroLevel(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 placeholder:text-white/35 outline-none focus:border-white/20"
                    placeholder="0"
                  />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Stars</div>
                  <input
                    value={heroStars}
                    onChange={(e) => setHeroStars(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 placeholder:text-white/35 outline-none focus:border-white/20"
                    placeholder="0"
                  />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Power (optional)</div>
                  <input
                    value={heroPower}
                    onChange={(e) => setHeroPower(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 placeholder:text-white/35 outline-none focus:border-white/20"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Drone Modal */}
      <ModalShell
        title="Drone"
        subtitle="Overview • Components • Combat Boost • Skill Chips"
        open={droneOpen}
        onClose={() => setDroneOpen(false)}
      >
        <div className="space-y-4">
          {droneMsg ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
              {droneMsg}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Drone screenshots</div>
                <div className="mt-1 text-sm text-white/75">
                  {droneUploads.length ? `${droneUploads.length} uploaded` : "None yet"}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  Select a drone screenshot so we can derive your profile id from the storage path.
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadDroneUploads()}
                disabled={droneBusy}
                className={cn(
                  "rounded-2xl border border-white/10 bg-white/5 px-4 py-2",
                  "text-xs uppercase tracking-widest text-white/70 hover:bg-white/10",
                  droneBusy && "opacity-50 cursor-not-allowed"
                )}
              >
                {droneBusy ? "Loading..." : "Reload list"}
              </button>
            </div>

            {droneUploads.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {droneUploads.slice(0, 60).map((u: any) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => void selectDroneUpload(u.id, u)}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-xs",
                      selectedDroneUploadId === u.id
                        ? "border-fuchsia-300/40 bg-fuchsia-950/20 text-fuchsia-100/90"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    )}
                    title={u.storage_path ?? ""}
                  >
                    #{u.id}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Upload drone screenshots via <span className="text-white/80">Upload</span> →{" "}
                <span className="text-white/80">Drone</span>.
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
              <div>
                Selected upload:{" "}
                <span className="text-white/80">{selectedDroneUploadId ? `#${selectedDroneUploadId}` : "none"}</span>
              </div>
              <div className="text-white/30">•</div>
              <div>
                Derived owner id: <span className="text-white/80">{droneOwnerId ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
            <div className="flex flex-wrap gap-2">
              {[
                { k: "overview", label: "Overview" },
                { k: "components", label: "Components" },
                { k: "combat_boost", label: "Combat Boost" },
                { k: "chips", label: "Skill Chips" },
              ].map((t) => (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setDroneTab(t.k as any)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.25em]",
                    droneTab === t.k
                      ? "border-fuchsia-300/40 bg-fuchsia-950/20 text-fuchsia-100/90"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {droneTab === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Selected image</div>
                {selectedDroneImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedDroneImageUrl}
                    alt="Drone screenshot"
                    className="mt-3 w-full rounded-2xl border border-white/10"
                  />
                ) : (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/60">
                    Pick a drone screenshot above.
                  </div>
                )}
                <div className="mt-3 text-xs text-white/45">
                  This tab is a quick sanity check: if the screenshot loads, the rest of the tabs can save facts tied to your profile.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">What we’re saving</div>
                <div className="mt-2 text-sm text-white/70 space-y-2">
                  <div>• Components progress (percent + level per component)</div>
                  <div>• Combat Boost + Skill Chip Sets</div>
                  <div>• Squad mapping (dropdown per squad slot) is inside the Skill Chip Sets save object</div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/55">
                  If <span className="text-white/80">Derived owner id</span> shows “—”, select a different drone upload that has a storage_path.
                </div>
              </div>
            </div>
          ) : null}

          {droneTab === "components" ? (
            droneOwnerId ? (
              <DroneComponentsEditor ownerId={droneOwnerId} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Select a drone screenshot first so we can derive your owner id.
              </div>
            )
          ) : null}

          {droneTab === "combat_boost" || droneTab === "chips" ? (
            droneOwnerId ? (
              <DroneCombatBoostEditor ownerId={droneOwnerId} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Select a drone screenshot first so we can derive your owner id.
              </div>
            )
          ) : null}
        </div>
      </ModalShell>

      {/* Overlord Modal */}
      <ModalShell title="Overlord" subtitle="Training • promotion • skills" open={overlordOpen} onClose={() => setOverlordOpen(false)}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          This modal is ready to be wired to your saved overlord extraction data. For now, uploads + future optimizer can read overlord rows via{" "}
          <span className="text-white/85">kind = &quot;overlord&quot;</span>.
        </div>
      </ModalShell>

      {/* Battle Report Analyzer Modal */}
      <ModalShell
        title="Battle Report Analyzer"
        subtitle="Runs analysis over your saved battle report history and lets you ask follow-up questions"
        open={battleOpen}
        onClose={() => setBattleOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runBattleSummary}
              disabled={battleBusy}
              className={cn(
                "rounded-2xl border border-fuchsia-400/25 bg-fuchsia-950/20 px-4 py-2",
                "text-xs uppercase tracking-widest text-fuchsia-200/90 hover:border-fuchsia-300/40 transition",
                battleBusy && "opacity-50 cursor-not-allowed"
              )}
            >
              {battleBusy ? "Running..." : "Run Summary"}
            </button>

            <button
              type="button"
              onClick={() => setBattleOut("")}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
            >
              Clear
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/60">
            Reminder: attacker/defender names or IDs, timestamps, and map coordinates are not saved (by design).
          </div>

          <div className="max-h-[45vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4">
            <pre className="whitespace-pre-wrap text-sm text-white/80">
              {battleOut || "Output will appear here."}
            </pre>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.25em] text-white/50">Ask the analyzer</div>
            <div className="mt-2 flex gap-2">
              <input
                value={battleMsg}
                onChange={(e) => setBattleMsg(e.target.value)}
                placeholder="Ask why you won/lost, strengths/weaknesses, what to change, lineup ideas, etc."
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 placeholder:text-white/35 outline-none focus:border-white/20"
                disabled={battleBusy}
              />
              <button
                type="button"
                onClick={askBattleAnalyzer}
                disabled={battleBusy || !battleMsg.trim()}
                className={cn(
                  "rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-widest text-white/80 hover:bg-white/15",
                  (battleBusy || !battleMsg.trim()) && "opacity-50 cursor-not-allowed"
                )}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Optimizer Modal */}
      <ModalShell
        title="Optimizer"
        subtitle="Builds optimal squads from your saved facts (heroes + drone + battle reports)"
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Optimizer placeholder (per your plan): we’ll fine-tune after squads + drone + analyzer are stable.
        </div>
      </ModalShell>
    </div>
  );
}
