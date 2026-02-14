"use client";

import { useMemo, useState } from "react";
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
        "rounded-2xl border border-fuchsia-500/30 bg-black/35 backdrop-blur",
        "p-4 shadow-[0_0_0_1px_rgba(236,72,153,.15),0_0_30px_rgba(168,85,247,.10)]",
        disabled ? "opacity-55" : "hover:border-fuchsia-400/50 hover:bg-black/45",
        "transition"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm tracking-wide text-fuchsia-200/90">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-300/70">{subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          {badge ? (
            <div className="rounded-full border border-cyan-400/25 bg-cyan-950/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-cyan-200/80">
              {badge}
            </div>
          ) : null}
          <div className="text-[10px] uppercase tracking-widest text-slate-400/70">
            {disabled ? "soon" : href || onClick ? "open" : ""}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {(icons ?? [
          { label: "App", emoji: "🧠" },
          { label: "App", emoji: "⚔️" },
          { label: "App", emoji: "🛰️" },
          { label: "App", emoji: "🧩" },
          { label: "App", emoji: "🛡️" },
          { label: "App", emoji: "💥" },
          { label: "App", emoji: "📈" },
          { label: "App", emoji: "🧪" },
        ]).map((it, idx) => (
          <div
            key={`${it.label}-${idx}`}
            className={cn(
              "aspect-square rounded-xl border border-slate-700/50 bg-slate-950/40",
              "flex items-center justify-center",
              "shadow-[inset_0_0_0_1px_rgba(148,163,184,.06)]"
            )}
            title={it.label}
          >
            <span className="text-lg">{it.emoji}</span>
          </div>
        ))}
      </div>

      {disabled ? (
        <div className="mt-3 text-xs text-slate-400/70">Not wired yet.</div>
      ) : href ? (
        <div className="mt-3 text-xs text-slate-300/80">
          <span className="text-slate-400/70">Link:</span>{" "}
          <span className="underline decoration-fuchsia-500/40 underline-offset-4">{href}</span>
        </div>
      ) : null}
    </div>
  );

  if (disabled) return CardInner;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 rounded-2xl"
      >
        {CardInner}
      </button>
    );
  }

  if (href) {
    return (
      <a href={href} className="block focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 rounded-2xl">
        {CardInner}
      </a>
    );
  }

  return CardInner;
}

function AddTile({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-2xl",
        "border border-slate-700/50 bg-black/40",
        "shadow-[inset_0_0_0_1px_rgba(148,163,184,.06)]"
      )}
      title={label}
    >
      <div className="absolute inset-0 flex items-center justify-center text-xs tracking-[0.35em] text-slate-200/70">
        ADD
      </div>
      <div className="absolute bottom-1 left-1 right-1 truncate rounded-xl bg-black/50 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-200/70">
        {label}{sublabel ? ` • ${sublabel}` : ""}
      </div>
    </div>
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
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="absolute left-1/2 top-16 w-[min(980px,calc(100vw-24px))] -translate-x-1/2">
        <div
          className={cn(
            "rounded-3xl border border-fuchsia-500/25 bg-black/55 backdrop-blur-xl",
            "shadow-[0_0_0_1px_rgba(236,72,153,.14),0_0_60px_rgba(168,85,247,.14)]",
            "overflow-hidden"
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-4">
            <div className="flex items-baseline gap-3">
              <div className="text-sm tracking-[0.25em] text-fuchsia-200/90">{title.toUpperCase()}</div>
              {subtitle ? <div className="text-xs text-slate-300/70">{subtitle}</div> : null}
            </div>

            {/* X = minimize */}
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "rounded-full border border-slate-700/60 bg-black/40 px-3 py-1",
                "text-xs uppercase tracking-widest text-slate-200/80",
                "hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
              )}
              aria-label="Minimize"
              title="Minimize"
            >
              ✕
            </button>
          </div>

          <div className="p-5">{children}</div>

          <div className="flex items-center justify-end border-t border-slate-800/60 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-700/60 bg-black/40 px-4 py-2 text-xs uppercase tracking-widest text-slate-200/80 hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
            >
              Minimize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SquadGrid({ slot }: { slot: SquadSlot }) {
  return (
    <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">{`Squad ${slot}`}</div>
          <div className="mt-1 text-xs text-slate-300/70">5 hero slots • blank until uploads</div>
        </div>
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">Drone chips</div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <AddTile key={idx} label={`Hero ${idx + 1}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <AddTile key={idx} label={`Chip Set ${idx + 1}`} sublabel="(later)" />
          ))}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-300/70">
        This view will later load the player’s squads + drone chip assignments from profile state.
      </div>
    </div>
  );
}

export default function Home() {
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [overlordOpen, setOverlordOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);

  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Image upload UI state
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleUpload(file: File) {
    setUploadMsg(null);
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadMsg(json?.error ? `Upload failed: ${json.error}` : "Upload failed.");
        return;
      }

      setUploadMsg(`Uploaded ✅ reportId=${json.reportId ?? "?"}`);
    } catch (e: any) {
      setUploadMsg(`Upload failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_10%,rgba(168,85,247,.25),transparent_45%),radial-gradient(1000px_circle_at_85%_20%,rgba(236,72,153,.18),transparent_42%),radial-gradient(900px_circle_at_55%_85%,rgba(34,211,238,.14),transparent_45%),linear-gradient(to_bottom,rgba(2,6,23,1),rgba(0,0,0,1))]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-fuchsia-500/20 bg-black/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-3">
            <div className="text-xl font-semibold tracking-[0.35em] text-fuchsia-200 drop-shadow-[0_0_12px_rgba(236,72,153,.35)]">
              SQUAD ASSISTANT
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400/80">
              prod: <span className="text-emerald-300/90">live</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-slate-700/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-widest text-slate-200/80 hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ModalShell title="Squads" subtitle="All squads + drone chip sets (structure only)" open={squadsOpen} onClose={() => setSquadsOpen(false)}>
        <div className="space-y-4">
          <SquadGrid slot={1} />
          <SquadGrid slot={2} />
          <SquadGrid slot={3} />
          <SquadGrid slot={4} />
        </div>
      </ModalShell>

      <ModalShell title="Drone" subtitle="Game facts + player-driven state later" open={droneOpen} onClose={() => setDroneOpen(false)}>
        <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
          Drone overview will be populated from:
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-300/70 space-y-1">
            <li>Drone components (Radar, Turbo Engine, External Armor, Thermal Imager, Fuel Cell, Airborne Missile)</li>
            <li>Combat Boost stages + chip-set unlocks</li>
            <li>Per-squad chip assignments (shown in Squads modal)</li>
          </ul>
          <div className="mt-3 text-xs text-slate-300/70">
            API: <span className="underline decoration-fuchsia-500/40 underline-offset-4">/api/drone</span>
          </div>
        </div>
      </ModalShell>

      <ModalShell title="Overlord" subtitle="Game facts + player-driven state later" open={overlordOpen} onClose={() => setOverlordOpen(false)}>
        <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
          Overlord overview will be populated from:
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-300/70 space-y-1">
            <li>Training (HP/ATK/DEF) gates</li>
            <li>Promotion levels</li>
            <li>Bond / partner levels</li>
            <li>Overlord skills (scalable)</li>
          </ul>
          <div className="mt-3 text-xs text-slate-300/70">
            API: <span className="underline decoration-fuchsia-500/40 underline-offset-4">/api/overlord</span>
          </div>
        </div>
      </ModalShell>

      <ModalShell title="Research" subtitle="Placeholder for controlled learning + math references" open={researchOpen} onClose={() => setResearchOpen(false)}>
        <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
          Research will become the “controlled search + curated ingestion” area.
          <div className="mt-3 text-xs text-slate-300/70">
            For now: a placeholder so the UI is stable while we build analyzer/optimizer.
          </div>
        </div>
      </ModalShell>

      <ModalShell title="Optimizer" subtitle="Uses game facts + your profile state (coming next)" open={optimizerOpen} onClose={() => setOptimizerOpen(false)}>
        <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
          Optimizer Workspace will:
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-300/70 space-y-1">
            <li>Pull your squads + gear + drone + overlord assignments</li>
            <li>Apply game facts (heroes, skills, gear, drone, overlord)</li>
            <li>Show live changes as you swap heroes/positions/gear</li>
          </ul>
          <div className="mt-3 text-xs text-slate-300/70">
            “Truths” wording removed — this uses <span className="text-slate-200/80">game facts</span>.
          </div>
        </div>
      </ModalShell>

      <ModalShell title="Battle Reports Analyzer" subtitle="Upload → parse → compare → explain (coming next)" open={battleOpen} onClose={() => setBattleOpen(false)}>
        <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
          Analyzer will:
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-300/70 space-y-1">
            <li>Analyze one report or all reports (with filters)</li>
            <li>Group by exact hero lineup (not just hero type)</li>
            <li>Explain outcomes using game facts + placement + buffs/debuffs</li>
          </ul>
          <div className="mt-3 text-xs text-slate-300/70">
            “Truths” wording removed — this uses <span className="text-slate-200/80">game facts</span>.
          </div>
        </div>
      </ModalShell>

      <ModalShell title="Image Upload" subtitle="Upload screenshots/photos for ingestion" open={uploadOpen} onClose={() => setUploadOpen(false)}>
        <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4">
          <div className="text-sm text-slate-200/80">Upload an image (game screenshot or camera photo)</div>
          <div className="mt-2 text-xs text-slate-300/70">
            This posts to <span className="text-slate-200/80">/api/uploads/image</span>. If you’re not logged in, it will 401.
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <input
              type="file"
              accept="image/*"
              disabled={uploadBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void handleUpload(f);
                e.currentTarget.value = "";
              }}
              className="block w-full text-sm text-slate-200/80 file:mr-4 file:rounded-xl file:border-0 file:bg-fuchsia-600/20 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-widest file:text-fuchsia-100 hover:file:bg-fuchsia-600/30"
            />

            <div className="text-xs text-slate-300/70">
              {uploadBusy ? "Uploading…" : uploadMsg ? uploadMsg : "Choose an image to upload."}
            </div>
          </div>
        </div>
      </ModalShell>

      {/* 3-column layout */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-5 md:grid-cols-[260px_1fr_260px]">
        {/* Left: now 4 system cards */}
        <aside className="space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">systems</div>

          <AppGroupCard
            title="Squads"
            subtitle="All 4 squads + drone chips"
            onClick={() => setSquadsOpen(true)}
            icons={[
              { label: "S1", emoji: "①" },
              { label: "S2", emoji: "②" },
              { label: "S3", emoji: "③" },
              { label: "S4", emoji: "④" },
              { label: "Heroes", emoji: "🛡️" },
              { label: "Heroes", emoji: "✈️" },
              { label: "Heroes", emoji: "🚀" },
              { label: "Chips", emoji: "🧩" },
            ]}
          />

          <AppGroupCard
            title="Drone"
            subtitle="Components + combat boost"
            onClick={() => setDroneOpen(true)}
            icons={[
              { label: "Radar", emoji: "📡" },
              { label: "Engine", emoji: "🧯" },
              { label: "Armor", emoji: "🛡️" },
              { label: "Thermal", emoji: "🌡️" },
              { label: "Fuel", emoji: "⛽" },
              { label: "Missile", emoji: "🚀" },
              { label: "Boost", emoji: "⚡" },
              { label: "Chips", emoji: "🧩" },
            ]}
          />

          <AppGroupCard
            title="Overlord"
            subtitle="Train + promote + bond"
            onClick={() => setOverlordOpen(true)}
            icons={[
              { label: "Train", emoji: "🏋️" },
              { label: "Promote", emoji: "⬆️" },
              { label: "Bond", emoji: "🤝" },
              { label: "Skills", emoji: "🧠" },
              { label: "HP", emoji: "❤️" },
              { label: "ATK", emoji: "⚔️" },
              { label: "DEF", emoji: "🛡️" },
              { label: "Gorilla", emoji: "🦍" },
            ]}
          />

          <AppGroupCard
            title="Research"
            subtitle="Controlled learning (later)"
            onClick={() => setResearchOpen(true)}
            icons={[
              { label: "Web", emoji: "🌐" },
              { label: "Math", emoji: "🧮" },
              { label: "Notes", emoji: "📝" },
              { label: "Approve", emoji: "✅" },
              { label: "Extract", emoji: "🧲" },
              { label: "Index", emoji: "📚" },
              { label: "Query", emoji: "🔎" },
              { label: "Rules", emoji: "⚙️" },
            ]}
          />
        </aside>

        {/* Center: chat */}
        <main className="space-y-3">
          <div className="h-[70vh] rounded-2xl border border-fuchsia-500/20 bg-black/25 backdrop-blur p-2 shadow-[0_0_40px_rgba(168,85,247,.08)]">
            <ChatWindow
              endpoint="api/chat"
              emoji="🤖"
              placeholder="Ask about heroes, skills, star gates, gear, drone, or overlord…"
              emptyStateComponent={
                <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4">
                  <div className="text-sm text-slate-200/80">Game facts are live.</div>
                  <div className="mt-2 text-xs text-slate-400/80">
                    Try: “Explain drone components and what they boost.”
                  </div>
                </div>
              }
            />
          </div>

          {/* Optional: keep your global optimizer entry as a modal now */}
          <button
            type="button"
            onClick={() => setOptimizerOpen(true)}
            className={cn(
              "block w-full rounded-2xl border border-cyan-400/25 bg-cyan-950/15 p-4 text-left",
              "hover:border-cyan-300/35 hover:bg-cyan-950/20 transition",
              "shadow-[0_0_30px_rgba(34,211,238,.08)]"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm tracking-wide text-cyan-200/90">Optimizer Workspace</div>
                <div className="mt-1 text-xs text-slate-300/70">Profile-wide optimizer (modal for now)</div>
              </div>
              <div className="text-lg">📊</div>
            </div>

            <div className="mt-4 grid grid-cols-8 gap-2">
              {["🛡️", "✈️", "🚀", "⚙️", "🛰️", "🦍", "⭐", "🧠"].map((emoji, i) => (
                <div
                  key={`${emoji}-${i}`}
                  className="aspect-square rounded-xl border border-slate-700/50 bg-slate-950/40 flex items-center justify-center"
                >
                  <span className="text-lg">{emoji}</span>
                </div>
              ))}
            </div>
          </button>
        </main>

        {/* Right: tools (rearranged per your new plan) */}
        <aside className="space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">tools</div>

          <AppGroupCard
            title="Heroes Listing"
            subtitle="Game facts: heroes + skills"
            href="/api/heroes"
            icons={[
              { label: "Tank", emoji: "🛡️" },
              { label: "Air", emoji: "✈️" },
              { label: "Missile", emoji: "🚀" },
              { label: "UR", emoji: "💎" },
              { label: "SSR", emoji: "🔷" },
              { label: "SR", emoji: "🔸" },
              { label: "Skills", emoji: "🧠" },
              { label: "Search", emoji: "🔎" },
            ]}
          />

          {/* Drone position -> Battle Reports Analyzer */}
          <AppGroupCard
            title="Battle Reports Analyzer"
            subtitle="Analyze reports + explain outcomes"
            onClick={() => setBattleOpen(true)}
            icons={[
              { label: "Upload", emoji: "📷" },
              { label: "Parse", emoji: "🧾" },
              { label: "Compare", emoji: "🧩" },
              { label: "Explain", emoji: "🧠" },
              { label: "Filter", emoji: "🎛️" },
              { label: "Stats", emoji: "📊" },
              { label: "Matchups", emoji: "⚔️" },
              { label: "Notes", emoji: "📝" },
            ]}
          />

          {/* Overlord position -> Optimizer */}
          <AppGroupCard
            title="Optimizer"
            subtitle="Live squad optimization workspace"
            onClick={() => setOptimizerOpen(true)}
            icons={[
              { label: "Swap", emoji: "🔁" },
              { label: "Gear", emoji: "⚙️" },
              { label: "Drone", emoji: "🛰️" },
              { label: "Overlord", emoji: "🦍" },
              { label: "Stars", emoji: "⭐" },
              { label: "Skills", emoji: "🧠" },
              { label: "Compare", emoji: "📊" },
              { label: "Result", emoji: "✅" },
            ]}
          />

          {/* Drone position (your note said drone twice; this is the Upload tool slot) */}
          <AppGroupCard
            title="Image Upload"
            subtitle="Upload game images for extraction"
            onClick={() => setUploadOpen(true)}
            icons={[
              { label: "Camera", emoji: "📷" },
              { label: "Screenshot", emoji: "🖼️" },
              { label: "OCR", emoji: "🔤" },
              { label: "Extract", emoji: "🧲" },
              { label: "Consent", emoji: "✅" },
              { label: "Redact", emoji: "🫥" },
              { label: "Index", emoji: "📚" },
              { label: "Save", emoji: "💾" },
            ]}
          />

          <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-3 text-xs text-slate-300/70">
            “Truths” removed — UI now uses “game facts”.
          </div>
        </aside>
      </div>
    </div>
  );
}
