export default function TeamLoading() {
  return (
    <main className="hf-team-page" aria-busy="true" aria-label="Cargando equipo">
      <header className="hf-entity-hero">
        <div className="hf-entity-identity">
          <span className="hf-skeleton hf-entity-mark" />
          <div className="hf-entity-title">
            <span className="hf-skeleton h-3 w-20" />
            <span className="hf-skeleton mt-2 h-9 w-52 max-w-full" />
            <span className="hf-skeleton mt-2 h-4 w-32" />
          </div>
        </div>
      </header>
      <div className="hf-skeleton h-14 w-full rounded-xl" />
      <div className="hf-skeleton h-36 w-full rounded-2xl" />
      <div className="hf-team-layout">
        <div className="hf-skeleton h-96 w-full rounded-2xl" />
        <div className="hf-skeleton h-72 w-full rounded-2xl" />
      </div>
    </main>
  )
}
