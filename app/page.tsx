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
        (Placeholder view) This will later show the player&rsquo;s real squads
        and chip assignments.
      </div>
    </div>
  );
}

function SideButton({
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
        "w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3",
        "text-[11px] uppercase tracking-[0.25em] text-white",
        "hover:bg-white/15 active:scale-[0.99] transition"
      )}
    >
      {label}
    </button>
  );
}

/**
 * Backend allowed kinds (current):
 * hero_profile | battle_report | drone | overlord | gear | unknown
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

export default function Home() {
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Analyzer output + chat input
  const [battleOut, setBattleOut] = useState<string>("");
  const [battleBusy, setBattleBusy] = useState(false);
  const [battleMsg, setBattleMsg] = useState<string>("");

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

  async function safeReadResponse(
    res: Response
  ): Promise<{ json?: any; text?: string }> {
    const ct = res.headers.get("content-type") || "";

    try {
      if (ct.includes("application/json")) return { json: await res.json() };
    } catch {}

    try {
      const t = await res.text();
      if (t?.startsWith("<!DOCTYPE html")) {
        return {
          text: "HTML response received (likely 404 route missing or wrong path).",
        };
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
      payload.json?.reportId ??
      payload.json?.id ??
      payload.json?.uploadId ??
      null;
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
    } catch (e: any) {
      setBattleOut(`Error: ${e?.message ?? "unknown"}`);
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
    } catch (e: any) {
      setBattleOut(
        (prev) => `${prev}\n\n---\n\nError: ${e?.message ?? "unknown"}`
      );
    } finally {
      setBattleBusy(false);
    }
  }

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <div className="mx-auto flex h-full w-full max-w-6xl gap-3 px-3 py-3">
        {/* LEFT SIDE BUTTONS */}
        <aside className="hidden w-[170px] flex-col gap-2 sm:flex">
          <SideButton label="Squads" onClick={() => setSquadsOpen(true)} />
          <SideButton label="Drone" onClick={() => setDroneOpen(true)} />
          <SideButton label="Overlord" onClick={() => setOverlordOpen(true)} />
        </aside>

        {/* CENTER CHAT: fills full height, input stays at bottom inside ChatWindow */}
        <main className="min-w-0 flex-1">
          <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-white/90">
                Squad Assistant
              </div>
              <div className="mt-1 text-xs text-white/55">
                Chat fills the page. Tools open from the side buttons.
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <ChatWindow
                endpoint="/api/chat"
                emoji="🧠"
                emptyStateComponent={
                  <div className="text-sm text-slate-400/80">
                    Ask about squads, heroes, skills, gear, drone, overlord, and
                    game facts. Use Upload to add screenshots.
                  </div>
                }
              />
            </div>
          </div>

          {/* MOBILE BUTTON ROW (optional): only shows on small screens so you’re not blocked */}
          <div className="mt-3 flex gap-2 overflow-x-auto sm:hidden">
            <SideButton label="Squads" onClick={() => setSquadsOpen(true)} />
            <SideButton label="Drone" onClick={() => setDroneOpen(true)} />
            <SideButton label="Overlord" onClick={() => setOverlordOpen(true)} />
            <SideButton
              label="Battle Report Analyzer"
              onClick={() => setBattleOpen(true)}
            />
            <SideButton
              label="Optimizer"
              onClick={() => setOptimizerOpen(true)}
            />
            <SideButton label="Upload" onClick={() => setUploadOpen(true)} />
          </div>
        </main>

        {/* RIGHT SIDE BUTTONS */}
        <aside className="hidden w-[220px] flex-col gap-2 sm:flex">
          <SideButton
            label="Battle Report Analyzer"
            onClick={() => setBattleOpen(true)}
          />
          <SideButton
            label="Optimizer"
            onClick={() => setOptimizerOpen(true)}
          />
          <SideButton label="Upload" onClick={() => setUploadOpen(true)} />
        </aside>
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
          This modal is ready to be wired to your saved drone extraction data.
          For now, uploads + future optimizer can read drone rows via{" "}
          <span className="text-white/85">
            parsed.kind = &quot;drone&quot;
          </span>
          .
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
          This modal is ready to be wired to your saved overlord extraction data.
          For now, uploads + future optimizer can read overlord rows via{" "}
          <span className="text-white/85">
            parsed.kind = &quot;overlord&quot;
          </span>
          .
        </div>
      </ModalShell>

      {/* Battle Report Analyzer Modal (UNLOCKED + CHAT) */}
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
            Reminder: attacker/defender names or IDs, timestamps, and map
            coordinates are not saved (by design).
          </div>

          <div className="max-h-[45vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4">
            <pre className="whitespace-pre-wrap text-sm text-white/80">
              {battleOut || "Output will appear here."}
            </pre>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.25em] text-white/50">
              Ask the analyzer
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={battleMsg}
                onChange={(e) => setBattleMsg(e.target.value)}
                placeholder="Ask about why a battle went wrong, what to change, lineup ideas, etc."
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 placeholder:text-white/35 outline-none focus:border-white/20"
                disabled={battleBusy}
              />
              <button
                type="button"
                onClick={askBattleAnalyzer}
                disabled={battleBusy || !battleMsg.trim()}
                className={cn(
                  "rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-widest text-white/80 hover:bg-white/15",
                  (battleBusy || !battleMsg.trim()) &&
                    "opacity-50 cursor-not-allowed"
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
        subtitle="This will be wired after the battle analyzer math pipeline is fully confirmed"
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Optimizer is not wired yet. Next step is to reuse the battle analyzer
          math core and then pull from: AI facts DB, battle analyzer history,
          squads, drone, and overlord state. Then it becomes chat-driven like the
          analyzer.
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
                <span className="ml-2 text-white/45">
                  (stored as Hero profile for now)
                </span>
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
