import type { AppLocale } from '@/shared/i18n/locales'

type SpecialCountryCode = 'WORLD' | 'GB-ENG' | 'GB-SCT' | 'GB-WLS' | 'GB-NIR'
type CountryCode = string | SpecialCountryCode

const DEFAULT_COUNTRY_LOCALE: AppLocale = 'es'

const MOJIBAKE_FIXES: Record<string, string> = {
  'EspaÃƒÂ±a': 'España',
  'EspaÃ±a': 'España',
  'MÃƒÂ©xico': 'México',
  'MÃ©xico': 'México',
  'CanadÃƒÂ¡': 'Canadá',
  'CanadÃ¡': 'Canadá',
  'PaÃƒÂ­ses Bajos': 'Países Bajos',
  'PaÃ­ses Bajos': 'Países Bajos',
  'PerÃº': 'Perú',
  'BÃ©lgica': 'Bélgica',
  'JapÃ³n': 'Japón',
  'SudÃ¡frica': 'Sudáfrica',
  'TurquÃ­a': 'Turquía',
}

const COUNTRY_CODE_BY_NAME: Record<string, CountryCode> = {
  afghanistan: 'AF',
  afganistan: 'AF',
  albania: 'AL',
  algeria: 'DZ',
  argelia: 'DZ',
  andorra: 'AD',
  angola: 'AO',
  argentina: 'AR',
  armenia: 'AM',
  australia: 'AU',
  austria: 'AT',
  azerbaijan: 'AZ',
  bahrain: 'BH',
  belarus: 'BY',
  belgium: 'BE',
  belgica: 'BE',
  bolivia: 'BO',
  bosnia: 'BA',
  'bosnia and herzegovina': 'BA',
  brazil: 'BR',
  brasil: 'BR',
  bulgaria: 'BG',
  cameroon: 'CM',
  camerun: 'CM',
  canada: 'CA',
  canadaa: 'CA',
  chile: 'CL',
  china: 'CN',
  colombia: 'CO',
  'costa rica': 'CR',
  croatia: 'HR',
  croacia: 'HR',
  cuba: 'CU',
  cyprus: 'CY',
  czechia: 'CZ',
  'czech republic': 'CZ',
  denmark: 'DK',
  dinamarca: 'DK',
  ecuador: 'EC',
  egypt: 'EG',
  egipto: 'EG',
  england: 'GB-ENG',
  inglaterra: 'GB-ENG',
  estonia: 'EE',
  france: 'FR',
  francia: 'FR',
  georgia: 'GE',
  germany: 'DE',
  alemania: 'DE',
  ghana: 'GH',
  greece: 'GR',
  grecia: 'GR',
  guatemala: 'GT',
  honduras: 'HN',
  hungary: 'HU',
  hungria: 'HU',
  iceland: 'IS',
  india: 'IN',
  indonesia: 'ID',
  iran: 'IR',
  iraq: 'IQ',
  ireland: 'IE',
  irlanda: 'IE',
  israel: 'IL',
  italy: 'IT',
  italia: 'IT',
  'ivory coast': 'CI',
  'costa de marfil': 'CI',
  jamaica: 'JM',
  japan: 'JP',
  japon: 'JP',
  jordan: 'JO',
  kazakhstan: 'KZ',
  kyrgyzstan: 'KG',
  kosovo: 'XK',
  kuwait: 'KW',
  latvia: 'LV',
  lebanon: 'LB',
  libya: 'LY',
  liechtenstein: 'LI',
  lithuania: 'LT',
  luxembourg: 'LU',
  luxemburgo: 'LU',
  madagascar: 'MG',
  mali: 'ML',
  mauritania: 'MR',
  malta: 'MT',
  mexico: 'MX',
  mejico: 'MX',
  moldova: 'MD',
  monaco: 'MC',
  montenegro: 'ME',
  morocco: 'MA',
  marruecos: 'MA',
  mozambique: 'MZ',
  netherlands: 'NL',
  holland: 'NL',
  holanda: 'NL',
  'paises bajos': 'NL',
  'new zealand': 'NZ',
  'nueva zelanda': 'NZ',
  niger: 'NE',
  nigeria: 'NG',
  'north korea': 'KP',
  'corea del norte': 'KP',
  'northern ireland': 'GB-NIR',
  norway: 'NO',
  noruega: 'NO',
  oman: 'OM',
  pakistan: 'PK',
  palestine: 'PS',
  panama: 'PA',
  paraguay: 'PY',
  peru: 'PE',
  philippines: 'PH',
  poland: 'PL',
  polonia: 'PL',
  portugal: 'PT',
  qatar: 'QA',
  romania: 'RO',
  russia: 'RU',
  rusia: 'RU',
  saudi: 'SA',
  'saudi arabia': 'SA',
  scotland: 'GB-SCT',
  escocia: 'GB-SCT',
  senegal: 'SN',
  serbia: 'RS',
  singapore: 'SG',
  slovakia: 'SK',
  slovenia: 'SI',
  'south africa': 'ZA',
  sudafrica: 'ZA',
  'south korea': 'KR',
  'corea del sur': 'KR',
  spain: 'ES',
  espana: 'ES',
  sweden: 'SE',
  suecia: 'SE',
  switzerland: 'CH',
  suiza: 'CH',
  syria: 'SY',
  tajikistan: 'TJ',
  thailand: 'TH',
  tunisia: 'TN',
  tunez: 'TN',
  turkmenistan: 'TM',
  turkey: 'TR',
  turquia: 'TR',
  ukraine: 'UA',
  ucrania: 'UA',
  'united arab emirates': 'AE',
  'united states': 'US',
  usa: 'US',
  us: 'US',
  eeuu: 'US',
  'estados unidos': 'US',
  uruguay: 'UY',
  uzbekistan: 'UZ',
  venezuela: 'VE',
  vietnam: 'VN',
  wales: 'GB-WLS',
  gales: 'GB-WLS',
  yemen: 'YE',
  world: 'WORLD',
  international: 'WORLD',
  internacional: 'WORLD',
}

const SPECIAL_COUNTRY_NAMES: Record<SpecialCountryCode, Record<AppLocale, string>> = {
  WORLD: {
    es: 'Internacional',
    en: 'International',
    pt: 'Internacional',
    fr: 'International',
  },
  'GB-ENG': {
    es: 'Inglaterra',
    en: 'England',
    pt: 'Inglaterra',
    fr: 'Angleterre',
  },
  'GB-SCT': {
    es: 'Escocia',
    en: 'Scotland',
    pt: 'Escócia',
    fr: 'Écosse',
  },
  'GB-WLS': {
    es: 'Gales',
    en: 'Wales',
    pt: 'País de Gales',
    fr: 'Pays de Galles',
  },
  'GB-NIR': {
    es: 'Irlanda del Norte',
    en: 'Northern Ireland',
    pt: 'Irlanda do Norte',
    fr: 'Irlande du Nord',
  },
}

const FALLBACK_COUNTRY_NAMES_ES: Record<string, string> = {
  mexico: 'México',
  panama: 'Panamá',
  peru: 'Perú',
  belgium: 'Bélgica',
  japan: 'Japón',
  turkey: 'Turquía',
  czechia: 'Chequia',
  'dominican republic': 'República Dominicana',
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeCountryName(country: string | null | undefined) {
  if (!country) return ''

  let normalized = country.replace(/\uFFFD/g, '').replace(/Ã‚/g, '').trim()

  for (const [broken, fixed] of Object.entries(MOJIBAKE_FIXES)) {
    normalized = normalized.replaceAll(broken, fixed)
  }

  return normalized.replace(/\s+/g, ' ')
}

function isSpecialCountryCode(code: CountryCode): code is SpecialCountryCode {
  return code in SPECIAL_COUNTRY_NAMES
}

function getDisplayNameForCode(code: CountryCode, locale: AppLocale) {
  if (isSpecialCountryCode(code)) return SPECIAL_COUNTRY_NAMES[code][locale]

  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? null
  } catch {
    return null
  }
}

export function translateCountryName(
  country: string | null | undefined,
  locale: AppLocale = DEFAULT_COUNTRY_LOCALE
) {
  const normalized = normalizeCountryName(country)
  if (!normalized) return ''

  const key = normalizeKey(normalized)
  const code = COUNTRY_CODE_BY_NAME[key]
  const translated = code ? getDisplayNameForCode(code, locale) : null

  if (translated) return translated
  if (locale === 'es') return FALLBACK_COUNTRY_NAMES_ES[key] ?? normalized

  return normalized
}

export function translateCountryNameToSpanish(country: string | null | undefined) {
  return translateCountryName(country, 'es')
}

export function hasCountryMojibake(value: string | null | undefined) {
  if (!value) return false

  return /Ãƒ|Ã‚|Ã|�/.test(value) || Object.keys(MOJIBAKE_FIXES).some((broken) => value.includes(broken))
}

export function hasCountryTranslation(country: string | null | undefined) {
  const normalized = normalizeCountryName(country)
  if (!normalized) return true

  const key = normalizeKey(normalized)

  return Boolean(COUNTRY_CODE_BY_NAME[key] || FALLBACK_COUNTRY_NAMES_ES[key])
}
