export default function RootLoading() {
  return (
    <div className="min-h-[70vh] w-full px-1 py-2 text-white sm:px-2 md:px-5 md:py-4">
      <div className="hf-card overflow-hidden rounded-3xl">
        <div className="hf-section-head px-4 py-4">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-white/10" />
          <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded bg-white/8" />
        </div>
        <div className="space-y-2 p-3">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3"
            >
              <div className="min-w-0 space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-16 animate-pulse rounded bg-white/6" />
              </div>
              <div className="h-8 w-16 animate-pulse rounded-xl bg-black/30" />
              <div className="min-w-0 space-y-2 justify-self-end">
                <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-white/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
