export default function RootLoading() {
  return (
    <main
      className="hf-loading-page"
      aria-busy="true"
      aria-label="Cargando Hay Fulbo"
      role="status"
    >
      <span className="hf-sr-only">Cargando contenido</span>
      <section className="hf-loading-hero">
        <span className="hf-ui-skeleton h-3 w-28" />
        <span className="hf-ui-skeleton h-10 w-64 max-w-full" />
        <span className="hf-ui-skeleton h-4 w-96 max-w-full" />
      </section>
      <section className="hf-loading-panel">
        <div className="hf-loading-panel-heading">
          <span className="hf-ui-skeleton h-6 w-44" />
          <span className="hf-ui-skeleton h-4 w-64 max-w-full" />
        </div>
        <div className="hf-loading-list">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="hf-loading-row"
            >
              <div>
                <span className="hf-ui-skeleton h-4 w-28" />
                <span className="hf-ui-skeleton h-3 w-16" />
              </div>
              <span className="hf-ui-skeleton h-9 w-16" />
              <div>
                <span className="hf-ui-skeleton h-4 w-28" />
                <span className="hf-ui-skeleton h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
