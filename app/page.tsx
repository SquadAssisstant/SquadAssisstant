export default function Home() {
  return (
    <main style={{ padding: 16 }}>
      <h1>SquadAssistant backend is live</h1>

      <ul>
        <li className="text-l">
          ✅
          <span className="ml-2">
            Heroes API:{" "}
            <a className="underline" href="/api/heroes" target="_blank">
              /api/heroes
            </a>
          </span>
        </li>

        <li className="text-l">
          ✅
          <span className="ml-2">
            Kimberly:{" "}
            <a className="underline" href="/api/heroes/kimberly" target="_blank">
              /api/heroes/kimberly
            </a>
          </span>
        </li>
      </ul>
    </main>
  );
}
