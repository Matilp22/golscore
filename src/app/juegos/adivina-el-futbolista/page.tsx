import type { Metadata } from 'next'

import GuessThePlayerGame from '@/frontend/components/games/GuessThePlayerGame'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { fetchAllTeamLogoRows } from '@/server/team-logo-lookup'
import { GUESS_PLAYER_POOLS } from '@/shared/config/guess-player-data'
import { buildSeoMetadata } from '@/shared/seo'
import { pickTeamLogoUrl } from '@/shared/utils/asset-urls'

export const metadata: Metadata = buildSeoMetadata({
  title: '¿Quién es el futbolista? | Hay Fulbo',
  description: 'Adiviná futbolistas por sus clubes y datos de carrera en tres niveles.',
  path: '/juegos/adivina-el-futbolista',
})

function normalizeTeamName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function canonicalTeamKey(value: string) {
  return normalizeTeamName(
    value
      .replace(/\b(fc|cf|ac|sc|club|selección|de|del|the)\b/gi, ' ')
      .replace(/\bmúnich\b/gi, 'munich')
      .replace(/\bmünchen\b/gi, 'munich')
      .replace(/\bmarsella\b/gi, 'marseille')
      .replace(/\bsevilla\b/gi, 'sevilla')
  )
}

const TEAM_NAME_ALIASES: Record<string, string[]> = {
  'inter': ['inter milan', 'internazionale'],
  'paris saint-germain': ['paris saint germain', 'psg'],
  'bayern munich': ['bayern munchen', 'fc bayern munchen'],
  'bayern munchen': ['bayern munich', 'bayern munchen'],
  'atletico de madrid': ['atletico madrid'],
  'rb salzburgo': ['red bull salzburg', 'salzburg'],
  'dinamo de kiev': ['dynamo kyiv', 'dynamo kiev'],
  'roma': ['as roma'],
  'milan': ['ac milan'],
  'inter miami': ['inter miami cf'],
  'new york cosmos': ['ny cosmos'],
  'sporting cp': ['sporting lisbon'],
  'unam': ['pumas unam'],
}

async function getClubLogos() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return {}

  try {
    const rows = await fetchAllTeamLogoRows(supabase)
    const byName = new Map<string, string>()
    const byCanonicalName = new Map<string, string>()
    for (const row of rows) {
      if (!row.name) continue
      const logoUrl = pickTeamLogoUrl(row.logo_url, row.external_id)
      if (!logoUrl) continue
      byName.set(normalizeTeamName(row.name), logoUrl)
      const canonical = canonicalTeamKey(row.name)
      if (!byCanonicalName.has(canonical)) byCanonicalName.set(canonical, logoUrl)
    }
    const clubNames = new Set(
      Object.values(GUESS_PLAYER_POOLS).flatMap((players) =>
        players.flatMap((player) => player.teams)
      )
    )

    return Object.fromEntries(
      [...clubNames].map((name) => {
        const candidates = [
          name,
          ...(TEAM_NAME_ALIASES[name.toLowerCase()] || []),
        ]
        const logoUrl = candidates
          .map((candidate) => [
            byName.get(normalizeTeamName(candidate)),
            byCanonicalName.get(canonicalTeamKey(candidate)),
          ])
          .flat()
          .find(Boolean)
        return [name, logoUrl || null]
      })
    )
  } catch {
    return {}
  }
}

export default async function GuessThePlayerPage() {
  const clubLogos = await getClubLogos()
  return <GuessThePlayerGame clubLogos={clubLogos} />
}
