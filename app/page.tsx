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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-b from-[#0b1020] to-[#050814] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-sm uppercase tracking-[0.35em] text-white/60">{title}</div>
            {subtitle ? <div className="mt-1 text-xs text-white/55">{subtitle}</div> : null}
          </div>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-white/70 hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

type UploadUIKind = "battle_report" | "hero_profile" | "hero_skills" | "gear" | "drone" | "overlord";

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

function normalizeSlotsFromState(state: any) {
  // keys are likely like squads.s1.slot1 etc; keep whatever your project already expects.
  // This function existed in your file; preserved behavior.
  const slots: Record<string, number | null> = {};
  const squads = state?.squads ?? {};
  for (const squadKey of Object.keys(squads)) {
    const squad = squads[squadKey] ?? {};
    for (const slotKey of Object.keys(squad)) {
      const v = squad[slotKey];
      const norm = v === null || v === undefined ? null : Number(v);
      slots[`${squadKey}-${slotKey}`] = Number.isFinite(norm as any) ? (norm as any) : null;
    }
  }
  return slots;
}

function mapToBackendKind(kind: UploadUIKind) {
  // keep as-is: this is how the server expects it
  return kind;
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
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.25em] text-white/75 hover:bg-white/10"
      onClick={onClick}
    >
      {label}
    </button>
  );
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
          className={cn(
            "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-white/70 hover:bg-white/10",
            (!selectedThisSquad || !slots[`${squad}-${selectedThisSquad}`]) &&
              "opacity-50 cursor-not-allowed"
          )}
          disabled={!selectedThisSquad || !slots[`${squad}-${selectedThisSquad}`]}
          onClick={() => {
            const id = slots[`${squad}-${selectedThisSquad}`];
            if (id) void onOpenHeroDetails(id);
          }}
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
              className={cn(
                "rounded-2xl border px-3 py-3 text-left",
                isSelected
                  ? "border-cyan-300/50 bg-cyan-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              )}
              onClick={() => setSelectedSlot({ squad, slot })}
            >
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">Slot {slot}</div>
              <div className="mt-1 text-xs text-white/75">{val ? `Upload #${val}` : "Empty"}</div>
              <div className="mt-2 flex gap-2">
                <button
                  className={cn(
                    "rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-white/70 hover:bg-white/10",
                    !val && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onClear(squad, slot);
                  }}
                >
                  Clear
                </button>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">Hero uploads</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {heroUploads.map((u) => (
            <button
              key={u.id}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
              onClick={() => {
                if (!selectedSlot || selectedSlot.squad !== squad) return;
                void onAssign(squad, selectedSlot.slot as HeroSlotIndex, u.id);
              }}
              title={u.storage_path ?? ""}
            >
              #{u.id}
            </button>
          ))}
        </div>
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

  // Drone details wiring
  const [droneUploads, setDroneUploads] = useState<HeroUpload[]>([]);
  const [droneUploadId, setDroneUploadId] = useState<number | null>(null);
  const [droneBusy, setDroneBusy] = useState(false);
  const [droneExtractBusy, setDroneExtractBusy] = useState(false);
  const [droneSaveBusy, setDroneSaveBusy] = useState(false);
  const [droneMsg, setDroneMsg] = useState<string | null>(null);
  const [droneImg, setDroneImg] = useState<string | null>(null);
  const [droneFacts, setDroneFacts] = useState<any | null>(null);
  const [droneExtracted, setDroneExtracted] = useState<any | null>(null);

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
        return uploadKind;
    }
  }, [uploadKind]);

  async function safeReadResponse(res: Response) {
    const text = await res.text().catch(() => "");
    try {
      return JSON.parse(text);
    } catch {
      return text ? { raw: text } : null;
    }
  }

  async function uploadSingle(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", mapToBackendKind(uploadKind));

    const res = await fetch("/api/uploads/image", {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    const payload = await safeReadResponse(res);
    if (!res.ok) {
      return { ok: false, message: (payload as any)?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, message: "Uploaded" };
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploadBusy(true);
    setUploadMsg(null);
    setUploadResults([]);
    setUploadProgress({ current: 0, total: files.length });

    try {
      const results: UploadResult[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length });
        const file = files[i];
        const r = await uploadSingle(file);
        results.push({ fileName: file.name, ok: r.ok, message: r.message });
      }
      setUploadResults(results);
      setUploadMsg("Done ✅");
    } finally {
      setUploadBusy(false);
    }
  }

  async function runBattleSummary() {
    setBattleBusy(true);
    setBattleMsg("");
    setBattleOut("");

    try {
      const res = await fetch("/api/battle/summary", { credentials: "include" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; summary?: string; error?: string } | null;

      if (!res.ok || !payload?.ok) {
        const err = payload?.error ?? `HTTP ${res.status}`;
        setBattleOut(`Summary failed: ${err}`);
        return;
      }

      setBattleOut(payload.summary ?? "");
    } catch (e: unknown) {
      const msg2 = e instanceof Error ? e.message : "unknown";
      setBattleOut((prev) => `${prev}\n\n---\n\nError: ${msg2}`);
    } finally {
      setBattleBusy(false);
    }
  }

  async function askBattleAnalyzer() {
    if (!battleMsg.trim()) return;
    setBattleBusy(true);

    try {
      const res = await fetch("/api/battle/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: battleMsg.trim() }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; answer?: string; error?: string } | null;

      if (!res.ok || !payload?.ok) {
        const err = payload?.error ?? `HTTP ${res.status}`;
        setBattleOut((prev) => `${prev}\n\n---\n\nAsk failed: ${err}`);
        return;
      }

      const answer = payload.answer ?? "";
      setBattleOut((prev) => {
        const parts = [prev].filter(Boolean);
        if (battleMsg.trim()) parts.push("Question:\n" + battleMsg.trim());
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
        setSquadsMsg((prev) => prev ?? `Uploads load failed: ${err}`);
        setHeroUploads([]);
      } else {
        setHeroUploads(uploadsPayload.uploads ?? []);
      }
    } finally {
      setSquadsBusy(false);
    }
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
        const err = json?.error ?? `HTTP ${res.status}`;
        setSquadsMsg(`Save failed: ${err}`);
        return;
      }

      setSlots(normalizeSlotsFromState(json.state ?? {}));
      setSquadsMsg("Saved ✅");
    } finally {
      setSquadsBusy(false);
    }
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
        | { ok?: boolean; image_url?: string | null; facts?: any | null; error?: string }
        | null;

      if (!res.ok || !payload?.ok) {
        const err = payload?.error ?? `HTTP ${res.status}`;
        setHeroDetailsErr(`Load failed: ${err}`);
        return;
      }

      setHeroDetailsImg(payload.image_url ?? null);
      setHeroDetailsFacts(payload.facts ?? null);

      const v = payload.facts?.value ?? null;
      setHeroName(v?.name ?? "");
      setHeroLevel(String(v?.level ?? ""));
      setHeroStars(String(v?.stars ?? ""));
      setHeroPower(String(v?.power ?? ""));
    } finally {
      setHeroDetailsBusy(false);
      setHeroDetailsOpen(true);
    }
  }

  async function extractHeroDetails() {
    if (!heroDetailsUploadId) return;
    setHeroExtractBusy(true);
    setHeroExtractMsg(null);
    try {
      const res = await fetch("/api/hero/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: heroDetailsUploadId }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; extracted?: any; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        const msg = payload?.error ?? `HTTP ${res.status}`;
        setHeroDetailsErr(`Extract failed: ${msg}`);
        return;
      }

      const ex = payload.extracted ?? {};
      setHeroName(ex?.name ?? "");
      setHeroLevel(String(ex?.level ?? ""));
      setHeroStars(String(ex?.stars ?? ""));
      setHeroPower(String(ex?.power ?? ""));
      setHeroExtractMsg("Extracted ✅ (review fields, then Save)");
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

  async function loadDroneUploads() {
    setDroneBusy(true);
    setDroneMsg(null);
    try {
      const res = await fetch("/api/uploads/list?kind=drone&limit=120", { credentials: "include" });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; uploads?: HeroUpload[]; error?: string }
        | null;

      if (!res.ok || !payload?.ok) {
        const err = payload?.error ?? `HTTP ${res.status}`;
        setDroneMsg(`Load failed: ${err}`);
        setDroneUploads([]);
        return;
      }

      setDroneUploads(payload.uploads ?? []);
    } finally {
      setDroneBusy(false);
    }
  }

  async function openDroneDetails(upload_id: number) {
    setDroneUploadId(upload_id);
    setDroneMsg(null);
    setDroneExtracted(null);
    setDroneImg(null);
    setDroneFacts(null);

    setDroneBusy(true);
    try {
      const res = await fetch(`/api/drone/details?upload_id=${upload_id}`, { credentials: "include" });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; image_url?: string | null; facts?: any | null; error?: string }
        | null;

      if (!res.ok || !payload?.ok) {
        const err = payload?.error ?? `HTTP ${res.status}`;
        setDroneMsg(`Details load failed: ${err}`);
        return;
      }

      setDroneImg(payload.image_url ?? null);
      setDroneFacts(payload.facts ?? null);
    } finally {
      setDroneBusy(false);
    }
  }

  async function extractDrone() {
    if (!droneUploadId) {
      setDroneMsg("Pick an upload first.");
      return;
    }
    setDroneExtractBusy(true);
    setDroneMsg(null);
    try {
      const res = await fetch("/api/drone/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: droneUploadId }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; extracted?: any; error?: string; raw?: string }
        | null;

      if (!res.ok || !payload?.ok) {
        const err = payload?.error ?? `HTTP ${res.status}`;
        setDroneMsg(`Extract failed: ${err}`);
        return;
      }

      setDroneExtracted(payload.extracted ?? null);
      setDroneMsg("Extracted ✅ (review, then Save)");
    } finally {
      setDroneExtractBusy(false);
    }
  }

  async function saveDrone() {
    if (!droneUploadId) {
      setDroneMsg("Pick an upload first.");
      return;
    }
    if (!droneExtracted) {
      setDroneMsg("Nothing to save. Click Extract first.");
      return;
    }

    setDroneSaveBusy(true);
    setDroneMsg(null);
    try {
      const res = await fetch("/api/drone/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_id: droneUploadId, extracted: droneExtracted }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; fact?: any; error?: string }
        | null;

      if (!res.ok || !payload?.ok) {
        const err = payload?.error ?? `HTTP ${res.status}`;
        setDroneMsg(`Save failed: ${err}`);
        return;
      }

      await openDroneDetails(droneUploadId);
      setDroneMsg("Saved ✅");
    } finally {
      setDroneSaveBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070b18] to-[#040611] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-white/50">SquadAssistant</div>
              <div className="mt-2 text-2xl font-semibold text-white/90">Your Command Center</div>
              <div className="mt-1 text-sm text-white/60">
                Squads • Heroes • Drone • Analyzer • Optimizer • Chat
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <BottomButton label="Upload Image" onClick={() => setUploadOpen(true)} />
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
                  setDroneOpen(true);
                }}
              />
              <BottomButton label="Overlord" onClick={() => setOverlordOpen(true)} />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <BottomButton label="Battle Report" onClick={() => setBattleOpen(true)} />
              <BottomButton label="Optimizer" onClick={() => setOptimizerOpen(true)} />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-[0.35em] text-white/50">Main Chat</div>
          <div className="mt-3">
            <ChatWindow />
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <ModalShell title="Upload Image" subtitle={`Kind: ${kindLabel}`} open={uploadOpen} onClose={() => setUploadOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Upload kind</div>
              <div className="flex flex-wrap gap-2">
                {(["battle_report", "hero_profile", "hero_skills", "gear", "drone", "overlord"] as UploadUIKind[]).map((k) => (
                  <button
                    key={k}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs",
                      uploadKind === k
                        ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    )}
                    onClick={() => setUploadKind(k)}
                  >
                    {k}
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
                className="block w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70"
              />
              {uploadProgress ? (
                <div className="mt-2 text-xs text-white/55">
                  Uploading {uploadProgress.current} / {uploadProgress.total}
                </div>
              ) : null}
              {uploadMsg ? (
                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-white/70">
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
                  <div key={i} className={cn("rounded-lg px-2 py-1", r.ok ? "bg-emerald-500/10" : "bg-rose-500/10")}>
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{squadsMsg}</div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            {squadsBusy
              ? "Loading..."
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
        subtitle={heroDetailsUploadId ? `Upload ID: ${heroDetailsUploadId}` : "Hero details"}
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{heroExtractMsg}</div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Hero image</div>
              {heroDetailsImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroDetailsImg}
                  alt="Hero screenshot"
                  className="mt-3 w-full rounded-xl border border-white/10"
                />
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-6 text-sm text-white/60">
                  No image.
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={cn(
                    "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/80 hover:bg-white/10",
                    (!heroDetailsUploadId || heroExtractBusy) && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => void extractHeroDetails()}
                  disabled={!heroDetailsUploadId || heroExtractBusy}
                >
                  {heroExtractBusy ? "Extracting..." : "Extract from Image"}
                </button>

                <button
                  className={cn(
                    "rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-emerald-100 hover:bg-emerald-500/15",
                    (!heroDetailsUploadId || heroDetailsBusy) && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => void saveHeroDetails()}
                  disabled={!heroDetailsUploadId || heroDetailsBusy}
                >
                  Save
                </button>

                <button
                  className={cn(
                    "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/80 hover:bg-white/10",
                    (!heroDetailsUploadId || heroDetailsBusy) && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => (heroDetailsUploadId ? void openHeroDetails(heroDetailsUploadId) : null)}
                  disabled={!heroDetailsUploadId || heroDetailsBusy}
                >
                  Reload
                </button>
              </div>

              <div className="mt-3 text-xs text-white/55">
                Saved data is stored in facts and linked back to this upload. This avoids duplicates and makes it persist after reload.
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Hero name</div>
                <input
                  value={heroName}
                  onChange={(e) => setHeroName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                  placeholder="e.g., Murphy"
                />

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Level</div>
                    <input
                      value={heroLevel}
                      onChange={(e) => setHeroLevel(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Stars</div>
                    <input
                      value={heroStars}
                      onChange={(e) => setHeroStars(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-white/45">Power (optional)</div>
                    <input
                      value={heroPower}
                      onChange={(e) => setHeroPower(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                      placeholder="0"
                    />
                  </div>
                </div>
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
        subtitle={droneUploadId ? `Upload ID: ${droneUploadId}` : "Components • boosts • chip sets"}
        open={droneOpen}
        onClose={() => setDroneOpen(false)}
      >
        <div className="space-y-4">
          {droneMsg ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{droneMsg}</div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Drone uploads</div>
                <div className="mt-1 text-sm text-white/80">
                  {droneUploads.length ? `${droneUploads.length} found` : "None found yet"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(
                    "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/80 hover:bg-white/10",
                    droneBusy && "opacity-60"
                  )}
                  onClick={() => void loadDroneUploads()}
                  disabled={droneBusy}
                >
                  Reload list
                </button>
              </div>
            </div>

            {droneUploads.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {droneUploads.slice(0, 20).map((u) => (
                  <button
                    key={u.id}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs",
                      droneUploadId === u.id
                        ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    )}
                    onClick={() => void openDroneDetails(u.id)}
                    title={u.storage_path ?? ""}
                  >
                    #{u.id}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/60">
                Upload drone screenshots via <span className="text-white/80">Upload Image</span> and choose{" "}
                <span className="text-white/85">Drone</span> as the kind. Then come back here.
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Drone image</div>

              {droneImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={droneImg} alt="Drone screenshot" className="mt-3 w-full rounded-xl border border-white/10" />
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-6 text-sm text-white/60">
                  Select an upload above to preview the screenshot.
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={cn(
                    "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/80 hover:bg-white/10",
                    (!droneUploadId || droneExtractBusy) && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => void extractDrone()}
                  disabled={!droneUploadId || droneExtractBusy}
                >
                  {droneExtractBusy ? "Extracting..." : "Extract from Image"}
                </button>

                <button
                  className={cn(
                    "rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-emerald-100 hover:bg-emerald-500/15",
                    (!droneUploadId || !droneExtracted || droneSaveBusy) && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => void saveDrone()}
                  disabled={!droneUploadId || !droneExtracted || droneSaveBusy}
                >
                  {droneSaveBusy ? "Saving..." : "Save"}
                </button>

                <button
                  className={cn(
                    "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/80 hover:bg-white/10",
                    (!droneUploadId || droneBusy) && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => (droneUploadId ? void openDroneDetails(droneUploadId) : null)}
                  disabled={!droneUploadId || droneBusy}
                >
                  Reload
                </button>
              </div>

              <div className="mt-3 text-xs text-white/55">
                Tip: Your “main data” drone screens: Attributes, Components, Extra Attributes, Combat Boost, Skill Chip.
              </div>
            </div>

            <div className="space-y-4">
              {droneExtracted ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Extracted payload</div>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-white/70">
                    {JSON.stringify(droneExtracted, null, 2)}
                  </pre>
                </div>
              ) : null}

              {droneFacts ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Current facts row</div>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-white/70">
                    {JSON.stringify(droneFacts, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
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

      {/* Battle Report Modal */}
      <ModalShell title="Battle Report Analyzer" subtitle="Summary + Q&A" open={battleOpen} onClose={() => setBattleOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Summary</div>
              <button
                className={cn(
                  "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/80 hover:bg-white/10",
                  battleBusy && "opacity-60"
                )}
                onClick={() => void runBattleSummary()}
                disabled={battleBusy}
              >
                {battleBusy ? "Working..." : "Run"}
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70 whitespace-pre-wrap">
              {battleOut || "No summary yet."}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-white/45">Ask</div>
            <textarea
              value={battleMsg}
              onChange={(e) => setBattleMsg(e.target.value)}
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/80"
              rows={3}
              placeholder="Ask about strengths, weaknesses, what went right/wrong..."
            />
            <div className="mt-3 flex gap-2">
              <button
                className={cn(
                  "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/80 hover:bg-white/10",
                  battleBusy && "opacity-60"
                )}
                onClick={() => void askBattleAnalyzer()}
                disabled={battleBusy}
              >
                {battleBusy ? "Working..." : "Ask"}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Optimizer Modal */}
      <ModalShell title="Optimizer" subtitle="Coming after analyzer + drone + squads" open={optimizerOpen} onClose={() => setOptimizerOpen(false)}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Optimizer will pull from Battle Report Analyzer, Squads, Heroes, and Drone. We’ll fine-tune last.
        </div>
      </ModalShell>
    </div>
  );
      }
