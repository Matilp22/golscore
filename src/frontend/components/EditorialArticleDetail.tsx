import { Fragment } from 'react'
import Link from 'next/link'

import type { EditorialArticle } from '@/content/editorial'
import ShareCardButton from '@/frontend/components/share/ShareCardButton'
import {
  formatEditorialCategory,
  formatEditorialDate,
} from '@/shared/editorial-format'

type EditorialArticleDetailProps = {
  article: EditorialArticle
  relatedArticles: EditorialArticle[]
  relatedBasePath: '/noticias' | '/mercado-de-pases'
  readingMinutes: number
}

export function EditorialArticleDetail({
  article,
  relatedArticles,
  relatedBasePath,
  readingMinutes,
}: EditorialArticleDetailProps) {
  const shareTargetId = `editorial-share-${article.slug}`
  const channelLabel =
    relatedBasePath === '/noticias' ? 'Noticias' : 'Mercado de pases'

  return (
    <main className="hf-editorial-detail">
      <nav className="hf-editorial-breadcrumbs" aria-label="Migas de pan">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href={relatedBasePath}>{channelLabel}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{article.title}</span>
      </nav>

      <article className="hf-editorial-article">
        <header id={shareTargetId} className="hf-editorial-article-header">
          <div className="hf-editorial-article-kicker">
            <span>{formatEditorialCategory(article.category)}</span>
            <span>Lectura de {readingMinutes} min</span>
          </div>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
          <div className="hf-editorial-article-byline">
            <div>
              <strong>{article.author}</strong>
              <span>
                Publicado{' '}
                <time dateTime={article.publishedAt}>
                  {formatEditorialDate(article.publishedAt)}
                </time>
                {article.updatedAt !== article.publishedAt ? (
                  <>
                    {' · '}Actualizado{' '}
                    <time dateTime={article.updatedAt}>
                      {formatEditorialDate(article.updatedAt)}
                    </time>
                  </>
                ) : null}
              </span>
            </div>
            <ShareCardButton
              targetId={shareTargetId}
              fileName={`${article.slug}-hay-fulbo`}
              title={article.title}
              text={article.summary}
              url={`${relatedBasePath}/${article.slug}`}
              ariaLabel={`Compartir ${article.title}`}
              buttonTitle="Compartir artículo"
            />
          </div>
        </header>

        <figure className="hf-editorial-article-hero">
          {article.heroImage ? (
            // Editorial images can point to local or allow-listed remote assets.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.heroImage}
              alt={article.title}
              loading="eager"
            />
          ) : (
            <div className="hf-editorial-article-placeholder">
              <span aria-hidden="true">HF</span>
              <p>Esta nota no tiene una imagen de portada publicada.</p>
            </div>
          )}
        </figure>

        <div className="hf-editorial-article-layout">
          <div className="hf-editorial-article-body">
            {article.body.map((block, blockIndex) => (
              <section
                key={`${block.heading ?? 'bloque'}-${blockIndex}`}
                className="hf-editorial-prose-section"
              >
                {block.heading ? <h2>{block.heading}</h2> : null}
                {block.paragraphs.map((paragraph, index) => (
                  <Fragment key={`${blockIndex}-${index}`}>
                    <p>{paragraph}</p>
                    {index === 0 && block.image ? (
                      <figure className="hf-editorial-inline-image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={block.image.src}
                          alt={block.image.alt}
                          loading="lazy"
                        />
                        {block.image.caption ? (
                          <figcaption>{block.image.caption}</figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                  </Fragment>
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
          </div>

          <aside className="hf-editorial-article-aside">
            <div>
              <p className="hf-type-overline">Sobre esta nota</p>
              <dl>
                <div>
                  <dt>Categoría</dt>
                  <dd>{formatEditorialCategory(article.category)}</dd>
                </div>
                <div>
                  <dt>Autor</dt>
                  <dd>{article.author}</dd>
                </div>
                <div>
                  <dt>Tiempo</dt>
                  <dd>{readingMinutes} minutos</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>

        {article.sources.length ? (
          <section className="hf-editorial-sources">
            <p className="hf-type-overline">Fuentes consultadas</p>
            <ul>
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {source.label}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      {relatedArticles.length ? (
        <section
          className="hf-editorial-related"
          aria-labelledby="editorial-related-title"
        >
          <div>
            <p className="hf-type-overline">Seguir leyendo</p>
            <h2 id="editorial-related-title">Lecturas relacionadas</h2>
          </div>
          <div>
            {relatedArticles.map((related, index) => (
              <Link
                key={related.slug}
                href={`${relatedBasePath}/${related.slug}`}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{related.title}</strong>
                <small>
                  {formatEditorialCategory(related.category)} ·{' '}
                  {formatEditorialDate(related.updatedAt)}
                </small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
