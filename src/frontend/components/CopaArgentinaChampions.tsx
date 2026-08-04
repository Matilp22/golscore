'use client'

import TournamentChampionsButton from '@/frontend/components/TournamentChampionsButton'
import type { CopaArgentinaChampion } from '@/server/copa-argentina/champions'

type CopaArgentinaChampionsProps = {
  champions: CopaArgentinaChampion[]
}

export default function CopaArgentinaChampions({
  champions,
}: CopaArgentinaChampionsProps) {
  return (
    <TournamentChampionsButton
      competitionName="Copa Argentina"
      champions={champions.map((champion) => ({
        ...champion,
        season: String(champion.season),
      }))}
    />
  )
}
