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

function SquadGrid({ slot }: { slot: SquadSlot }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-lg font-semibold text-white/90">{`Squad ${slot}`}</div>
      <div className="mt-1 text-sm text-white/60">
        5 hero slots • blank until loaded
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.25em] text-white/40">
        Hero slots
      </div>

      <div className="mt-2 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`hero-${slot}-${idx}`}
            className="h-12 rounded-2xl border border-white/10 bg-black/20"
          />
        ))}
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.25em] text-white/40">
        Drone chips
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`chip-${slot}-${idx}`}
            className="h-10 rounded-2xl border border-white/10 bg-black/20"
          />
        ))}
      </div>

      <div className="mt-4 text-sm text-white/55">
        (Placeholder view) This will later show the player’s real squads and chip
        assignments.
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
 * hero_profile | battle_report | drone | overlord | gear | unknown
 * We map "hero_skills" to hero_profile for now.
 */
type UploadUIKind =
  | "battle_report"
  | "hero_profile"
  | "hero_skills"
  | "gear"
  | "drone"
  | "overlord";

type UploadResult = { fileName: string; ok: boolean; message: string };

export default function Home() {
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Analyzer / Optimizer output
  const [battleOut, setBattleOut] = useState<string>("");
  const [battleBusy, setBattleBusy] = useState(false);

  const [optOut, setOptOut] = useState<string>("");
  const [optBusy, setOptBusy] = useState(false);

  // Upload state
  const [uploadKind, setUploadKind] = useState<UploadUIKind>("battle_report");
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

  async function safeReadResponse(res: Response): Promise<{
    json?: any;
    text?: string;
  }> {
    const ct = res.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) return { json: await res.json() };
    } catch {}
    try {
      return { text: await res.text() };
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
      const serverMsg =
        payload.json?.error ??
        payload.json?.message ??
        payload.text?.slice(0, 180) ??
        "";
      const msgBase =
        serverMsg && typeof serverMsg === "string"
          ? serverMsg
          : "Upload failed.";
      return { ok: false, message: `${msgBase} (HTTP ${res.status})` };
    }

    const rid =
      payload.json?.reportId ?? payload.json?.id ?? payload.json?.uploadId ?? null;
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

  async function runBattleAnalyzer() {
    setBattleBusy(true);
    try {
      const res = await fetch("/api/tools/battle-report-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: 50 }),
      });
      const payload = await safeReadResponse(res);
      if (!res.ok) {
        const msg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setBattleOut(`Error: ${String(msg)}`);
        return;
      }
      setBattleOut(String(payload.json?.output ?? "No output"));
    } catch (e: any) {
      setBattleOut(`Error: ${e?.message ?? "unknown"}`);
    } finally {
      setBattleBusy(false);
    }
  }

  async function runOptimizer() {
    setOptBusy(true);
    try {
      const res = await fetch("/api/tools/optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: 300 }),
      });
      const payload = await safeReadResponse(res);
      if (!res.ok) {
        const msg = payload.json?.error ?? payload.text ?? `HTTP ${res.status}`;
        setOptOut(`Error: ${String(msg)}`);
        return;
      }
      setOptOut(String(payload.json?.output ?? "No output"));
    } catch (e: any) {
      setOptOut(`Error: ${e?.message ?? "unknown"}`);
    } finally {
      setOptBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      {/* Main Chat Area */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-[96px] pt-6">
        <div className="mb-3">
          <div className="text-sm font-semibold text-white/90">
            Squad Assistant
          </div>
          <div className="mt-1 text-xs text-white/55">
            Chat above. Tools are in the bottom row.
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-3xl border border-white/10 bg-white/5 p-4">
          <ChatWindow
            endpoint="/api/chat"
            emoji="🧠"
            emptyStateComponent={
              <div className="text-sm text-slate-400/80">
                Ask about squads, heroes, skills, gear, drone, overlord, and game facts. Use Image Upload to add screenshots.
              </div>
            }
          />
        </div>
      </div>

      {/* Bottom Button Row */}
      <div className="fixed bottom-0 left-0 right-0 z-[999] border-t border-white/15 bg-slate-950">
        <div className="mx-auto max-w-6xl px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <BottomButton label="Squads" onClick={() => setSquadsOpen(true)} />
            <BottomButton label="Drone" onClick={() => setDroneOpen(true)} />
            <BottomButton label="Overlord" onClick={() => setOverlordOpen(true)} />
            <BottomButton label="Battle Report Analyzer" onClick={() => setBattleOpen(true)} />
            <BottomButton label="Optimizer" onClick={() => setOptimizerOpen(true)} />
            <BottomButton label="Image Upload" onClick={() => setUploadOpen(true)} />
          </div>
          <div className="mt-1 text-center text-[10px] uppercase tracking-[0.25em] text-white/40">
            Tools
          </div>
        </div>
      </div>

      {/* Squads Modal */}
      <ModalShell
        title="Squads"
        subtitle="4 squads • 5 hero slots each • drone chips per squad"
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

      {/* Drone Modal */}
      <ModalShell
        title="Drone"
        subtitle="Components • boosts • chip sets"
        open={droneOpen}
        onClose={() => setDroneOpen(false)}
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          This modal is ready to be wired to your saved drone extraction table/view.
          For now, uploads + optimizer can read drone rows via parsed.kind="drone".
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
          This modal is ready to be wired to your saved overlord extraction table/view.
          For now, uploads + optimizer can read overlord rows via parsed.kind="overlord".
        </div>
      </ModalShell>

      {/* Battle Report Analyzer Modal (UNLOCKED) */}
      <ModalShell
        title="Battle Report Analyzer"
        subtitle="Runs analysis over your uploaded battle report records"
        open={battleOpen}
        onClose={() => setBattleOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runBattleAnalyzer}
              disabled={battleBusy}
              className={cn(
                "rounded-2xl border border-fuchsia-400/25 bg-fuchsia-950/20 px-4 py-2",
                "text-xs uppercase tracking-widest text-fuchsia-200/90 hover:border-fuchsia-300/40 transition",
                battleBusy && "opacity-50 cursor-not-allowed"
              )}
            >
              {battleBusy ? "Running..." : "Run Analyzer"}
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
            Reminder: attacker/defender names/IDs, timestamps, and map coordinates are not saved (by design).
          </div>

          <div className="max-h-[55vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4">
            <pre className="whitespace-pre-wrap text-sm text-white/80">
              {battleOut || "Output will appear here."}
            </pre>
          </div>
        </div>
      </ModalShell>

      {/* Optimizer Modal (UNLOCKED) */}
      <ModalShell
        title="Optimizer"
        subtitle="Builds recommendations from your saved hero/skills/gear/drone/overlord data"
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runOptimizer}
              disabled={optBusy}
              className={cn(
                "rounded-2xl border border-cyan-400/25 bg-cyan-950/20 px-4 py-2",
                "text-xs uppercase tracking-widest text-cyan-200/90 hover:border-cyan-300/40 transition",
                optBusy && "opacity-50 cursor-not-allowed"
              )}
            >
              {optBusy ? "Running..." : "Run Optimizer"}
            </button>

            <button
              type="button"
              onClick={() => setOptOut("")}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
            >
              Clear
            </button>
          </div>

          <div className="max-h-[55vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4">
            <pre className="whitespace-pre-wrap text-sm text-white/80">
              {optOut || "Output will appear here."}
            </pre>
          </div>
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
            <div className="text-sm font-semibold text-white/85">
              Upload category
            </div>

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
                  <div className="mt-1 text-xs text-white/55">
                    Upload screenshots for this area
                  </div>
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
                <span>Choose images to upload.</span>
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
