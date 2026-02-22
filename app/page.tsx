"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChatWindow } from "@/components/ChatWindow";

type SquadSlot = 1 | 2 | 3 | 4;

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function AppGroupCard({
  title,
  subtitle,
  onClick,
  href,
  disabled,
  icons,
  badge,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  icons?: { label: string; emoji: string }[];
  badge?: string;
}) {
  const CardInner = (
    <div
      className={cn(
        "group relative w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left",
        "hover:border-white/20 hover:bg-white/7 transition",
        "shadow-[0_0_30px_rgba(255,255,255,.05)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold tracking-wide text-white/90">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-xs leading-relaxed text-white/60">
              {subtitle}
            </div>
          ) : null}
        </div>

        {badge ? (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
            {badge}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          {disabled ? "soon" : href || onClick ? "open" : ""}
        </div>

        <div className="flex items-center gap-2">
          {(icons ?? [
            { label: "App", emoji: "🧩" },
            { label: "App", emoji: "⚔️" },
            { label: "App", emoji: "🛰️" },
            { label: "App", emoji: "📈" },
            { label: "App", emoji: "⚙️" },
            { label: "App", emoji: "📷" },
            { label: "App", emoji: "🧠" },
            { label: "App", emoji: "✅" },
          ]).map((it, idx) => (
            <span
              key={`${it.label}-${idx}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm"
              title={it.label}
            >
              {it.emoji}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 text-xs text-white/50">
        {disabled ? (
          <span>Not wired yet.</span>
        ) : href ? (
          <span>
            Link: <span className="text-white/70">{href}</span>
          </span>
        ) : null}
      </div>
    </div>
  );

  if (disabled) return CardInner;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full">
        {CardInner}
      </button>
    );
  }

  if (href) {
    return <Link href={href}>{CardInner}</Link>;
  }

  return CardInner;
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
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl">
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
            Minimize
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
        This view will later load the player’s squads + drone chip assignments
        from profile state.
      </div>
    </div>
  );
}

type UploadPurpose = "battle_report" | "optimizer" | "general";

type UploadResult = {
  fileName: string;
  ok: boolean;
  message: string;
};

export default function Home() {
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Upload state
  const [uploadPurpose, setUploadPurpose] = useState<UploadPurpose>(
    "battle_report"
  );
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const purposeLabel = useMemo(() => {
    switch (uploadPurpose) {
      case "battle_report":
        return "Battle report";
      case "optimizer":
        return "Optimizer input";
      default:
        return "General upload";
    }
  }, [uploadPurpose]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function uploadSingle(file: File, purpose: UploadPurpose) {
    const fd = new FormData();
    fd.append("file", file);

    // If your API ignores this today, that's fine.
    fd.append("purpose", purpose);

    const res = await fetch("/api/uploads/image", {
      method: "POST",
      body: fd,
    });

    const json = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      const msg =
        json?.error ? `Upload failed: ${json.error}` : "Upload failed.";
      return { ok: false, message: msg, json };
    }

    // Keep compatibility with your existing response shape:
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
        const r = await uploadSingle(file, uploadPurpose);

        results.push({
          fileName: file.name,
          ok: r.ok,
          message: r.message,
        });

        // Live update so you can see progress even if something fails
        setUploadResults([...results]);
      }

      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.length - okCount;

      setUploadMsg(
        failCount === 0
          ? `Done ✅ Uploaded ${okCount}/${results.length} (${purposeLabel}).`
          : `Done ⚠️ Uploaded ${okCount}/${results.length} (${purposeLabel}). Failed: ${failCount}.`
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
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-sm font-semibold tracking-wide">
              SQUAD ASSISTANT
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">
              prod: live
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 hover:bg-white/10"
          >
            Log out
          </button>
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
          <div>
            Drone overview will be populated from:
            <ul className="mt-2 list-disc space-y-1 pl-5 text-white/65">
              <li>
                Drone components (Radar, Turbo Engine, External Armor, Thermal
                Imager, Fuel Cell, Airborne Missile)
              </li>
              <li>Combat Boost stages + chip-set unlocks</li>
              <li>Per-squad chip assignments (shown in Squads modal)</li>
            </ul>
          </div>
          <div className="text-xs text-white/45">API: /api/drone</div>
        </div>
      </ModalShell>

      <ModalShell
        title="Overlord"
        subtitle="Overlord training, skills, and progression."
        open={overlordOpen}
        onClose={() => setOverlordOpen(false)}
      >
        <div className="space-y-3 text-sm text-white/70">
          <div>
            Overlord overview will be populated from:
            <ul className="mt-2 list-disc space-y-1 pl-5 text-white/65">
              <li>Training (HP/ATK/DEF) gates</li>
              <li>Promotion levels</li>
              <li>Bond / partner levels</li>
              <li>Overlord skills (scalable)</li>
            </ul>
          </div>
          <div className="text-xs text-white/45">API: /api/overlord</div>
        </div>
      </ModalShell>

      <ModalShell
        title="Research"
        subtitle="Controlled search + curated ingestion (placeholder for stability)."
        open={researchOpen}
        onClose={() => setResearchOpen(false)}
      >
        <div className="space-y-2 text-sm text-white/70">
          <p>
            Research will become the “controlled search + curated ingestion”
            area.
          </p>
          <p>For now: placeholder so the UI stays stable while we build.</p>
        </div>
      </ModalShell>

      <ModalShell
        title="Optimizer workspace"
        subtitle="Profile-wide optimizer (modal for now)."
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      >
        <div className="space-y-3 text-sm text-white/70">
          <div>
            Optimizer will:
            <ul className="mt-2 list-disc space-y-1 pl-5 text-white/65">
              <li>Pull your squads + gear + drone + overlord assignments</li>
              <li>Apply game facts (heroes, skills, gear, drone, overlord)</li>
              <li>Show live changes as you swap heroes/positions/gear</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            Uses game facts.
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Battle reports analyzer"
        subtitle="Analyze reports and explain outcomes."
        open={battleOpen}
        onClose={() => setBattleOpen(false)}
      >
        <div className="space-y-3 text-sm text-white/70">
          <div>
            Analyzer will:
            <ul className="mt-2 list-disc space-y-1 pl-5 text-white/65">
              <li>Analyze one report or all reports (with filters)</li>
              <li>Group by exact hero lineup (not just hero type)</li>
              <li>
                Explain outcomes using game facts + placement + buffs/debuffs
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            Uses game facts.
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Upload"
        subtitle="Upload up to 20 images at a time."
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white/85">
              Upload purpose
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setUploadPurpose("battle_report")}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-left text-sm transition",
                  uploadPurpose === "battle_report"
                    ? "border-fuchsia-300/40 bg-fuchsia-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
              >
                <div className="font-semibold text-white/85">Battle report</div>
                <div className="mt-1 text-xs text-white/55">
                  Screenshots used by the analyzer
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUploadPurpose("optimizer")}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-left text-sm transition",
                  uploadPurpose === "optimizer"
                    ? "border-cyan-300/40 bg-cyan-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
              >
                <div className="font-semibold text-white/85">Optimizer</div>
                <div className="mt-1 text-xs text-white/55">
                  Profile images needed for optimization
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUploadPurpose("general")}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-left text-sm transition",
                  uploadPurpose === "general"
                    ? "border-emerald-300/40 bg-emerald-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
              >
                <div className="font-semibold text-white/85">General</div>
                <div className="mt-1 text-xs text-white/55">
                  Anything else (images only)
                </div>
              </button>
            </div>

            <div className="mt-4 text-xs text-white/50">
              Upload endpoint: <span className="text-white/70">/api/uploads/image</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white/85">
              Select up to 20 images
            </div>
            <div className="mt-2 text-xs text-white/55">
              Tip: you can multi-select from your gallery.
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
                  // reset so user can re-pick same files
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

      {/* 3-column layout */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-12">
        {/* Left */}
        <div className="space-y-3 lg:col-span-3">
          <div className="text-xs uppercase tracking-[0.35em] text-white/40">
            systems
          </div>

          <AppGroupCard
            title="Squads"
            subtitle="4 squads • hero slots + chip assignments"
            onClick={() => setSquadsOpen(true)}
            icons={[
              { label: "S1", emoji: "①" },
              { label: "S2", emoji: "②" },
              { label: "S3", emoji: "③" },
              { label: "S4", emoji: "④" },
              { label: "Heroes", emoji: "🧍" },
              { label: "Heroes", emoji: "✈️" },
              { label: "Heroes", emoji: "🛡️" },
              { label: "Chips", emoji: "💾" },
            ]}
          />

          <AppGroupCard
            title="Drone"
            subtitle="Components • boosts • chip-sets"
            onClick={() => setDroneOpen(true)}
            icons={[
              { label: "Radar", emoji: "📡" },
              { label: "Engine", emoji: "🧰" },
              { label: "Armor", emoji: "🛡️" },
              { label: "Thermal", emoji: "🌡️" },
              { label: "Fuel", emoji: "⛽" },
              { label: "Missile", emoji: "🚀" },
              { label: "Boost", emoji: "⚡" },
              { label: "Chips", emoji: "💾" },
            ]}
          />

          <AppGroupCard
            title="Overlord"
            subtitle="Training • promotion • skills"
            onClick={() => setOverlordOpen(true)}
            icons={[
              { label: "Train", emoji: "🏋️" },
              { label: "Promote", emoji: "⬆️" },
              { label: "Bond", emoji: "🤝" },
              { label: "Skills", emoji: "📘" },
              { label: "HP", emoji: "❤️" },
              { label: "ATK", emoji: "⚔️" },
              { label: "DEF", emoji: "🛡️" },
              { label: "Core", emoji: "🧬" },
            ]}
          />

          <AppGroupCard
            title="Research"
            subtitle="Curate and ingest game facts (placeholder)"
            onClick={() => setResearchOpen(true)}
            icons={[
              { label: "Web", emoji: "🌐" },
              { label: "Math", emoji: "➗" },
              { label: "Notes", emoji: "🗒️" },
              { label: "Approve", emoji: "✅" },
              { label: "Extract", emoji: "🧠" },
              { label: "Index", emoji: "🗂️" },
              { label: "Query", emoji: "🔎" },
              { label: "Rules", emoji: "⚙️" },
            ]}
          />
        </div>

        {/* Center */}
        <div className="lg:col-span-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-white/85">
                Game facts are live.
              </div>
              <div className="mt-1 text-xs text-white/55">
                Try: “Explain drone components and what they boost.”
              </div>
            </div>

            <ChatWindow
              initialMessages={[
                {
                  role: "assistant",
                  content:
                    "You can ask about squads, drones, overlord, and game facts. Upload screenshots in Tools → Upload.",
                },
              ]}
            />
          </div>

          {/* Optional global optimizer entry (kept) */}
          <button
            type="button"
            onClick={() => setOptimizerOpen(true)}
            className={cn(
              "mt-4 block w-full rounded-2xl border border-cyan-400/25 bg-cyan-950/15 p-4 text-left",
              "hover:border-cyan-300/35 hover:bg-cyan-950/20 transition",
              "shadow-[0_0_30px_rgba(34,211,238,.08)]"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white/90">
                  Optimizer Workspace
                </div>
                <div className="mt-1 text-xs text-white/55">
                  Profile-wide optimizer (modal for now)
                </div>
              </div>

              <div className="flex items-center gap-2">
                {["🧍", "✈️", "🛡️", "⚙️", "🛰️", "🧠", "⭐", "✅"].map((emoji, i) => (
                  <span
                    key={`${emoji}-${i}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-2xl border border-cyan-200/15 bg-cyan-500/10 text-sm"
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            </div>
          </button>
        </div>

        {/* Right */}
        <div className="space-y-3 lg:col-span-3">
          <div className="text-xs uppercase tracking-[0.35em] text-white/40">
            tools
          </div>

          <AppGroupCard
            title="Battle Reports Analyzer"
            subtitle="Analyze reports • compare lineups"
            onClick={() => setBattleOpen(true)}
            icons={[
              { label: "Upload", emoji: "📤" },
              { label: "Parse", emoji: "🧾" },
              { label: "Compare", emoji: "🆚" },
              { label: "Explain", emoji: "🧠" },
              { label: "Filter", emoji: "🧰" },
              { label: "Stats", emoji: "📊" },
              { label: "Matchups", emoji: "⚔️" },
              { label: "Notes", emoji: "🗒️" },
            ]}
          />

          <AppGroupCard
            title="Optimizer"
            subtitle="Swap heroes • gear • drone • overlord"
            onClick={() => setOptimizerOpen(true)}
            icons={[
              { label: "Swap", emoji: "🔁" },
              { label: "Gear", emoji: "⚙️" },
              { label: "Drone", emoji: "🛰️" },
              { label: "Overlord", emoji: "👑" },
              { label: "Stars", emoji: "⭐" },
              { label: "Skills", emoji: "📘" },
              { label: "Compare", emoji: "🆚" },
              { label: "Result", emoji: "✅" },
            ]}
          />

          <AppGroupCard
            title="Upload"
            subtitle="Up to 20 images per batch"
            onClick={() => setUploadOpen(true)}
            icons={[
              { label: "Camera", emoji: "📷" },
              { label: "Screenshot", emoji: "🖼️" },
              { label: "OCR", emoji: "🔤" },
              { label: "Extract", emoji: "🧠" },
              { label: "Consent", emoji: "✅" },
              { label: "Redact", emoji: "🕵️" },
              { label: "Index", emoji: "🗂️" },
              { label: "Save", emoji: "💾" },
            ]}
          />

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-xs text-white/55">
            UI uses <span className="text-white/75">game facts</span>.
          </div>
        </div>
      </div>
    </div>
  );
             }
