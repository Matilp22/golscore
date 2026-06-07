const MOJIBAKE_FIXES: Record<string, string> = {
  'EspaÃ±a': 'España',
  'MÃ©xico': 'México',
  'CanadÃ¡': 'Canadá',
  'PaÃ­ses Bajos': 'Países Bajos',
  'CÃ³rdoba': 'Córdoba',
  'Cerro PorteÃ±o': 'Cerro Porteño',
}

const COUNTRY_TRANSLATIONS: Record<string, string> = {
  argentina: 'Argentina',
  brazil: 'Brasil',
  brasil: 'Brasil',
  england: 'Inglaterra',
  spain: 'España',
  españa: 'España',
  italy: 'Italia',
  germany: 'Alemania',
  france: 'Francia',
  portugal: 'Portugal',
  netherlands: 'Países Bajos',
  holland: 'Países Bajos',
  'united states': 'Estados Unidos',
  usa: 'Estados Unidos',
  mexico: 'México',
  méxico: 'México',
  canada: 'Canadá',
  canadá: 'Canadá',
  peru: 'Perú',
  perú: 'Perú',
  uruguay: 'Uruguay',
  paraguay: 'Paraguay',
  colombia: 'Colombia',
  chile: 'Chile',
  bolivia: 'Bolivia',
  ecuador: 'Ecuador',
  venezuela: 'Venezuela',
  belgium: 'Bélgica',
  croatia: 'Croacia',
  serbia: 'Serbia',
  poland: 'Polonia',
  austria: 'Austria',
  ireland: 'Irlanda',
  scotland: 'Escocia',
  wales: 'Gales',
  ukraine: 'Ucrania',
  russia: 'Rusia',
  japan: 'Japón',
  china: 'China',
  australia: 'Australia',
  'south korea': 'Corea del Sur',
  'north korea': 'Corea del Norte',
  morocco: 'Marruecos',
  egypt: 'Egipto',
  algeria: 'Argelia',
  nigeria: 'Nigeria',
  senegal: 'Senegal',
  'south africa': 'Sudáfrica',
  switzerland: 'Suiza',
  sweden: 'Suecia',
  denmark: 'Dinamarca',
  norway: 'Noruega',
  turkey: 'Turquía',
  greece: 'Grecia',
  world: 'Internacional',
}

export function normalizeCountryName(country: string | null | undefined) {
  if (!country) return ''

  let normalized = country.replace(/\uFFFD/g, '').replace(/Â/g, '').trim()

  for (const [broken, fixed] of Object.entries(MOJIBAKE_FIXES)) {
    normalized = normalized.replaceAll(broken, fixed)
  }

  return normalized.replace(/\s+/g, ' ')
}

export function translateCountryNameToSpanish(country: string | null | undefined) {
  const normalized = normalizeCountryName(country)
  if (!normalized) return ''

  const key = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return COUNTRY_TRANSLATIONS[key] ?? COUNTRY_TRANSLATIONS[normalized.toLowerCase()] ?? normalized
}

export function hasCountryMojibake(value: string | null | undefined) {
  if (!value) return false

  return /Ã|Â|�/.test(value) || Object.keys(MOJIBAKE_FIXES).some((broken) => value.includes(broken))
}

export function hasCountryTranslation(country: string | null | undefined) {
  const normalized = normalizeCountryName(country)
  if (!normalized) return true

  const key = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return Boolean(COUNTRY_TRANSLATIONS[key] || COUNTRY_TRANSLATIONS[normalized.toLowerCase()])
}
