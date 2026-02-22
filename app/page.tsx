"use client";

import React, { useMemo, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";

type SquadSlot = 1 | 2 | 3 | 4;

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl">
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

function SquadGrid({ slot }: { slot: SquadSlot }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-lg font-semibold text-white/90">{`Squad ${slot}`}</div>
      <div className="mt-1 text-sm text-white/60">
        5 hero slots • blank until uploads
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.25em] text-white/40">
        Drone chips
      </div>

      <div className="mt-2 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`hero-${slot}-${idx}`}
            className="h-12 rounded-2xl border border-white/10 bg-black/20"
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`chip-${slot}-${idx}`}
            className="h-10 rounded-2xl border border-white/10 bg-black/20"
          />
        ))}
      </div>

      <div className="mt-4 text-sm text-white/55">
        This view will later load the player’s squads + drone chip assignments.
      </div>
    </div>
  );
}

/**
 * IMPORTANT: This MUST match your backend upload API allowed kinds:
 * UploadKind = ["hero_profile","battle_report","drone","overlord","gear","unknown"]
 * :contentReference[oaicite:4]{index=4}
 */
type UploadKind =
  | "battle_report"
  | "hero_profile"
  | "drone"
  | "overlord"
  | "gear"
  | "optimizer"
  | "unknown";

type UploadResult = {
  fileName: string;
  ok: boolean;
  message: string;
};

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
        "flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs",
        "uppercase tracking-[0.25em] text-white/80 hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}

export default function Home() {
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Upload state
  const [uploadKind, setUploadKind] = useState<UploadKind>("battle_report");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const kindLabel = useMemo(() => {
    switch (uploadKind) {
      case "battle_report":
        return "Battle Report";
      case "hero_profile":
        return "Hero";
      case "drone":
        return "Drone";
      case "overlord":
        return "Overlord";
      case "gear":
        return "Gear";
      case "optimizer":
        return "Optimizer";
      default:
        return "Unknown";
    }
  }, [uploadKind]);

  async function uploadSingle(file: File, kind: UploadKind) {
    const fd = new FormData();
    fd.append("file", file);

    // Your backend expects the field name "kind" (NOT "purpose")
    // :contentReference[oaicite:5]{index=5}
    const mappedKind =
      kind === "optimizer" ? "unknown" : kind; // optimizer images can be stored as unknown until we split tables
    fd.append("kind", mappedKind);

    const res = await fetch("/api/uploads/image", {
      method: "POST",
      body: fd,
      // ensure cookies are included (session cookie auth)
      // backend requires session cookie and will 401 otherwise :contentReference[oaicite:6]{index=6}
      credentials: "include",
    });

    const json = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      const msg =
        json?.error ??
        (res.status === 401
          ? "Unauthorized (session not detected)."
          : "Upload failed.");
      return { ok: false, message: msg, json };
    }

    const rid = json?.reportId ?? json?.id ?? json?.uploadId ?? null;
    const msg = rid ? `Uploaded ✅ id=${rid}` : "Uploaded ✅";
    return { ok: true, message: msg, json };
  }

  async function handleUploadFiles(files: FileList | null) {
    setUploadMsg(null);
    setUploadResults([]);
    setUploadProgress(null);

    if (!files || files.length === 0) return;

    const arr = Array.from(files);

    // Hard limit: 20 images
    if (arr.length > 20) {
      setUploadMsg("Please select 20 images or fewer.");
      return;
    }

    // Validate: images only
    const nonImages = arr.filter((f) => !f.type.startsWith("image/"));
    if (nonImages.length > 0) {
      setUploadMsg("Only image files are supported in this uploader.");
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

        results.push({
          fileName: file.name,
          ok: r.ok,
          message: r.message,
        });

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      {/* Main chat area */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-28 pt-6">
        <div className="mb-3">
          <div className="text-sm font-semibold text-white/85">
            Squad Assistant
          </div>
          <div className="mt-1 text-xs text-white/55">
            Ask about squads, drone, overlord, and game facts. Use Image Upload
            to add screenshots.
          </div>
        </div>

        <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-4">
          <ChatWindow
            endpoint="/api/chat"
            emoji="🧠"
            emptyStateComponent={
              <div className="text-sm text-slate-400/80">
                Ask a question, then use the bottom buttons to open tools.
              </div>
            }
          />
        </div>
      </div>

      {/* Bottom button row */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 px-3 py-3">
          <BottomButton label="Squads" onClick={() => setSquadsOpen(true)} />
          <BottomButton label="Drone" onClick={() => setDroneOpen(true)} />
          <BottomButton label="Overlord" onClick={() => setOverlordOpen(true)} />
          <BottomButton
            label="Battle Report Analyzer"
            onClick={() => setBattleOpen(true)}
          />
          <BottomButton
            label="Optimizer"
            onClick={() => setOptimizerOpen(true)}
          />
          <BottomButton
            label="Image Upload"
            onClick={() => setUploadOpen(true)}
          />
        </div>
      </div>

      {/* Modals */}
      <ModalShell
        title="Squads"
        subtitle="Manage squad layouts and see saved hero + chip assignments."
        open={squadsOpen}
        onClose={() => setSquadsOpen(false)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SquadGrid slot={1} />
          <SquadGrid slot={2} />
          <SquadGrid slot={3} />
          <SquadGrid slot={4} />
        </div>
      </ModalShell>

      <ModalShell
        title="Drone"
        subtitle="Drone overview and boosts."
        open={droneOpen}
        onClose={() => setDroneOpen(false)}
      >
        <div className="space-y-3 text-sm text-white/70">
          <ul className="list-disc space-y-1 pl-5 text-white/65">
            <li>Components, boosts, chip-sets</li>
            <li>Later: show saved drone state + recommendations</li>
          </ul>
        </div>
      </ModalShell>

      <ModalShell
        title="Overlord"
        subtitle="Overlord training, promotion, and skills."
        open={overlordOpen}
        onClose={() => setOverlordOpen(false)}
      >
        <div className="space-y-3 text-sm text-white/70">
          <ul className="list-disc space-y-1 pl-5 text-white/65">
            <li>Training gates (HP/ATK/DEF)</li>
            <li>Promotion levels</li>
            <li>Skills</li>
          </ul>
        </div>
      </ModalShell>

      <ModalShell
        title="Battle reports analyzer"
        subtitle="Analyze reports and explain outcomes."
        open={battleOpen}
        onClose={() => setBattleOpen(false)}
      >
        <div className="space-y-3 text-sm text-white/70">
          <ul className="list-disc space-y-1 pl-5 text-white/65">
            <li>Analyze one report or all reports (filters)</li>
            <li>Group by exact hero lineup</li>
            <li>Explain outcomes using game facts + placement + buffs/debuffs</li>
          </ul>
        </div>
      </ModalShell>

      <ModalShell
        title="Optimizer"
        subtitle="Optimize squads using game facts + your uploads."
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      >
        <div className="space-y-3 text-sm text-white/70">
          <ul className="list-disc space-y-1 pl-5 text-white/65">
            <li>Pull squads + gear + drone + overlord state</li>
            <li>Apply game facts</li>
            <li>Suggest best swaps</li>
          </ul>
        </div>
      </ModalShell>

      <ModalShell
        title="Image upload"
        subtitle="Upload up to 20 images at a time."
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white/85">
              Upload category
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { k: "battle_report", label: "Battle Report" },
                { k: "hero_profile", label: "Hero" },
                { k: "drone", label: "Drone" },
                { k: "overlord", label: "Overlord" },
                { k: "gear", label: "Gear" },
                { k: "optimizer", label: "Optimizer" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => setUploadKind(opt.k as UploadKind)}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left text-sm transition",
                    uploadKind === opt.k
                      ? "border-fuchsia-300/40 bg-fuchsia-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="font-semibold text-white/85">{opt.label}</div>
                  <div className="mt-1 text-xs text-white/55">
                    Upload screenshots for this section
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 text-xs text-white/50">
              Upload endpoint:{" "}
              <span className="text-white/70">/api/uploads/image</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white/85">
              Select up to 20 images
            </div>

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
                  Uploading…{" "}
                  {uploadProgress
                    ? `${uploadProgress.current}/${uploadProgress.total}`
                    : ""}
                </span>
              ) : uploadMsg ? (
                <span>{uploadMsg}</span>
              ) : (
                <span>Chosen category: {kindLabel}. Select images to upload.</span>
              )}
            </div>

            {uploadResults.length > 0 ? (
              <div className="mt-4 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">
                  Results
                </div>
                <ul className="mt-2 space-y-2">
                  {uploadResults.map((r) => (
                    <li
                      key={`${r.fileName}-${r.message}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white/85">
                          {r.fileName}
                        </div>
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
