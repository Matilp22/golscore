export default function PlayerLoading() {
  return (
    <main className="hf-player-page" aria-busy="true" aria-label="Cargando jugador">
      <header className="hf-entity-hero">
        <div className="hf-entity-identity">
          <span className="hf-skeleton hf-entity-mark is-player" />
          <div className="hf-entity-title">
            <span className="hf-skeleton h-3 w-20" />
            <span className="hf-skeleton mt-2 h-9 w-48 max-w-full" />
            <span className="hf-skeleton mt-2 h-4 w-40" />
          </div>
        </div>
      </header>
      <div className="hf-skeleton h-14 w-full rounded-xl" />
      <div className="hf-player-layout">
        <div className="hf-skeleton h-96 w-full rounded-2xl" />
        <div className="hf-skeleton h-72 w-full rounded-2xl" />
      </div>
    </main>
  )
}
