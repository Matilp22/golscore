export default function MatchLoading() {
  return (
    <div className="min-h-screen bg-transparent px-0 py-3 text-white lg:px-5 lg:py-6">
      <div className="space-y-4">
        <section className="hf-card overflow-hidden rounded-3xl">
          <div className="hf-section-head px-4 py-3">
            <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-5">
            <div className="space-y-3">
              <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
              <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-16 animate-pulse rounded bg-white/6" />
            </div>
            <div className="h-12 w-24 animate-pulse rounded-2xl bg-black/30" />
            <div className="justify-self-end space-y-3 text-right">
              <div className="ml-auto h-12 w-12 animate-pulse rounded-full bg-white/10" />
              <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-white/6" />
            </div>
          </div>
        </section>

        <section className="hf-card overflow-hidden rounded-3xl">
          <div className="hf-section-head px-4 py-3">
            <div className="h-5 w-44 animate-pulse rounded bg-white/10" />
          </div>
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
