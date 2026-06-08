import type { AppLocale } from '@/shared/i18n/locales'
import {
  hasCountryTranslation,
  translateCountryName,
} from '@/shared/utils/country-names'

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isNationalTeamMatch(input: {
  league?: string | null
  country?: string | null
}) {
  const league = normalizeSearchText(input.league)
  const country = normalizeSearchText(input.country)

  if (
    league.includes('world cup') ||
    league.includes('copa del mundo') ||
    league.includes('international friendlies') ||
    league.includes('friendly international') ||
    league === 'friendlies' ||
    league.includes('copa america') ||
    league.includes('uefa euro') ||
    league.includes('european championship') ||
    league.includes('nations league') ||
    league.includes('qualifiers') ||
    league.includes('qualification') ||
    league.includes('eliminatorias') ||
    league.includes('africa cup of nations') ||
    league.includes('asian cup') ||
    league.includes('gold cup') ||
    league.includes('concacaf nations') ||
    league.includes('ofc nations')
  ) {
    return true
  }

  return (
    country.includes('world') &&
    !league.includes('champions') &&
    !league.includes('libertadores') &&
    !league.includes('sudamericana') &&
    !league.includes('europa league') &&
    !league.includes('conference league') &&
    !league.includes('intercontinental')
  )
}

export function getTeamDisplayName(input: {
  name: string
  league?: string | null
  country?: string | null
  locale?: AppLocale
}) {
  if (!isNationalTeamMatch(input)) return input.name
  if (!hasCountryTranslation(input.name)) return input.name

  return translateCountryName(input.name, input.locale ?? 'es') || input.name
}
