import Link from 'next/link'

import type { TransferMarketItem } from '@/content/editorial'
import ShareCardButton from '@/frontend/components/share/ShareCardButton'
import {
  formatEditorialDate,
  formatTransferStatus,
  formatTransferType,
} from '@/shared/editorial-format'

type TransferMovementDetailProps = {
  movement: TransferMarketItem
  readingMinutes: number
}

export default function TransferMovementDetail({
  movement,
  readingMinutes,
}: TransferMovementDetailProps) {
  const shareTargetId = `transfer-share-${movement.slug}`

  return (
    <main className="hf-editorial-detail is-market">
      <nav className="hf-editorial-breadcrumbs" aria-label="Migas de pan">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href="/mercado-de-pases">Mercado de pases</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{movement.playerName}</span>
      </nav>

      <article className="hf-transfer-detail">
        <header id={shareTargetId}>
          <div className="hf-editorial-article-kicker">
            <span className={`is-${movement.status}`}>
              {formatTransferStatus(movement.status)}
            </span>
            <span>{formatTransferType(movement.type)}</span>
            <span>{readingMinutes} min</span>
          </div>
          <h1>{movement.playerName}</h1>
          <p>{movement.summary}</p>
          <div className="hf-transfer-route">
            <div>
              <small>Origen</small>
              <strong>{movement.fromTeam}</strong>
            </div>
            <span aria-hidden="true">→</span>
            <div>
              <small>Destino</small>
              <strong>{movement.toTeam}</strong>
            </div>
          </div>
          <div className="hf-editorial-article-byline">
            <div>
              <strong>{movement.league}</strong>
              <span>
                Actualizado{' '}
                <time dateTime={movement.updatedAt}>
                  {formatEditorialDate(movement.updatedAt)}
                </time>
              </span>
            </div>
            <ShareCardButton
              targetId={shareTargetId}
              fileName={`${movement.slug}-hay-fulbo`}
              title={`${movement.playerName}: ${movement.fromTeam} a ${movement.toTeam}`}
              text={movement.summary}
              url={`/mercado-de-pases/${movement.slug}`}
              ariaLabel={`Compartir movimiento de ${movement.playerName}`}
              buttonTitle="Compartir movimiento"
            />
          </div>
        </header>

        <div className="hf-transfer-detail-body">
          {movement.status === 'rumor' ? (
            <p className="hf-transfer-warning" role="note">
              Esta información está marcada como rumor y puede cambiar. Revisá
              siempre la fuente y la fecha de actualización.
            </p>
          ) : null}
          {movement.body.map((block, index) => (
            <section key={`${block.heading ?? 'bloque'}-${index}`}>
              {block.heading ? <h2>{block.heading}</h2> : null}
              {block.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {block.bullets?.length ? (
                <ul>
                  {block.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <section className="hf-transfer-source">
            <p className="hf-type-overline">Fuente declarada</p>
            <a
              href={movement.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {movement.sourceName}
              <span aria-hidden="true"> ↗</span>
            </a>
          </section>
        </div>
      </article>
    </main>
  )
}
