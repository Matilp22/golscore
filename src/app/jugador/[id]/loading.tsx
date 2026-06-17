export default function PlayerLoading() {
  return (
    <div className="min-h-screen bg-transparent px-0 py-3 text-white lg:px-5 lg:py-6">
      <div className="space-y-4">
        <header className="overflow-hidden rounded-3xl border border-white/8 bg-[#0b1512]">
          <div className="flex items-center gap-4 px-3 py-4 md:px-4 md:py-5">
            <div className="h-20 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[#70ff9d]/20" />
              <div className="h-8 w-48 max-w-full animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-40 animate-pulse rounded bg-white/6" />
            </div>
          </div>
        </header>

        <section className="hf-card overflow-hidden rounded-3xl">
          <div className="hf-section-head px-4 py-3">
            <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
          </div>
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="grid grid-cols-[1fr_120px] gap-3 rounded-xl border border-white/6 px-3 py-3"
              >
                <div className="h-4 animate-pulse rounded bg-white/6" />
                <div className="h-4 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
