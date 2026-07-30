import type { ReactNode } from 'react'

import type {
  MatchListItemWithGoalScorers,
} from '@/lib/api-football'
import type { AppLocale } from '@/shared/i18n/locales'

export type HomeProdePrediction = {
  predictedHomeScore: number
  predictedAwayScore: number
}

export type HfHomeMatch = MatchListItemWithGoalScorers & {
  displayTime: string
  displayScore: string
  displayStatus: string
  prediction?: HomeProdePrediction | null
}

export type HfHomeCompetition = {
  key: string
  title: string
  logo?: string
  href?: string | null
  matches: HfHomeMatch[]
}

export type HfHomeArticle = {
  slug: string
  title: string
  summary: string
  category: string
  updatedAt: string
  heroImage?: string
  image?: string
}

export type HomeMatchEntry = {
  match: HfHomeMatch
  competition: HfHomeCompetition
}

export type HfHomeRedesignProps = {
  locale: AppLocale
  dayOptions: Array<{ label: string; value: string }>
  selectedDate: string
  competitions: HfHomeCompetition[]
  articles: HfHomeArticle[]
  autoRefresh: ReactNode
  dataError?: string | null
  noMatchesLabel: string
}
