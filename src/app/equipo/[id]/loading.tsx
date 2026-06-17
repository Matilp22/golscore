export default function TeamLoading() {
  return (
    <div className="min-h-screen bg-transparent px-0 py-3 text-white lg:px-5 lg:py-6">
      <div className="space-y-4">
        <header className="overflow-hidden rounded-3xl border border-white/8 bg-[#0b1512]">
          <div className="flex items-center gap-4 px-3 py-4 md:px-4 md:py-5">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[#70ff9d]/20" />
              <div className="h-8 w-52 max-w-full animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-36 animate-pulse rounded bg-white/6" />
            </div>
          </div>
        </header>

        <section className="hf-card overflow-hidden rounded-3xl">
          <div className="hf-section-head px-4 py-3">
            <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
          </div>
          <div className="grid gap-2 p-3 md:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
