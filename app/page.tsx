export default function Home() {
  return (
    <main style={{ padding: 16 }}>
      <h1>SquadAssistant backend is live</h1>
      <p>Sanity links:</p>
      <ul>
        <li><a href="/api/heroes" target="_blank">/api/heroes</a></li>
        <li><a href="/api/heroes/kimberly" target="_blank">/api/heroes/kimberly</a></li>
        <li><a href="/api/gear" target="_blank">/api/gear</a></li>
        <li><a href="/api/gear?slot=weapon" target="_blank">/api/gear?slot=weapon</a></li>
      </ul>
    </main>
  );
}
