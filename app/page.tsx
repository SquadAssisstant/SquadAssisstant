"use client";

import React, { useMemo, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";

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
            {subtitle ? (
              <div className="mt-2 text-sm leading-relaxed text-white/70">
                {subtitle}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            aria-label="Close modal"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5">{children}</div>

        <div className="flex justify-end border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-3",
        "text-[11px] uppercase tracking-[0.25em] text-white",
        "hover:bg-white/15 active:scale-[0.99] transition"
      )}
      style={{ minWidth: 140 }}
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
  onAssign: (squad: number, slot: number, upload_id: number) => Promise<void>;
  onClear: (squad: number, slot: number) => Promise<void>;
  onOpenHeroDetails: (upload_id: number) => Promise<void>;
}) {
  const selectedThisSquad =
    selectedSlot && selectedSlot.squad === squad ? selectedSlot.slot : null;

  const uploadById = useMemo(() => {
    const m = new Map<number, HeroUpload>();
    for (const u of heroUploads) m.set(u.id, u);
    return m;
  }, [heroUploads]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white/90">{`Squad ${squad}`}</div>
          <div className="mt-1 text-sm text-white/60">5 hero slots</div>
        </div>

        <button
          type="button"
          onClick={async () => {
            if (!selectedSlot || selectedSlot.squad !== squad) return;
            await onClear(selectedSlot.squad, selectedSlot.slot);
          }}
          disabled={!selectedThisSquad}
          className={cn(
            "rounded-2xl border border-white/10 bg-white/5 px-3 py-2",
            "text-[10px] uppercase tracking-[0.25em] text-white/70 hover:bg-white/10",
            !selectedThisSquad && "opacity-50 cursor-not-allowed"
          )}
          title="Clear selected slot"
        >
          Clear slot
        </button>
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.25em] text-white/40">
        Hero slots (click a slot, then pick a hero below)
      </div>

      <div className="mt-2 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, idx) => {
          const slot = (idx + 1) as HeroSlotIndex;
          const key = `${squad}-${slot}`;
          const uploadId = slots[key];
          const u = uploadId ? uploadById.get(uploadId) : undefined;
          const img = u?.url ?? null;

          const isSelected =
            selectedSlot?.squad === squad && selectedSlot?.slot === slot;

          return (
            <button
              key={`hero-${squad}-${slot}`}
              type="button"
              onClick={() => setSelectedSlot({ squad, slot })}
              className={cn(
                "h-14 rounded-2xl border bg-black/20 overflow-hidden relative",
                isSelected ? "border-fuchsia-300/50" : "border-white/10"
              )}
              title={`Squad ${squad} slot ${slot}${uploadId ? ` (upload_id=${uploadId})` : ""}`}
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={`Squad ${squad} slot ${slot}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-white/35">
                  {slot}
                </div>
              )}

              {uploadId ? (
                <div className="absolute bottom-1 right-1 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] text-white/70">
                  {uploadId}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5 text-xs uppercase tracking-[0.25em] text-white/40">
        Hero library (from uploads) — tap a hero to assign to selected slot
      </div>

      <div className="mt-2 grid grid-cols-6 gap-2">
        {heroUploads.length === 0 ? (
          <div className="col-span-6 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
            No hero uploads found yet. Upload hero profile screenshots in{" "}
            <span className="text-white/80">Image Upload</span> using category{" "}
            <span className="text-white/80">Hero profile</span>.
          </div>
        ) : (
          heroUploads.slice(0, 30).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={async () => {
                if (!selectedSlot) return;
                await onAssign(selectedSlot.squad, selectedSlot.slot, u.id);
              }}
              disabled={!selectedSlot}
              className={cn(
                "h-14 rounded-2xl border border-white/10 bg-black/20 overflow-hidden hover:border-white/20 transition relative",
                !selectedSlot && "opacity-50 cursor-not-allowed"
              )}
              title={`Assign upload_id=${u.id}`}
            >
              {u.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.url} alt={`Hero upload ${u.id}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-white/35">
                  {u.id}
                </div>
              )}
              <div className="absolute bottom-1 left-1 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] text-white/70">
                {u.id}
              </div>
            </button>
          ))
        )}
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
        setBattleOut((prev) => `${prev}\n\n---\n\nError: ${String(m)}`);
        return;
      }

      const summary = String(payload.json?.summary ?? "");
      const answer = String(payload.json?.answer ?? "");

      setBattleOut((prev) => {
        const parts: string[] = [];
        if (prev.trim()) parts.push(prev.trim());
        if (summary.trim()) parts.push("Summary:\n" + summary.trim());
        if (answer.trim()) parts.push("Answer:\n" + answer.trim());
        return parts.join("\n\n---\n\n");
      });

      setBattleMsg("");
    } catch (e: unknown) {
      const msg2 = e instanceof Error ? e.message : "unknown";
      setBattleOut((prev) => `${prev}\n\n---\n\nError: ${msg2}`);
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
        const err = statePayload?.error ?? `HTTP ${stateRes.status}`;
        setSquadsMsg(`State load failed: ${err}`);
      } else {
        const state = statePayload.state ?? {};
        setSlots(normalizeSlotsFromState(state));
      }

      if (!uploadsRes.ok || !uploadsPayload?.ok) {
        const err = uploadsPayload?.error ?? `HTTP ${uploadsRes.status}`;
        setSquadsMsg((prev) => (prev ? prev + " | " : "") + `Uploads load failed: ${err}`);
        setHeroUploads([]);
      } else {
        setHeroUploads(
          (uploadsPayload.uploads ?? []).map((u) => ({
            id: Number(u.id),
            url: u.url ?? null,
            created_at: u.created_at,
            storage_path: u.storage_path,
          }))
        );
      }
    } finally {
      setSquadsBusy(false);
    }
  }

  async function setSlot(squad: number, slot: number, upload_id: number | null) {
    const res = await fetch("/api/player/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ op: "set_slot", squad, slot, upload_id }),
    });

    const json = (await res.json().catch(() => null)) as PlayerStateResponse | null;

    if (!res.ok || !json?.ok) {
      const err = json?.error ?? `HTTP ${res.status}`;
      setSquadsMsg(`Save failed: ${err}`);
      return;
    }

    setSlots(normalizeSlotsFromState(json.state ?? {}));
    setSquadsMsg("Saved ✅");
  }

  async function openHeroDetails(upload_id: number) {
    setHeroDetailsUploadId(upload_id);
    setHeroDetailsBusy(true);
    setHeroDetailsErr(null);
    setHeroExtractMsg(null);
    setHeroDetailsFacts(null);
    setHeroDetailsImg(null);

    try {
      const res = await fetch(`/api/hero/details?upload_id=${upload_id}`, { credentials: "include" });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; image_url?: string | null; facts?: any | null }
        | null;

      if (!res.ok || !payload?.ok) {
        const msg = payload?.error ?? `HTTP ${res.status}`;
        setHeroDetailsErr(msg);
        return;
      }

      setHeroDetailsImg(payload.image_url ?? null);
      setHeroDetailsFacts(payload.facts ?? null);

      // Pre-fill fields from existing facts (if any)
      const v = payload.facts?.value ?? null;
      if (v && typeof v === "object") {
        setHeroName(typeof v.name === "string" ? v.name : "");
        setHeroLevel(v.level != null ? String(v.level) : "");
        setHeroStars(v.stars != null ? String(v.stars) : "");
        setHeroPower(v.power != null ? String(v.power) : "");
      } else {
        setHeroName("");
        setHeroLevel("");
        setHeroStars("");
        setHeroPower("");
      }

      setHeroDetailsOpen(true);
    } finally {
      setHeroDetailsBusy(false);
    }
  }

  async function extractHeroDetails() {
    if (!heroDetailsUploadId) return;

    setHeroDetailsErr(null);
    setHeroExtractMsg(null);
    setHeroExtractBusy(true);

    try {
      const res = await fetch("/api/hero/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: heroDetailsUploadId }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || !payload?.ok) {
        const msg = payload?.error ?? `HTTP ${res.status}`;
        setHeroDetailsErr(`Extract failed: ${msg}`);
        return;
      }

      await openHeroDetails(heroDetailsUploadId);
      setHeroExtractMsg("Extracted ✅ (review + Save if you want to edit).");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
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

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || !payload?.ok) {
        const msg = payload?.error ?? `HTTP ${res.status}`;
        setHeroDetailsErr(`Save failed: ${msg}`);
        return;
      }

      await openHeroDetails(heroDetailsUploadId);
      setHeroExtractMsg("Saved ✅");
    } finally {
      setHeroDetailsBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      {/* Main Chat Area */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-[96px] pt-6">
        <div className="mb-3">
          <div className="text-sm font-semibold text-white/90">Squad Assistant</div>
          <div className="mt-1 text-xs text-white/55">Chat above. Tools are in the bottom row.</div>
        </div>

        <div className="flex-1 min-h-0 rounded-3xl border border-white/10 bg-white/5 p-4">
          <ChatWindow
            endpoint="/api/chat"
            emoji="🧠"
            emptyStateComponent={
              <div className="text-sm text-slate-400/80">
                Ask about squads, heroes, skills, gear, drone, overlord, and game facts. Use Image Upload
                to add screenshots.
              </div>
            }
          />
        </div>
      </div>

      {/* Bottom Button Row (left group + right group) */}
      <div className="fixed bottom-0 left-0 right-0 z-[999] border-t border-white/15 bg-slate-950">
        <div className="mx-auto max-w-6xl px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <BottomButton
                label="Squads"
                onClick={async () => {
                  await loadSquadsAndUploads();
                  setSquadsOpen(true);
                }}
              />
              <BottomButton label="Drone" onClick={() => setDroneOpen(true)} />
              <BottomButton label="Overlord" onClick={() => setOverlordOpen(true)} />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <BottomButton label="Battle Report Analyzer" onClick={() => setBattleOpen(true)} />
              <BottomButton label="Optimizer" onClick={() => setOptimizerOpen(true)} />
              <BottomButton label="Image Upload" onClick={() => setUploadOpen(true)} />
            </div>
          </div>

          <div className="mt-1 text-center text-[10px] uppercase tracking-[0.25em] text-white/40">
            Tools
          </div>
        </div>
      </div>

      {/* Squads Modal (WIRED) */}
      <ModalShell
        title="Squads"
        subtitle="Assign hero images to squad slots (slot → upload_id)."
        open={squadsOpen}
        onClose={() => setSquadsOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
            {squadsBusy
              ? "Loading squads + hero uploads…"
              : squadsMsg
              ? squadsMsg
              : "Click a hero slot, then click a hero image to assign it. Use Clear slot to remove. Use Open Hero Details to edit name/level/stars."}
          </div>

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

      {/* Hero Details Modal (NOW WITH EXTRACT) */}
      <ModalShell
        title="Hero Profile"
        subtitle={
          heroDetailsUploadId ? `Upload ID: ${heroDetailsUploadId}` : "Hero details"
        }
        open={heroDetailsOpen}
        onClose={() => setHeroDetailsOpen(false)}
      >
        <div className="space-y-4">
          {heroDetailsErr ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-950/20 p-3 text-sm text-rose-100/80">
              {heroDetailsErr}
            </div>
          ) : null}

          {heroExtractMsg ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/10 p-3 text-xs text-emerald-100/80">
              {heroExtractMsg}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[260px,1fr]">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
              {heroDetailsImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroDetailsImg}
                  alt="Hero image"
                  className="h-auto w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-white/50">
                  No image loaded.
                </div>
              )}
              <div className="mt-2 text-xs text-white/50">
                Tip: Hit <span className="text-white/80">Extract from Image</span> to auto-fill.
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/50">Hero name</div>
                  <input
                    value={heroName}
                    onChange={(e) => setHeroName(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20"
                    placeholder="e.g., Murphy"
                  />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/50">Level</div>
                  <input
                    value={heroLevel}
                    onChange={(e) => setHeroLevel(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20"
                    placeholder="e.g., 165"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/50">Stars</div>
                  <input
                    value={heroStars}
                    onChange={(e) => setHeroStars(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20"
                    placeholder="e.g., 5"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/50">
                    Power (optional)
                  </div>
                  <input
                    value={heroPower}
                    onChange={(e) => setHeroPower(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20"
                    placeholder="e.g., 123456"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void extractHeroDetails()}
                  disabled={heroDetailsBusy || heroExtractBusy || !heroDetailsUploadId}
                  className={cn(
                    "rounded-2xl border border-emerald-400/25 bg-emerald-950/20 px-4 py-2",
                    "text-xs uppercase tracking-widest text-emerald-200/90 hover:border-emerald-300/40 transition",
                    (heroDetailsBusy || heroExtractBusy || !heroDetailsUploadId) &&
                      "opacity-50 cursor-not-allowed"
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
                Saved data is stored in{" "}
                <span className="text-white/75">facts</span> and linked back to this upload. This avoids
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
          </div>
        </div>
      </ModalShell>

      {/* Drone Modal */}
      <ModalShell
        title="Drone"
        subtitle="Components • boosts • chip sets"
        open={droneOpen}
        onClose={() => setDroneOpen(false)}
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          This modal is ready to be wired to your saved drone extraction data. For now, uploads + future optimizer can read drone rows via{" "}
          <span className="text-white/85">kind = &quot;drone&quot;</span>.
        </div>
      </ModalShell>

      {/* Overlord Modal */}
      <ModalShell
        title="Overlord"
        subtitle="Training • promotion • skills"
        open={overlordOpen}
        onClose={() => setOverlordOpen(false)}
      >
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

      {/* Optimizer Modal (shell only for now) */}
      <ModalShell
        title="Optimizer"
        subtitle="Will reuse battle analyzer math core + pull from facts, battle history, squads, drone, overlord"
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Optimizer is not wired yet. Next step is to reuse the battle analyzer math core and then pull from:
          AI facts DB, battle analyzer history, squads, drone, and overlord state. Then it becomes chat-driven like the analyzer.
        </div>
      </ModalShell>

      {/* Upload Modal */}
      <ModalShell
        title="Image Upload"
        subtitle="Upload up to 20 images at a time"
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white/85">Upload category</div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
                      ? "border-fuchsia-300/40 bg-fuchsia-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="font-semibold text-white/85">{opt.label}</div>
                  <div className="mt-1 text-xs text-white/55">Upload screenshots for this area</div>
                </button>
              ))}
            </div>

            <div className="mt-4 text-xs text-white/55">
              Selected: <span className="text-white/80">{kindLabel}</span>
              {uploadKind === "hero_skills" ? (
                <span className="ml-2 text-white/45">(stored as Hero profile for now)</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white/85">Select up to 20 images</div>

            <div className="mt-4">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploadBusy}
                onChange={(e) => {
                  const files = e.target.files;
                  void handleUploadFiles(files);
                  e.currentTarget.value = "";
                }}
                className="block w-full text-sm text-slate-200/80 file:mr-4 file:rounded-xl file:border-0 file:bg-fuchsia-600/20 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-widest file:text-fuchsia-100 hover:file:bg-fuchsia-600/30 disabled:opacity-60"
              />
            </div>

            <div className="mt-3 text-sm text-white/70">
              {uploadBusy ? (
                <span>
                  Uploading… {uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : ""}
                </span>
              ) : uploadMsg ? (
                <span>{uploadMsg}</span>
              ) : (
                <span>Choose images to upload.</span>
              )}
            </div>

            {uploadResults.length > 0 ? (
              <div className="mt-4 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Results</div>
                <ul className="mt-2 space-y-2">
                  {uploadResults.map((r) => (
                    <li
                      key={`${r.fileName}-${r.message}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white/85">{r.fileName}</div>
                        <div className="text-xs text-white/55">{r.message}</div>
                      </div>
                      <div
                        className={cn(
                          "shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em]",
                          r.ok
                            ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border border-rose-400/30 bg-rose-500/10 text-rose-200"
                        )}
                      >
                        {r.ok ? "ok" : "fail"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </ModalShell>
    </div>
  );
                                       }
