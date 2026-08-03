import Link from 'next/link'

import { LeagueLogo } from '@/frontend/components/AssetImage'

import type { HfHomeCompetition } from '@/frontend/components/home/matchday/types'

export default function HomeStreamContext({
  competitions,
  totals,
}: {
  competitions: HfHomeCompetition[]
  totals: { all: number; live: number; upcoming: number; finished: number }
}) {
  return (
    <section className="hf-stream-context" aria-labelledby="stream-context-title">
      <header>
        <span>Jornada</span>
        <strong>{totals.all.toString().padStart(2, '0')}</strong>
        <h2 id="stream-context-title">El día en números</h2>
      </header>

      <dl>
        <div className="is-live">
          <dt>En vivo</dt>
          <dd>{totals.live}</dd>
        </div>
        <div>
          <dt>Por jugar</dt>
          <dd>{totals.upcoming}</dd>
        </div>
        <div>
          <dt>Finales</dt>
          <dd>{totals.finished}</dd>
        </div>
      </dl>

      <div className="hf-stream-context-leagues">
        <span>Competiciones</span>
        {competitions.slice(0, 8).map((competition) => {
          const content = (
            <>
              <LeagueLogo src={competition.logo} alt="" size={24} />
              <strong>{competition.title}</strong>
              <small>{competition.matches.length}</small>
            </>
          )

          return competition.href ? (
            <Link key={competition.key} href={competition.href}>
              {content}
            </Link>
          ) : (
            <div key={competition.key}>{content}</div>
          )
        })}
      </div>

      <Link href="/competiciones" className="hf-stream-context-all">
        Ver todas las competiciones
      </Link>
    </section>
  )
}
