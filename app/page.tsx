"use client";

import { useMemo, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";

type SquadSlot = 1 | 2 | 3 | 4;

type SquadState = {
  slot: SquadSlot;
  name: string;
  heroIds: string[]; // 5 heroes
  overlordId?: string | null; // optional, null = not assigned
};

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
        <div className="mt-3 text-xs text-slate-400/70">Not wired yet (player-specific system).</div>
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
      <a
        href={href}
        className="block focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 rounded-2xl"
      >
        {CardInner}
      </a>
    );
  }

  return CardInner;
}

function HeroThumb({ id }: { id: string }) {
  // Put images in: public/heroes/<id>.png
  const src = `/heroes/${id}.png`;

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-2xl",
        "border border-slate-700/50 bg-black/40",
        "shadow-[inset_0_0_0_1px_rgba(148,163,184,.06)]"
      )}
      title={id}
    >
      <img
        src={src}
        alt={id}
        className="h-full w-full object-cover"
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = "none";
          const parent = img.parentElement;
          if (parent && !parent.querySelector("[data-fallback='1']")) {
            const div = document.createElement("div");
            div.setAttribute("data-fallback", "1");
            div.className =
              "absolute inset-0 flex items-center justify-center text-center px-2 text-xs tracking-widest text-slate-200/80";
            div.textContent = id.toUpperCase();
            parent.appendChild(div);
          }
        }}
      />
      <div className="absolute bottom-1 left-1 right-1 truncate rounded-xl bg-black/50 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-200/80">
        {id}
      </div>
    </div>
  );
}

function OverlordSlot({ overlordId }: { overlordId?: string | null }) {
  // (Optional later) Put images in: public/overlord/<id>.png
  // For now it stays empty unless assigned.
  const src = overlordId ? `/overlord/${overlordId}.png` : null;

  return (
    <div className="w-[140px]">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">
        overlord
      </div>
      <div
        className={cn(
          "mt-2 relative aspect-square overflow-hidden rounded-2xl",
          "border border-slate-700/50 bg-black/35",
          "shadow-[inset_0_0_0_1px_rgba(148,163,184,.06)]"
        )}
        title={overlordId ? overlordId : "No overlord assigned"}
      >
        {src ? (
          <img
            src={src}
            alt={overlordId ?? "overlord"}
            className="h-full w-full object-cover"
            onError={(e) => {
              // If no image exists, just show a label fallback.
              const img = e.currentTarget;
              img.style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-slate-400/70">
            empty
          </div>
        )}

        <div className="absolute bottom-1 left-1 right-1 truncate rounded-xl bg-black/50 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-200/80">
          Overlord
        </div>
      </div>
    </div>
  );
}

function SquadFolderModal({
  squad,
  open,
  onClose,
}: {
  squad: SquadState | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !squad) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-16 w-[min(920px,calc(100vw-24px))] -translate-x-1/2">
        <div
          className={cn(
            "rounded-3xl border border-fuchsia-500/25 bg-black/55 backdrop-blur-xl",
            "shadow-[0_0_0_1px_rgba(236,72,153,.14),0_0_60px_rgba(168,85,247,.14)]",
            "overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-4">
            <div className="flex items-baseline gap-3">
              <div className="text-sm tracking-[0.25em] text-fuchsia-200/90">
                {squad.name.toUpperCase()}
              </div>
              <div className="text-xs text-slate-300/70">folder view</div>
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
              aria-label="Minimize squad menu"
              title="Minimize"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-[1fr_260px]">
            {/* Hero grid */}
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">
                    heroes in this squad
                  </div>
                  <div className="mt-1 text-xs text-slate-300/70">
                    {squad.heroIds.length} / 5 heroes
                  </div>
                </div>

                <OverlordSlot overlordId={squad.overlordId} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {squad.heroIds.map((id) => (
                  <HeroThumb key={id} id={id} />
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-700/40 bg-black/30 p-3 text-xs text-slate-300/70">
                This folder is squad-scoped. Optimizer here will only reason about this squad’s heroes/gear/drone/gorilla (once player state is wired).
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">
                actions
              </div>

              <a
                href={`/squads/${squad.slot}/optimizer`}
                className={cn(
                  "block rounded-2xl border border-cyan-400/25 bg-cyan-950/15 p-4",
                  "hover:border-cyan-300/35 hover:bg-cyan-950/20 transition",
                  "shadow-[0_0_30px_rgba(34,211,238,.08)]"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm tracking-wide text-cyan-200/90">
                      Squad Optimizer
                    </div>
                    <div className="mt-1 text-xs text-slate-300/70">
                      Scoped to {squad.name}
                    </div>
                  </div>
                  <div className="text-lg">📈</div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {["🛡️", "⚙️", "🛰️", "🦍", "⭐", "🧠", "🔁", "✅"].map((emoji, i) => (
                    <div
                      key={`${emoji}-${i}`}
                      className="aspect-square rounded-xl border border-slate-700/50 bg-slate-950/40 flex items-center justify-center"
                    >
                      <span className="text-lg">{emoji}</span>
                    </div>
                  ))}
                </div>
              </a>

              <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-3 text-xs text-slate-300/70">
                Later: quick toggles for drone/gorilla attached to this squad, plus gear presets.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-800/60 px-5 py-4">
            <div className="text-xs text-slate-400/80">
              Tip: Add hero images to{" "}
              <code className="text-slate-300/80">public/heroes/&lt;id&gt;.png</code>
            </div>
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

export default function Home() {
  // Temporary placeholder squad data.
  // Later: replace with player state (localStorage / DB).
  const squads: SquadState[] = useMemo(
    () => [
      {
        slot: 1,
        name: "Squad 1",
        heroIds: ["kimberly", "murphy", "williams", "marshall", "stetmann"],
        overlordId: null,
      },
      {
        slot: 2,
        name: "Squad 2",
        heroIds: ["dva", "carlie", "morrison", "lucious", "schuyler"],
        overlordId: null,
      },
      {
        slot: 3,
        name: "Squad 3",
        heroIds: ["tesla", "swift", "mcgregor", "adam", "fiona"],
        overlordId: null,
      },
      {
        slot: 4,
        name: "Squad 4",
        heroIds: ["mason", "violet", "scarlet", "sarah", "elsa"],
        overlordId: null,
      },
    ],
    []
  );

  const [folderOpen, setFolderOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SquadSlot | null>(null);

  const activeSquad = useMemo(
    () => squads.find((s) => s.slot === activeSlot) ?? null,
    [squads, activeSlot]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_10%,rgba(168,85,247,.25),transparent_45%),radial-gradient(1000px_circle_at_85%_20%,rgba(236,72,153,.18),transparent_42%),radial-gradient(900px_circle_at_55%_85%,rgba(34,211,238,.14),transparent_45%),linear-gradient(to_bottom,rgba(2,6,23,1),rgba(0,0,0,1))]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-fuchsia-500/20 bg-black/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-3">
            <div className="text-xl font-semibold tracking-[0.35em] text-fuchsia-200 drop-shadow-[0_0_12px_rgba(236,72,153,.35)]">
              SQUAD ASSISTANT
            </div>
            <div className="hidden sm:block text-xs tracking-widest text-cyan-200/70">
              brain • truths • squads
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400/80">
            prod: <span className="text-emerald-300/90">live</span>
          </div>
        </div>
      </div>

      {/* Modal folder */}
      <SquadFolderModal squad={activeSquad} open={folderOpen} onClose={() => setFolderOpen(false)} />

      {/* 3-column layout */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-5 md:grid-cols-[260px_1fr_260px]">
        {/* Left: squads */}
        <aside className="space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">squads</div>

          {squads.map((s) => (
            <AppGroupCard
              key={s.slot}
              title={s.name}
              subtitle="Tap to open folder"
              badge={`${s.heroIds.length} heroes`}
              onClick={() => {
                setActiveSlot(s.slot);
                setFolderOpen(true);
              }}
              icons={[
                { label: "Hero", emoji: "🧑‍🚀" },
                { label: "Hero", emoji: "🛡️" },
                { label: "Hero", emoji: "🚀" },
                { label: "Hero", emoji: "✈️" },
                { label: "Gear", emoji: "⚙️" },
                { label: "Drone", emoji: "🛰️" },
                { label: "Overlord", emoji: "🦍" },
                { label: "Optimize", emoji: "📈" },
              ]}
            />
          ))}

          <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-3 text-xs text-slate-300/70">
            These folders will later reflect your profile’s exact squads (hero stars/skills/gear/drone/gorilla).
          </div>
        </aside>

        {/* Center: chat */}
        <main className="rounded-2xl border border-fuchsia-500/20 bg-black/25 backdrop-blur p-2 shadow-[0_0_40px_rgba(168,85,247,.08)]">
          <ChatWindow
            endpoint="api/chat"
            emoji="🤖"
            placeholder="Ask about heroes, skills, star gates, gear, drone, or gorilla…"
            emptyStateComponent={
              <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4">
                <div className="text-sm text-slate-200/90">
                  Brain is live. Truths are loaded. Player state comes next.
                </div>
                <div className="mt-2 text-xs text-slate-400/80">
                  Try: “Show me Kimberly’s skills and what Super Sensing means.”
                </div>
              </div>
            }
          />
        </main>

        {/* Right: tools */}
        <aside className="space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400/80">tools</div>

          <AppGroupCard
            title="Heroes Listing"
            subtitle="Truths: heroes + skills"
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

          <AppGroupCard
            title="Battle Reports"
            subtitle="Player-specific ingestion later"
            disabled
            icons={[
              { label: "Upload", emoji: "📷" },
              { label: "OCR", emoji: "🔤" },
              { label: "Parse", emoji: "🧾" },
              { label: "Consent", emoji: "✅" },
              { label: "Redact", emoji: "🫥" },
              { label: "Stats", emoji: "📊" },
              { label: "Match", emoji: "🧩" },
              { label: "Export", emoji: "📤" },
            ]}
          />

          <AppGroupCard
            title="Optimizer"
            subtitle="Full profile workspace later"
            disabled
            icons={[
              { label: "DPS", emoji: "💥" },
              { label: "Tank", emoji: "🛡️" },
              { label: "Synergy", emoji: "🔗" },
              { label: "Stars", emoji: "⭐" },
              { label: "Gear", emoji: "⚙️" },
              { label: "Drone", emoji: "🛰️" },
              { label: "Gorilla", emoji: "🦍" },
              { label: "Plan", emoji: "🗺️" },
            ]}
          />

          <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-3 text-xs text-slate-300/70">
            Squad folders = squad-scoped mini optimizer. Global optimizer = full plug-and-play workspace.
          </div>
        </aside>
      </div>
    </div>
  );
}
