'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

import type { LeaderStatType, TopPlayerRow } from '@/lib/api-football'

type LeaderListInteractiveProps = {
  title: string
  rows: TopPlayerRow[]
  accentClass: string
  leagueId?: number
  season?: number
  statType: LeaderStatType
}

export default function LeaderListInteractive({
  title,
  rows,
  accentClass,
  leagueId,
  season,
  statType,
}: LeaderListInteractiveProps) {
  const [showAll, setShowAll] = useState(false)
  const visibleRows = showAll ? rows : rows.slice(0, 10)
  const hasMoreRows = rows.length > 10

  return (
    <section className="overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white md:text-lg">{title}</h2>
          <span className="text-[11px] uppercase tracking-[0.14em] text-[#8d98a7]">
            {rows.length} jugadores
          </span>
        </div>
      </div>

      <div className="p-4">
        {rows.length ? (
          <div className="space-y-2">
            {visibleRows.map((row, index) => {
              const displayIndex = showAll ? index + 1 : index + 1
              const href =
                row.playerId && leagueId && season
                  ? `/jugador/${row.playerId}?leagueId=${leagueId}&season=${season}&statType=${statType}&expectedCount=${row.value}&name=${encodeURIComponent(row.name)}&photo=${encodeURIComponent(row.photo || '')}&teamId=${row.teamId || ''}&teamName=${encodeURIComponent(row.teamName || '')}&teamLogo=${encodeURIComponent(row.teamLogo || '')}`
                  : null

              const content = (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 text-sm font-black text-[#7f8a98]">{displayIndex}</span>
                    {row.photo ? (
                      <Image
                        src={row.photo}
                        alt={row.name}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-[#20262e]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{row.name}</p>
                      <p className="truncate text-xs text-[#8d98a7]">
                        {row.teamName || 'Sin equipo'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-lg font-black ${accentClass}`}>{row.value}</span>
                </>
              )

              if (!href) {
                return (
                  <div
                    key={`${row.playerId || row.name}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-[#151a20] px-3 py-3 opacity-80"
                  >
                    {content}
                  </div>
                )
              }

              return (
                <Link
                  key={`${row.playerId || row.name}-${index}`}
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-[#151a20] px-3 py-3 transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.015] hover:border-white/12 hover:bg-[#192028]"
                >
                  {content}
                </Link>
              )
            })}

            {hasMoreRows ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAll((current) => !current)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-[#13181d] px-4 py-3 text-sm font-semibold text-[#dce5ef] transition hover:border-white/12 hover:bg-[#171d24]"
                  aria-expanded={showAll}
                >
                  <span>{showAll ? 'Mostrar solo 10 jugadores' : 'Ver todos los jugadores'}</span>
                  <span className={`text-[#8fa0b1] transition ${showAll ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[#8d98a7]">No hay datos disponibles para este ranking.</p>
        )}
      </div>
    </section>
  )
}
