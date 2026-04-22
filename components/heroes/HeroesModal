"use client";

import React, { useEffect, useMemo, useState } from "react";

type HeroListItem = {
  hero_key: string;
  name: string;
  troop_type: string;
  level: number;
  stars: number;
  profile_upload_id: number | null;
  image_url: string | null;
  base_stats: {
    hp: number;
    atk: number;
    def: number;
    power: number;
    morale: number;
    march_size: number;
  };
  completeness: {
    has_profile: boolean;
    has_gear: boolean;
    has_skills: boolean;
  };
};

type HeroesModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenHero: (uploadId: number | null, heroKey?: string) => void;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function statText(label: string, value: number | string | null | undefined) {
  const text = value == null ? "—" : String(value);
  return `${label}: ${text}`;
}

export function HeroesModal({ open, onClose, onOpenHero }: HeroesModalProps) {
  const [heroes, setHeroes] = useState<HeroListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch("/api/heroes", { credentials: "include" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          if (!cancelled) setErr(json?.error ?? `Failed to load heroes (${res.status})`);
          return;
        }

        const rows = Array.isArray(json?.heroes) ? json.heroes : [];
        if (!cancelled) setHeroes(rows);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load heroes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter((h) => {
      return (
        String(h.name || "").toLowerCase().includes(q) ||
        String(h.hero_key || "").toLowerCase().includes(q) ||
        String(h.troop_type || "").toLowerCase().includes(q)
      );
    });
  }, [heroes, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 md:items-center md:p-6">
      <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4 md:px-6">
          <div>
            <div className="text-xl font-semibold text-white">Heroes</div>
            <div className="mt-1 text-sm text-white/55">
              Full owned roster used by the optimizer, whether heroes are assigned to squads or not.
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(92vh-78px)] overflow-y-auto p-5 md:p-6">
          {err ? (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>
          ) : null}

          <div className="mb-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Search</div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by hero name or troop type"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="min-w-[150px] rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/45">Roster Count</div>
                <div className="mt-2 text-3xl font-semibold text-white">{heroes.length}</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-white/55">Loading heroes…</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filtered.map((hero) => (
                <button
                  key={hero.hero_key}
                  onClick={() => onOpenHero(hero.profile_upload_id, hero.hero_key)}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"
                >
                  <div className="h-44 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    {hero.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hero.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/35">No saved image</div>
                    )}
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{hero.name || hero.hero_key}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">{hero.troop_type || "unknown"}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/75">
                      Lv {hero.level || 0}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-white/70">
                    <div>{statText("Stars", hero.stars || 0)}</div>
                    <div>{statText("Power", hero.base_stats?.power || 0)}</div>
                    <div>{statText("ATK", hero.base_stats?.atk || 0)}</div>
                    <div>{statText("DEF", hero.base_stats?.def || 0)}</div>
                    <div>{statText("HP", hero.base_stats?.hp || 0)}</div>
                    <div>{statText("March", hero.base_stats?.march_size || 0)}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={cx(
                        "rounded-xl border px-2 py-1 text-[11px]",
                        hero.completeness?.has_profile
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                          : "border-white/10 bg-black/20 text-white/50"
                      )}
                    >
                      Profile
                    </span>
                    <span
                      className={cx(
                        "rounded-xl border px-2 py-1 text-[11px]",
                        hero.completeness?.has_gear
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                          : "border-white/10 bg-black/20 text-white/50"
                      )}
                    >
                      Gear
                    </span>
                    <span
                      className={cx(
                        "rounded-xl border px-2 py-1 text-[11px]",
                        hero.completeness?.has_skills
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                          : "border-white/10 bg-black/20 text-white/50"
                      )}
                    >
                      Skills
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                    Open Hero Profile
                  </div>
                </button>
              ))}

              {!filtered.length ? (
                <div className="col-span-full rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/55">
                  No heroes matched your search.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
