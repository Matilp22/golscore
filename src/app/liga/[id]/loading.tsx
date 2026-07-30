export default function LeagueLoading() {
  return (
    <main className="hf-loading-page" aria-busy="true" aria-label="Cargando competencia">
      <header className="hf-loading-entity-hero">
        <span className="hf-ui-skeleton is-rounded h-16 w-16" />
        <div>
          <span className="hf-ui-skeleton h-3 w-28" />
          <span className="hf-ui-skeleton h-9 w-56 max-w-full" />
          <span className="hf-ui-skeleton h-4 w-40" />
        </div>
      </header>

      <section className="hf-loading-panel">
        <div className="hf-loading-panel-heading">
          <span className="hf-ui-skeleton h-6 w-48" />
        </div>
        <div className="hf-loading-list">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="hf-loading-table-row">
              <span className="hf-ui-skeleton is-rounded h-7 w-7" />
              <div>
                <span className="hf-ui-skeleton h-4 w-36" />
                <span className="hf-ui-skeleton h-3 w-24" />
              </div>
              <span className="hf-ui-skeleton h-5 w-10" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
