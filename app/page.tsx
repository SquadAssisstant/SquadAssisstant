"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DroneComponentsEditor } from "@/components/drone/DroneComponentsEditor";
import { DroneCombatBoostEditor as DroneSkillChipsEditor } from "@/components/drone/DroneCombatBoostEditor";

type SquadSlot = 1 | 2 | 3 | 4;
type HeroSlotIndex = 1 | 2 | 3 | 4 | 5;
type DroneTab = "overview" | "components" | "combat_boost" | "chips";
type UploadUIKind = "battle_report" | "hero_profile" | "hero_skills" | "gear" | "drone" | "overlord";

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function nowIso() {
  return new Date().toISOString();
}

function mapToBackendKind(kind: UploadUIKind) {
  if (kind === "hero_skills") return "hero_profile";
  return kind;
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
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className={cn("w-full rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl", maxWidthClass)}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/45">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-white/65">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/75 hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

function BottomButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.25em] text-white/80 shadow-lg hover:bg-white/10"
    >
      {label}
    </button>
  );
}

function HeroDetailPanel({
  open,
  loading,
  saving,
  extracting,
  err,
  msg,
  imageUrl,
  uploadId,
  facts,
  heroName,
  heroLevel,
  heroStars,
  heroPower,
  setHeroName,
  setHeroLevel,
  setHeroStars,
  setHeroPower,
  onExtract,
  onSave,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  saving: boolean;
  extracting: boolean;
  err: string | null;
  msg: string | null;
  imageUrl: string | null;
  uploadId: number | null;
  facts: any;
  heroName: string;
  heroLevel: string;
  heroStars: string;
  heroPower: string;
  setHeroName: (v: string) => void;
  setHeroLevel: (v: string) => void;
  setHeroStars: (v: string) => void;
  setHeroPower: (v: string) => void;
  onExtract: () => Promise<void>;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  if (!open) return null;

  const stats = facts?.value?.stats ?? {};

  return (
    <div className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-950/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-fuchsia-100/55">Hero profile</div>
          <div className="mt-1 text-sm text-white/70">Upload #{uploadId ?? "—"}</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onExtract()}
            disabled={extracting || !uploadId}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "Extract"}
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !uploadId}
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs uppercase tracking-[0.2em] text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
          >
            Done
          </button>
        </div>
      </div>

      {err ? <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div> : null}
      {msg ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{msg}</div> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Hero screenshot" className="w-full rounded-2xl border border-white/10" />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/60">
              {loading ? "Loading hero image…" : "No hero image available."}
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Name</div>
            <input
              value={heroName}
              onChange={(e) => setHeroName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Hero name"
            />
          </label>

          <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Level</div>
            <input
              value={heroLevel}
              onChange={(e) => setHeroLevel(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Level"
            />
          </label>

          <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Stars</div>
            <input
              value={heroStars}
              onChange={(e) => setHeroStars(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Stars"
            />
          </label>

          <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Power</div>
            <input
              value={heroPower}
              onChange={(e) => setHeroPower(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Power"
            />
          </label>

          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Detected stats</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm text-white/75">
              <div>Attack: {stats?.attack ?? "—"}</div>
              <div>HP: {stats?.hp ?? "—"}</div>
              <div>Defense: {stats?.defense ?? "—"}</div>
              <div>March Size: {stats?.march_size ?? "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);

  const [uploadKind, setUploadKind] = useState<UploadUIKind>("hero_profile");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<Array<{ fileName: string; ok: boolean; message: string }>>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const [squadsBusy, setSquadsBusy] = useState(false);
  const [squadsMsg, setSquadsMsg] = useState<string | null>(null);
  const [heroUploads, setHeroUploads] = useState<UploadRow[]>([]);
  const [slots, setSlots] = useState<Record<string, number | null>>({});
  const [selectedSlot, setSelectedSlot] = useState<{ squad: SquadSlot; slot: HeroSlotIndex } | null>(null);

  const [heroDetailsOpen, setHeroDetailsOpen] = useState(false);
  const [heroDetailsUploadId, setHeroDetailsUploadId] = useState<number | null>(null);
  const [heroDetailsBusy, setHeroDetailsBusy] = useState(false);
  const [heroExtractBusy, setHeroExtractBusy] = useState(false);
  const [heroDetailsErr, setHeroDetailsErr] = useState<string | null>(null);
  const [heroExtractMsg, setHeroExtractMsg] = useState<string | null>(null);
  const [heroDetailsImg, setHeroDetailsImg] = useState<string | null>(null);
  const [heroDetailsFacts, setHeroDetailsFacts] = useState<any>(null);
  const [heroName, setHeroName] = useState("");
  const [heroLevel, setHeroLevel] = useState("");
  const [heroStars, setHeroStars] = useState("");
  const [heroPower, setHeroPower] = useState("");

  const [droneTab, setDroneTab] = useState<DroneTab>("overview");
  const [droneBusy, setDroneBusy] = useState(false);
  const [droneMsg, setDroneMsg] = useState<string | null>(null);
  const [droneUploads, setDroneUploads] = useState<UploadRow[]>([]);
  const [selectedDroneUploadId, setSelectedDroneUploadId] = useState<number | null>(null);
  const [selectedDroneImageUrl, setSelectedDroneImageUrl] = useState<string | null>(null);
  const [droneOwnerId, setDroneOwnerId] = useState<string | null>(null);

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
      const msgBase = typeof serverMsg === "string" && serverMsg ? serverMsg : "Upload failed.";
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
      const results: Array<{ fileName: string; ok: boolean; message: string }> = [];

      for (let i = 0; i < arr.length; i += 1) {
        setUploadProgress({ current: i + 1, total: arr.length });
        const file = arr[i];
        const result = await uploadSingle(file, uploadKind);
        results.push({ fileName: file.name, ok: result.ok, message: result.message });
        setUploadResults([...results]);
      }

      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.length - okCount;
      setUploadMsg(
        failCount === 0
          ? `Done ✅ Uploaded ${okCount}/${results.length} (${kindLabel}).`
          : `Done ⚠️ Uploaded ${okCount}/${results.length} (${kindLabel}). Failed: ${failCount}.`
      );
    } catch (e: any) {
      setUploadMsg(`Upload failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setUploadBusy(false);
      setUploadProgress(null);
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
        | { ok?: boolean; uploads?: UploadRow[]; error?: string }
        | null;

      if (!stateRes.ok || !statePayload?.ok) {
        setSquadsMsg(`State load failed: ${statePayload?.error ?? `HTTP ${stateRes.status}`}`);
      } else {
        setSlots(normalizeSlotsFromState(statePayload.state ?? {}));
      }

      if (!uploadsRes.ok || !uploadsPayload?.ok) {
        setHeroUploads([]);
        setSquadsMsg((prev) => prev ?? `Hero uploads load failed: ${uploadsPayload?.error ?? `HTTP ${uploadsRes.status}`}`);
      } else {
        setHeroUploads(uploadsPayload.uploads ?? []);
      }
    } catch (e: any) {
      setSquadsMsg(`Load failed: ${e?.message ?? "unknown"}`);
    } finally {
      setSquadsBusy(false);
    }
  }

  async function setSlotAssignment(squad: SquadSlot, slot: HeroSlotIndex, uploadId: number | null) {
    setSquadsBusy(true);
    setSquadsMsg(null);

    try {
      const res = await fetch("/api/player/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          op: "set_slot",
          squad,
          slot,
          upload_id: uploadId,
        }),
      });

      const json = (await res.json().catch(() => null)) as PlayerStateResponse | null;

      if (!res.ok || !json?.ok) {
        setSquadsMsg(`Save failed: ${json?.error ?? `HTTP ${res.status}`}`);
        return;
      }

      setSlots(normalizeSlotsFromState(json.state ?? {}));
      setSquadsMsg("Saved ✅");
    } catch (e: any) {
      setSquadsMsg(`Save failed: ${e?.message ?? "unknown"}`);
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
    setHeroDetailsOpen(true);

    try {
      const res = await fetch(`/api/hero/details?upload_id=${uploadId}`, {
        credentials: "include",
      });

      const payload = await safeReadResponse(res);

      if (!res.ok) {
        const msg = payload.json?.error ?? payload.json?.message ?? payload.text ?? `HTTP ${res.status}`;
        setHeroDetailsErr(`Load failed: ${String(msg)}`);
        return;
      }

      setHeroDetailsImg(payload.json?.image_url ?? null);
      setHeroDetailsFacts(payload.json?.facts ?? null);

      const value = payload.json?.facts?.value ?? null;
      setHeroName(value?.name ?? "");
      setHeroLevel(String(value?.level ?? ""));
      setHeroStars(String(value?.stars ?? ""));
      setHeroPower(String(value?.power ?? ""));
    } catch (e: any) {
      setHeroDetailsErr(`Load failed: ${e?.message ?? "unknown"}`);
    } finally {
      setHeroDetailsBusy(false);
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

      const extracted = payload.json?.extracted ?? {};
      setHeroName(extracted?.name ?? "");
      setHeroLevel(String(extracted?.level ?? ""));
      setHeroStars(String(extracted?.stars ?? ""));
      setHeroPower(String(extracted?.power ?? ""));
      setHeroExtractMsg("Extracted ✅ (review fields, then Save)");
    } catch (e: any) {
      setHeroDetailsErr(`Extract failed: ${e?.message ?? "unknown"}`);
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
    } catch (e: any) {
      setHeroDetailsErr(`Save failed: ${e?.message ?? "unknown"}`);
    } finally {
      setHeroDetailsBusy(false);
    }
  }

  async function loadDroneUploads() {
    setDroneBusy(true);
    setDroneMsg(null);

    try {
      const res = await fetch("/api/uploads/list?kind=drone&limit=200", {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setDroneUploads([]);
        setDroneMsg(json?.error ?? `Drone uploads load failed (HTTP ${res.status})`);
        return;
      }

      const uploads = Array.isArray(json.uploads) ? (json.uploads as UploadRow[]) : [];
      setDroneUploads(uploads);

      if (selectedDroneUploadId) {
        const match = uploads.find((u) => u.id === selectedDroneUploadId);
        if (!match) {
          setSelectedDroneUploadId(null);
          setSelectedDroneImageUrl(null);
          setDroneOwnerId(null);
        } else {
          await selectDroneUpload(match.id, match);
        }
      }
    } catch (e: any) {
      setDroneUploads([]);
      setDroneMsg(e?.message ?? "Drone uploads load failed");
    } finally {
      setDroneBusy(false);
    }
  }

  async function selectDroneUpload(uploadId: number, row?: UploadRow) {
    setSelectedDroneUploadId(uploadId);

    const match = row ?? droneUploads.find((u) => u.id === uploadId);
    const ownerId = ownerIdFromStoragePath(match?.storage_path ?? null);
    setDroneOwnerId(ownerId);

    const directUrl = match?.url ?? null;
    if (directUrl) {
      setSelectedDroneImageUrl(directUrl);
      return;
    }

    try {
      const res = await fetch(`/api/drone/details?upload_id=${uploadId}`, {
        credentials: "include",
      });
      const payload = await safeReadResponse(res);
      if (res.ok) {
        setSelectedDroneImageUrl(payload.json?.image_url ?? null);
      } else {
        setSelectedDroneImageUrl(null);
      }
    } catch {
      setSelectedDroneImageUrl(null);
    }
  }

  useEffect(() => {
    if (squadsOpen) {
      void loadSquadsAndUploads();
    }
  }, [squadsOpen]);

  useEffect(() => {
    if (droneOpen) {
      void loadDroneUploads();
    }
  }, [droneOpen]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-white/45">SquadAssistant</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Player screenshot control center</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/70 sm:text-base">
            Upload screenshots, assign heroes into squads, reopen saved files, and manage drone extraction without keeping the whole homepage tangled together.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Heroes</div>
              <div className="mt-2 text-sm text-white/70">Squads modal keeps hero assignment and the hero profile editor together.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Drone</div>
              <div className="mt-2 text-sm text-white/70">Components and Skill Chips stay separate. Combat Boost is isolated so it cannot corrupt chip data.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Next</div>
              <div className="mt-2 text-sm text-white/70">Once this shell is stable, the same pattern can be reused for Overlord and any future modal.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[900] border-t border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <BottomButton label="Upload" onClick={() => setUploadOpen(true)} />
          <BottomButton label="Squads" onClick={() => setSquadsOpen(true)} />
          <BottomButton label="Drone" onClick={() => setDroneOpen(true)} />
          <BottomButton label="Overlord" onClick={() => setOverlordOpen(true)} />
          <BottomButton label="Battle Report" onClick={() => setBattleOpen(true)} />
          <BottomButton label="Optimizer" onClick={() => setOptimizerOpen(true)} />
        </div>
      </div>

      <ModalShell title="Upload" subtitle="Send screenshots to saved storage" open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidthClass="max-w-4xl">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-white/45">Kind</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["hero_profile", "Hero Profile"],
                ["hero_skills", "Hero Skills"],
                ["drone", "Drone"],
                ["overlord", "Overlord"],
                ["battle_report", "Battle Report"],
                ["gear", "Gear"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUploadKind(value)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.2em]",
                    uploadKind === value
                      ? "border-fuchsia-300/40 bg-fuchsia-950/20 text-fuchsia-100/90"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="block rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center cursor-pointer hover:bg-white/10">
            <div className="text-sm text-white/80">Tap to choose image files</div>
            <div className="mt-2 text-xs text-white/45">Current kind: {kindLabel}</div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleUploadFiles(e.target.files)}
            />
          </label>

          {uploadProgress ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
              Uploading {uploadProgress.current} / {uploadProgress.total}
            </div>
          ) : null}

          {uploadMsg ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{uploadMsg}</div>
          ) : null}

          {uploadBusy ? <div className="text-sm text-white/60">Uploading…</div> : null}

          {uploadResults.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Results</div>
              <div className="mt-3 space-y-2">
                {uploadResults.map((r, idx) => (
                  <div key={`${r.fileName}-${idx}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                    <div className="truncate text-white/80">{r.fileName}</div>
                    <div className={r.ok ? "text-emerald-200" : "text-red-200"}>{r.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </ModalShell>

      <ModalShell title="Squads" subtitle="Assign hero uploads and edit hero profiles" open={squadsOpen} onClose={() => setSquadsOpen(false)}>
        <div className="space-y-4">
          {squadsMsg ? <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{squadsMsg}</div> : null}
          {squadsBusy ? <div className="text-sm text-white/60">Loading squads…</div> : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((rawSquad) => {
                const squad = rawSquad as SquadSlot;
                const selectedThisSquad = selectedSlot?.squad === squad ? selectedSlot.slot : null;

                return (
                  <div key={squad} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Squad {squad}</div>
                        <div className="text-xs text-white/55">Tap a slot, then tap a hero below to assign it.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedThisSquad) return;
                          const uploadId = slots[`${squad}-${selectedThisSquad}`];
                          if (!uploadId) return;
                          void openHeroDetails(uploadId);
                        }}
                        disabled={!selectedThisSquad || !slots[`${squad}-${selectedThisSquad}`]}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-white/75 hover:bg-white/10 disabled:opacity-50"
                      >
                        Open Hero Profile
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-5">
                      {[1, 2, 3, 4, 5].map((rawSlot) => {
                        const slot = rawSlot as HeroSlotIndex;
                        const key = `${squad}-${slot}`;
                        const uploadId = slots[key];
                        const isSelected = selectedSlot?.squad === squad && selectedSlot?.slot === slot;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedSlot({ squad, slot })}
                            className={cn(
                              "rounded-2xl border p-3 text-left transition",
                              isSelected
                                ? "border-fuchsia-300/40 bg-fuchsia-950/20"
                                : "border-white/10 bg-black/20 hover:bg-white/10"
                            )}
                          >
                            <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Slot {slot}</div>
                            <div className="mt-2 text-sm text-white/80">{uploadId ? `Upload #${uploadId}` : "Empty"}</div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void setSlotAssignment(squad, slot, null);
                              }}
                              disabled={!uploadId}
                              className="mt-3 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60 disabled:opacity-40"
                            >
                              Clear
                            </button>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Hero uploads</div>
                <div className="mt-2 text-sm text-white/60">Selected slot: {selectedSlot ? `Squad ${selectedSlot.squad} · Slot ${selectedSlot.slot}` : "none"}</div>
                <div className="mt-4 grid gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {heroUploads.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        if (!selectedSlot) return;
                        void setSlotAssignment(selectedSlot.squad, selectedSlot.slot, u.id);
                      }}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left hover:bg-white/10"
                      title={u.storage_path ?? ""}
                    >
                      <div>
                        <div className="text-sm text-white/85">Upload #{u.id}</div>
                        <div className="text-xs text-white/45">{u.created_at ? new Date(u.created_at).toLocaleString() : "Saved file"}</div>
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Assign</div>
                    </button>
                  ))}
                  {heroUploads.length === 0 ? <div className="text-sm text-white/55">No saved hero uploads yet.</div> : null}
                </div>
              </div>
            </div>
          </div>

          <HeroDetailPanel
            open={heroDetailsOpen}
            loading={heroDetailsBusy}
            saving={heroDetailsBusy}
            extracting={heroExtractBusy}
            err={heroDetailsErr}
            msg={heroExtractMsg}
            imageUrl={heroDetailsImg}
            uploadId={heroDetailsUploadId}
            facts={heroDetailsFacts}
            heroName={heroName}
            heroLevel={heroLevel}
            heroStars={heroStars}
            heroPower={heroPower}
            setHeroName={setHeroName}
            setHeroLevel={setHeroLevel}
            setHeroStars={setHeroStars}
            setHeroPower={setHeroPower}
            onExtract={extractHeroDetails}
            onSave={saveHeroDetails}
            onClose={() => setHeroDetailsOpen(false)}
          />
        </div>
      </ModalShell>

      <ModalShell title="Drone" subtitle="Overview • components • combat boost • skill chips" open={droneOpen} onClose={() => setDroneOpen(false)}>
        <div className="space-y-4">
          {droneMsg ? <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{droneMsg}</div> : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Saved drone uploads</div>
                <div className="mt-1 text-sm text-white/60">Pick a screenshot. Saved files are loaded from your existing uploads list.</div>
              </div>
              <button
                type="button"
                onClick={() => void loadDroneUploads()}
                disabled={droneBusy}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/75 hover:bg-white/10 disabled:opacity-50"
              >
                {droneBusy ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {droneUploads.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => void selectDroneUpload(u.id, u)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.2em]",
                    selectedDroneUploadId === u.id
                      ? "border-fuchsia-300/40 bg-fuchsia-950/20 text-fuchsia-100/90"
                      : "border-white/10 bg-black/20 text-white/75 hover:bg-white/10"
                  )}
                >
                  Drone #{u.id}
                </button>
              ))}
              {droneUploads.length === 0 ? <div className="text-sm text-white/55">No saved drone uploads yet.</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
            Selected upload: {selectedDroneUploadId ?? "—"}
            <span className="mx-2 text-white/20">•</span>
            Derived owner id: {droneOwnerId ?? "—"}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
            <div className="flex flex-wrap gap-2">
              {([
                ["overview", "Overview"],
                ["components", "Components"],
                ["combat_boost", "Combat Boost"],
                ["chips", "Skill Chips"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDroneTab(value)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.25em]",
                    droneTab === value
                      ? "border-fuchsia-300/40 bg-fuchsia-950/20 text-fuchsia-100/90"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  )}
                >
                  {label}
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
                  <img src={selectedDroneImageUrl} alt="Drone screenshot" className="mt-3 w-full rounded-2xl border border-white/10" />
                ) : (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/60">
                    Pick a drone screenshot above.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Current wiring</div>
                <div className="mt-3 space-y-2">
                  <div>• Components uses the dedicated components editor.</div>
                  <div>• Skill Chips uses the existing chip-set editor.</div>
                  <div>• Combat Boost is isolated until its own editor/schema is added.</div>
                </div>
              </div>
            </div>
          ) : null}

          {droneTab === "components" ? (
            droneOwnerId ? (
              <DroneComponentsEditor ownerId={droneOwnerId} selectedUploadId={selectedDroneUploadId} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Select a drone screenshot first so we can derive your owner id.</div>
            )
          ) : null}

          {droneTab === "chips" ? (
            droneOwnerId ? (
              <DroneSkillChipsEditor ownerId={droneOwnerId} selectedUploadId={selectedDroneUploadId} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Select a drone screenshot first so we can derive your owner id.</div>
            )
          ) : null}

          {droneTab === "combat_boost" ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100/90">
              Combat Boost is intentionally separated from Skill Chips in this rebuild. The current repo already has a working chip-set editor, but a real combat boost editor/schema still needs to be added as its own component and save route.
            </div>
          ) : null}
        </div>
      </ModalShell>

      <ModalShell title="Overlord" subtitle="Ready for the same screenshot → extract → edit → save pattern" open={overlordOpen} onClose={() => setOverlordOpen(false)} maxWidthClass="max-w-4xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          This rebuild keeps the Overlord button and modal in place. Once the drone pattern is fully stable, Overlord can reuse the same architecture with its own upload kind, extraction route, editor fields, and facts key.
        </div>
      </ModalShell>

      <ModalShell title="Battle Report" subtitle="Placeholder" open={battleOpen} onClose={() => setBattleOpen(false)} maxWidthClass="max-w-4xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Battle report UI is intentionally left minimal in this homepage rebuild.</div>
      </ModalShell>

      <ModalShell title="Optimizer" subtitle="Placeholder" open={optimizerOpen} onClose={() => setOptimizerOpen(false)} maxWidthClass="max-w-4xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Optimizer UI is intentionally left minimal in this homepage rebuild.</div>
      </ModalShell>
    </main>
  );
}
