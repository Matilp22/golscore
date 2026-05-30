'use client'

import { useChampionsEntrySound } from '@/frontend/hooks/useChampionsEntrySound'

type ChampionsEntrySoundControlProps = {
  className?: string
}

export default function ChampionsEntrySoundControl({
  className = '',
}: ChampionsEntrySoundControlProps) {
  const {
    play,
    stop,
    blocked,
    enabled,
    setEnabled,
    available,
    availabilityChecked,
    played,
  } = useChampionsEntrySound()

  if (!availabilityChecked || !available) return null

  const label = !enabled ? 'Sonido off' : blocked || !played ? 'Activar sonido' : 'Sonido on'

  return (
    <button
      type="button"
      onClick={() => {
        if (!enabled) {
          setEnabled(true)
          void play()
          return
        }

        if (blocked || !played) {
          void play()
          return
        }

        setEnabled(false)
        stop()
      }}
      className={`inline-flex min-h-9 items-center justify-center rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-[#dce5ef] transition hover:border-[#7ff0b2]/35 hover:bg-[#7ff0b2]/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60 ${className}`}
      aria-pressed={enabled && !blocked}
      title={enabled && played && !blocked ? 'Desactivar sonido de entrada' : 'Activar sonido de entrada'}
    >
      {label}
    </button>
  )
}
