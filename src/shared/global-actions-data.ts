export type GlobalActionTeam = {
  id: string
  name: string
  logoUrl?: string | null
  country?: string | null
  href: string
}

export type GlobalActionCompetition = {
  key: string
  title: string
  country?: string | null
  href: string
}

export type GlobalActionMatch = {
  id: string
  fixtureId: number
  href: string
  date: string
  displayTime: string
  displayScore: string
  displayStatus: string
  statusShort: string
  minute?: number | null
  home: string
  away: string
  homeId?: string | null
  awayId?: string | null
  homeLogo?: string | null
  awayLogo?: string | null
  tvLabel?: string | null
  tvLogoUrl?: string | null
}

export type GlobalActionLiveEvent = {
  id: string
  matchId: string
  fixtureId: number
  href: string
  title: string
  description: string
  teamName?: string | null
  createdAt: string
}

export type GlobalActionPage = {
  key: string
  title: string
  description: string
  href: string
}

export type GlobalActionsData = {
  generatedAt: string
  teams: GlobalActionTeam[]
  competitions: GlobalActionCompetition[]
  matches: GlobalActionMatch[]
  liveEvents: GlobalActionLiveEvent[]
  pages: GlobalActionPage[]
}
