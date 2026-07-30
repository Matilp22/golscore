export default function MatchLoading() {
  return (
    <main className="hf-loading-page" aria-busy="true" aria-label="Cargando partido">
      <section className="hf-loading-scoreboard">
        <span className="hf-ui-skeleton h-4 w-36" />
        <div className="hf-loading-scoreboard-teams">
          <div>
            <span className="hf-ui-skeleton is-rounded h-14 w-14" />
            <span className="hf-ui-skeleton h-5 w-28" />
            <span className="hf-ui-skeleton h-3 w-16" />
          </div>
          <span className="hf-ui-skeleton h-12 w-24" />
          <div>
            <span className="hf-ui-skeleton is-rounded h-14 w-14" />
            <span className="hf-ui-skeleton h-5 w-28" />
            <span className="hf-ui-skeleton h-3 w-16" />
          </div>
        </div>
      </section>

      <section className="hf-loading-panel">
        <div className="hf-loading-panel-heading">
          <span className="hf-ui-skeleton h-6 w-44" />
        </div>
        <div className="hf-loading-list">
          {[0, 1, 2].map((item) => (
            <span key={item} className="hf-ui-skeleton h-14 w-full" />
          ))}
        </div>
      </section>
    </main>
  )
}
