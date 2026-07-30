'use client'

import { useEffect, useRef, useState } from 'react'

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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const dialog = dialogRef.current
    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        return
      }

      if (event.key !== 'Tab' || !dialog) return

      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        ),
      ]
      const first = focusable[0]
      const last = focusable.at(-1)

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      trigger?.focus()
    }
  }, [isOpen])

  if (!champions.length) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="hf-competition-history-trigger"
        aria-haspopup="dialog"
      >
        {t('stage.champions')}
      </button>

      {isOpen ? (
        <div className="hf-competition-history-overlay">
          <button
            type="button"
            className="hf-competition-history-backdrop"
            aria-label={t('stage.closeChampions')}
            onClick={() => setIsOpen(false)}
          />

          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tournament-champions-title"
            className="hf-competition-history-dialog"
          >
            <header>
              <div>
                <p className="hf-type-overline">{t('stage.history')}</p>
                <h2 id="tournament-champions-title">{competitionName}</h2>
                <p>{champions.length} ediciones documentadas</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t('common.close')}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="hf-competition-history-list">
              {champions.map((champion) => (
                <article
                  key={`${competitionName}-${champion.season}-${champion.championName}`}
                >
                  <time dateTime={champion.season}>{champion.season}</time>
                  <div>
                    <TeamLogo
                      src={champion.championLogo}
                      alt={champion.championName}
                      size={26}
                      className="h-[1.625rem] w-[1.625rem] object-contain"
                      fallbackClassName="h-6 w-5"
                      unoptimized
                    />
                    <strong>{champion.championName}</strong>
                    <span>{t('stage.champion')}</span>
                  </div>
                  <p>
                    <strong>{champion.finalScore || 'Sin resultado'}</strong>
                    <span>vs</span>
                  </p>
                  <div>
                    <TeamLogo
                      src={champion.runnerUpLogo}
                      alt={champion.runnerUpName}
                      size={24}
                      className="h-6 w-6 object-contain"
                      fallbackClassName="h-5 w-4"
                      unoptimized
                    />
                    <strong>{champion.runnerUpName}</strong>
                    <span>Subcampeón</span>
                  </div>
                  <small>{champion.venue || t('common.notAvailable')}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
