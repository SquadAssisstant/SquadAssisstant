type MainChatContext = {
  summary: string;
  heroCount: number;
  squadStateLoaded: boolean;
  battleFileCount: number;
  optimizerFileCount: number;
};

async function getJsonFromInternalApi<T>(req: Request, path: string): Promise<T | null> {
  try {
    const url = new URL(path, req.url);
    const cookie = req.headers.get("cookie") ?? "";

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        cookie,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}

export async function buildMainChatContext(req: Request): Promise<MainChatContext> {
  const [heroes, playerState, battleGroups, optimizerSaved] = await Promise.all([
    getJsonFromInternalApi<{ ok?: boolean; heroes?: any[] }>(req, "/api/heroes"),
    getJsonFromInternalApi<{ ok?: boolean; state?: any }>(req, "/api/player/state"),
    getJsonFromInternalApi<{ ok?: boolean; groups?: any[] }>(req, "/api/battle/groups?limit=10"),
    getJsonFromInternalApi<{ ok?: boolean; files?: any[] }>(req, "/api/optimizer/saved?limit=10"),
  ]);

  const heroCount = Array.isArray(heroes?.heroes) ? heroes!.heroes!.length : 0;
  const squadStateLoaded = Boolean(playerState?.state);
  const battleFileCount = Array.isArray(battleGroups?.groups) ? battleGroups!.groups!.length : 0;
  const optimizerFileCount = Array.isArray(optimizerSaved?.files) ? optimizerSaved!.files!.length : 0;

  return {
    summary: [
      `Saved heroes loaded: ${heroCount}`,
      `Player squad state loaded: ${squadStateLoaded ? "yes" : "no"}`,
      `Saved battle files available: ${battleFileCount}`,
      `Saved optimizer files available: ${optimizerFileCount}`,
    ].join("\n"),
    heroCount,
    squadStateLoaded,
    battleFileCount,
    optimizerFileCount,
  };
}
