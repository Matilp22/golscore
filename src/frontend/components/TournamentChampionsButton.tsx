'use client'

import { useState } from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import { useTranslations } from '@/frontend/components/LocaleProvider'
import type { TournamentChampion } from '@/server/tournament-champions'

type TournamentChampionsButtonProps = {
  competitionName: string
  champions: TournamentChampion[]
}

export default function TournamentChampionsButton({
  competitionName,
  champions,
}: TournamentChampionsButtonProps) {
  const { t } = useTranslations()
  const [isOpen, setIsOpen] = useState(false)

  if (!champions.length) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#c89d35] bg-[linear-gradient(135deg,#7c5513_0%,#d5a940_48%,#8a5f16_100%)] px-3 py-2 text-sm font-black text-[#150f05] shadow-[0_0_18px_rgba(213,169,64,0.18),inset_0_1px_0_rgba(255,255,255,0.34)] transition hover:border-[#f0c85a] hover:shadow-[0_0_24px_rgba(240,200,90,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] sm:px-4"
      >
        {t('stage.champions')}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-2 py-4 sm:px-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t('stage.closeChampions')}
            onClick={() => setIsOpen(false)}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tournament-champions-title"
            className="relative max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[#3b3320] bg-[#0f1317] shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-[#15181d] px-3 py-3 sm:px-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d5a940]">
                  {t('stage.history')}
                </p>
                <h2
                  id="tournament-champions-title"
                  className="truncate text-lg font-black text-white"
                >
                  {competitionName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-white/10 bg-[#10151a] px-3 text-sm font-bold text-[#dce5ef] transition hover:border-[#d5a940]/60 hover:text-white"
              >
                {t('common.close')}
              </button>
            </div>

            <div className="max-h-[72vh] overflow-auto">
              <table className="min-w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-[#11161b] text-[#8d98a7]">
                  <tr className="border-b border-white/8">
                    <th className="px-2.5 py-2 font-bold sm:px-4">{t('stage.edition')}</th>
                    <th className="px-2.5 py-2 font-bold sm:px-4">{t('stage.champion')}</th>
                    <th className="px-2.5 py-2 font-bold sm:px-4">{t('common.final')}</th>
                    <th className="px-2.5 py-2 font-bold sm:px-4">{t('stage.result')}</th>
                    <th className="hidden px-2.5 py-2 font-bold md:table-cell sm:px-4">{t('stage.venue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {champions.map((champion) => (
                    <tr
                      key={`${competitionName}-${champion.season}-${champion.championName}`}
                      className="border-b border-white/7 text-[#dce5ef] last:border-b-0"
                    >
                      <td className="px-2.5 py-2 font-black text-white sm:px-4">
                        {champion.season}
                      </td>
                      <td className="px-2.5 py-2 sm:px-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo
                            src={champion.championLogo}
                            alt={champion.championName}
                            size={20}
                            className="h-5 w-5 object-contain"
                            fallbackClassName="h-4 w-3.5"
                            unoptimized
                          />
                          <span className="truncate font-black text-[#d5a940]">
                            {champion.championName}
                          </span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2 sm:px-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-[#8d98a7]">vs</span>
                          <TeamLogo
                            src={champion.runnerUpLogo}
                            alt={champion.runnerUpName}
                            size={18}
                            className="h-[18px] w-[18px] object-contain"
                            fallbackClassName="h-4 w-3"
                            unoptimized
                          />
                          <span className="truncate font-semibold">{champion.runnerUpName}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2 font-black text-white sm:px-4">
                        {champion.finalScore}
                      </td>
                      <td className="hidden px-2.5 py-2 text-[#9aa6b2] md:table-cell sm:px-4">
                        {champion.venue || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
