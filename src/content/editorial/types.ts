export type EditorialCategory =
  | 'mundial-2026'
  | 'futbol-argentino'
  | 'libertadores'
  | 'champions'
  | 'guias'
  | 'estadisticas'
  | 'historias-mundialistas'
  | 'momento-bajonero'
  | 'prode'

export type EditorialBodyBlock = {
  heading?: string
  paragraphs: string[]
  bullets?: string[]
  image?: EditorialImage
}

export type EditorialImage = {
  src: string
  alt: string
  caption?: string
}

export type EditorialSource = {
  label: string
  url: string
}

export type EditorialArticle = {
  slug: string
  title: string
  summary: string
  category: EditorialCategory
  tags: string[]
  author: string
  publishedAt: string
  updatedAt: string
  heroImage?: string
  sources: EditorialSource[]
  relatedSlugs: string[]
  body: EditorialBodyBlock[]
}

export type TransferMarketStatus =
  | 'confirmado'
  | 'rumor'
  | 'negociacion'
  | 'caido'

export type TransferMarketType =
  | 'alta'
  | 'baja'
  | 'prestamo'
  | 'renovacion'
  | 'jugador-libre'

export type TransferMarketItem = {
  slug: string
  playerName: string
  playerPhoto?: string
  fromTeam: string
  toTeam: string
  league: string
  country: string
  status: TransferMarketStatus
  type: TransferMarketType
  sourceName: string
  sourceUrl: string
  publishedAt: string
  updatedAt: string
  summary: string
  body: EditorialBodyBlock[]
}
