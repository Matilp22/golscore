function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeCompetitionDisplayName(value: string | null | undefined) {
  const label = value?.trim() || 'Competencia'
  const normalized = normalizeSearchText(label)

  if (!normalized) return 'Competencia'

  if (
    normalized.includes('international friendlies') ||
    normalized.includes('friendly international') ||
    normalized.includes('friendlies')
  ) {
    return 'Amistoso internacional'
  }

  if (
    normalized.includes('world cup qualification') ||
    normalized.includes('world cup qualifiers') ||
    normalized.includes('eliminatorias mundial')
  ) {
    return 'Eliminatorias Mundial'
  }

  if (
    normalized === 'world cup' ||
    normalized === 'fifa world cup' ||
    normalized.includes('copa del mundo')
  ) {
    return 'Copa del Mundo'
  }

  if (normalized.includes('copa america')) return 'Copa America'
  if (normalized.includes('uefa euro') || normalized.includes('european championship')) return 'Eurocopa'
  if (normalized.includes('nations league')) return 'Liga de Naciones'
  if (normalized.includes('gold cup')) return 'Copa Oro'
  if (normalized.includes('africa cup of nations')) return 'Copa Africana de Naciones'
  if (normalized.includes('asian cup')) return 'Copa Asiatica'
  if (normalized.includes('finalissima')) return 'Finalissima'

  return label
}

export function getCompetitionStageDisplayLabel(
  leagueName: string | null | undefined,
  round: string | number | null | undefined
) {
  const competition = normalizeCompetitionDisplayName(leagueName)
  const roundLabel = String(round ?? '').trim()

  if (!roundLabel) {
    return competition === 'Amistoso internacional' ? 'Amistoso' : 'Partido'
  }

  const normalizedRound = normalizeSearchText(roundLabel)

  if (competition === 'Amistoso internacional') return 'Amistoso'
  if (normalizedRound.includes('group stage')) return roundLabel.replace(/group stage/i, 'Fase de grupos')
  if (normalizedRound.includes('round of 16')) return 'Octavos de final'
  if (normalizedRound.includes('quarter')) return 'Cuartos de final'
  if (normalizedRound.includes('semi')) return 'Semifinal'
  if (normalizedRound === 'final' || normalizedRound.endsWith(' final')) return 'Final'

  return roundLabel
}
