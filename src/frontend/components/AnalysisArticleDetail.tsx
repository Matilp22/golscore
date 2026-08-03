import Link from 'next/link'

import type { EditorialArticle } from '@/server/editorial/articles'
import ShareCardButton from '@/frontend/components/share/ShareCardButton'
import { formatEditorialDate } from '@/shared/editorial-format'

type MarkdownBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

function parseMarkdownContent(content: string) {
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }
  const flushList = () => {
    if (!listItems.length) return
    blocks.push({ type: 'list', items: listItems })
    listItems = []
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushList()
    } else if (trimmed.startsWith('## ')) {
      flushParagraph()
      flushList()
      blocks.push({
        type: 'heading',
        text: trimmed.replace(/^##\s+/, ''),
      })
    } else if (trimmed.startsWith('- ')) {
      flushParagraph()
      listItems.push(trimmed.replace(/^-\s+/, ''))
    } else {
      flushList()
      paragraph.push(trimmed)
    }
  }

  flushParagraph()
  flushList()
  return blocks
}

export default function AnalysisArticleDetail({
  article,
  relatedArticles,
}: {
  article: EditorialArticle
  relatedArticles: EditorialArticle[]
}) {
  const readingMinutes = Math.max(1, Math.ceil(article.wordCount / 220))
  const shareTargetId = `analysis-share-${article.slug}`
  const blocks = parseMarkdownContent(article.content)

  return (
    <main className="hf-editorial-detail is-analysis">
      <nav className="hf-editorial-breadcrumbs" aria-label="Migas de pan">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href="/analisis">Análisis</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{article.title}</span>
      </nav>

      <article className="hf-editorial-article">
        <header id={shareTargetId} className="hf-editorial-article-header">
          <div className="hf-editorial-article-kicker">
            <span>{article.category}</span>
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
                {' · '}Actualizado{' '}
                <time dateTime={article.updatedAt}>
                  {formatEditorialDate(article.updatedAt)}
                </time>
              </span>
            </div>
            <ShareCardButton
              targetId={shareTargetId}
              fileName={`${article.slug}-hay-fulbo`}
              title={article.title}
              text={article.summary}
              url={`/analisis/${article.slug}`}
              ariaLabel={`Compartir ${article.title}`}
              buttonTitle="Compartir guía"
            />
          </div>
        </header>

        <figure className="hf-editorial-article-hero">
          {article.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.image} alt={article.title} loading="eager" />
          ) : (
            <div className="hf-editorial-article-placeholder">
              <span aria-hidden="true">HF</span>
              <p>Esta guía no tiene una imagen de portada publicada.</p>
            </div>
          )}
        </figure>

        <div className="hf-editorial-article-layout">
          <div className="hf-editorial-article-body">
            {blocks.map((block, index) => {
              if (block.type === 'heading') {
                return (
                  <section
                    key={`${block.type}-${index}`}
                    className="hf-editorial-prose-section"
                  >
                    <h2>{block.text}</h2>
                  </section>
                )
              }
              if (block.type === 'list') {
                return (
                  <section
                    key={`${block.type}-${index}`}
                    className="hf-editorial-prose-section"
                  >
                    <ul>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                )
              }
              return (
                <section
                  key={`${block.type}-${index}`}
                  className="hf-editorial-prose-section"
                >
                  <p>{block.text}</p>
                </section>
              )
            })}
          </div>
          <aside className="hf-editorial-article-aside">
            <div>
              <p className="hf-type-overline">Ficha de lectura</p>
              <dl>
                <div>
                  <dt>Categoría</dt>
                  <dd>{article.category}</dd>
                </div>
                <div>
                  <dt>Extensión</dt>
                  <dd>{article.wordCount} palabras</dd>
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
                  <a href={source.url} rel="noopener noreferrer" target="_blank">
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
        <section className="hf-editorial-related">
          <div>
            <p className="hf-type-overline">Seguir leyendo</p>
            <h2>Guías relacionadas</h2>
          </div>
          <div>
            {relatedArticles.map((related) => (
              <Link key={related.slug} href={`/analisis/${related.slug}`}>
                <strong>{related.title}</strong>
                <small>
                  {related.category} · {formatEditorialDate(related.updatedAt)}
                </small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
