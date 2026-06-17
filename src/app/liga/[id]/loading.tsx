export default function LeagueLoading() {
  return (
    <div className="min-h-screen bg-transparent px-0 py-3 text-white lg:px-5 lg:py-6">
      <div className="w-full space-y-4">
        <header className="overflow-hidden rounded-3xl border border-white/8 bg-[#0b1512]">
          <div className="flex items-center gap-4 px-3 py-4 md:px-4 md:py-5">
            <div className="h-14 w-14 animate-pulse rounded-2xl bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-[#70ff9d]/20" />
              <div className="h-8 w-56 max-w-full animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-40 animate-pulse rounded bg-white/6" />
            </div>
          </div>
        </header>

        <section className="hf-card overflow-hidden rounded-3xl">
          <div className="hf-section-head px-4 py-3">
            <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
          </div>
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="grid grid-cols-[32px_minmax(0,1fr)_44px] items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3"
              >
                <div className="h-6 w-6 animate-pulse rounded-full bg-white/10" />
                <div className="space-y-2">
                  <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-24 animate-pulse rounded bg-white/6" />
                </div>
                <div className="h-5 w-10 animate-pulse rounded bg-white/8" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
