export const SUPPORTED_LOCALES = ['es', 'en', 'pt', 'fr'] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'es'
export const LOCALE_COOKIE_NAME = 'hf_locale'

type MessageKey =
  | 'language.label'
  | 'language.es'
  | 'language.en'
  | 'language.pt'
  | 'language.fr'
  | 'shell.openMenu'
  | 'shell.closeMenu'
  | 'shell.closeOverlay'
  | 'shell.sections'
  | 'shell.homeLabel'
  | 'account.myAccount'
  | 'account.signingOut'
  | 'account.signOut'
  | 'account.notSignedIn'
  | 'account.signIn'
  | 'account.createAccount'
  | 'account.signOutError'
  | 'account.supabaseMissing'
  | 'nav.favorites'
  | 'nav.noFavorites'
  | 'nav.addFavorite'
  | 'nav.removeFavorite'
  | 'footer.description'
  | 'footer.legalLabel'
  | 'footer.privacy'
  | 'footer.terms'
  | 'footer.contact'
  | 'footer.rights'
  | 'home.tagline'
  | 'home.yesterday'
  | 'home.today'
  | 'home.tomorrow'
  | 'home.dataError'
  | 'home.noMatches'
  | 'home.matchSingular'
  | 'home.matchPlural'
  | 'match.tv'
  | 'status.finished'
  | 'status.halftime'
  | 'status.live'
  | 'status.postponed'
  | 'status.interrupted'
  | 'status.suspended'
  | 'status.cancelled'

const MESSAGES: Record<AppLocale, Record<MessageKey, string>> = {
  es: {
    'language.label': 'Idioma',
    'language.es': 'Español',
    'language.en': 'Inglés',
    'language.pt': 'Portugués',
    'language.fr': 'Francés',
    'shell.openMenu': 'Abrir menú',
    'shell.closeMenu': 'Cerrar menú',
    'shell.closeOverlay': 'Cerrar menú tocando fuera',
    'shell.sections': 'Secciones',
    'shell.homeLabel': 'HAY FULBO inicio',
    'account.myAccount': 'Mi cuenta',
    'account.signingOut': 'Cerrando...',
    'account.signOut': 'Cerrar sesión',
    'account.notSignedIn': 'No iniciaste sesión',
    'account.signIn': 'Iniciar sesión',
    'account.createAccount': 'Crear cuenta',
    'account.signOutError': 'No se pudo cerrar sesión.',
    'account.supabaseMissing': 'Supabase no está configurado.',
    'nav.favorites': 'Mis favoritos',
    'nav.noFavorites': 'Todavía no agregaste favoritos.',
    'nav.addFavorite': 'Agregar {name} a favoritos',
    'nav.removeFavorite': 'Quitar {name} de favoritos',
    'footer.description': 'Resultados, fixtures, estadísticas y prode de fútbol. Información deportiva independiente con foco en Argentina.',
    'footer.legalLabel': 'Enlaces legales',
    'footer.privacy': 'Política de Privacidad',
    'footer.terms': 'Términos y Condiciones',
    'footer.contact': 'Contacto',
    'footer.rights': 'Todos los derechos reservados.',
    'home.tagline': 'Partidos del día, marcadores en vivo y agenda fulbo total',
    'home.yesterday': 'Ayer',
    'home.today': 'Hoy',
    'home.tomorrow': 'Mañana',
    'home.dataError': 'Datos temporalmente no disponibles. Intentá nuevamente en unos minutos.',
    'home.noMatches': 'No hay partidos cargados para la fecha seleccionada.',
    'home.matchSingular': 'partido',
    'home.matchPlural': 'partidos',
    'match.tv': 'TV',
    'status.finished': 'Finalizado',
    'status.halftime': 'Entretiempo',
    'status.live': 'EN VIVO',
    'status.postponed': 'Postergado',
    'status.interrupted': 'Interrumpido',
    'status.suspended': 'Suspendido',
    'status.cancelled': 'Cancelado',
  },
  en: {
    'language.label': 'Language',
    'language.es': 'Spanish',
    'language.en': 'English',
    'language.pt': 'Portuguese',
    'language.fr': 'French',
    'shell.openMenu': 'Open menu',
    'shell.closeMenu': 'Close menu',
    'shell.closeOverlay': 'Close menu by tapping outside',
    'shell.sections': 'Sections',
    'shell.homeLabel': 'HAY FULBO home',
    'account.myAccount': 'My account',
    'account.signingOut': 'Signing out...',
    'account.signOut': 'Sign out',
    'account.notSignedIn': 'You are not signed in',
    'account.signIn': 'Sign in',
    'account.createAccount': 'Create account',
    'account.signOutError': 'Could not sign out.',
    'account.supabaseMissing': 'Supabase is not configured.',
    'nav.favorites': 'My favorites',
    'nav.noFavorites': 'You have not added favorites yet.',
    'nav.addFavorite': 'Add {name} to favorites',
    'nav.removeFavorite': 'Remove {name} from favorites',
    'footer.description': 'Football scores, fixtures, stats and prediction games. Independent sports information focused on Argentina.',
    'footer.legalLabel': 'Legal links',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms and Conditions',
    'footer.contact': 'Contact',
    'footer.rights': 'All rights reserved.',
    'home.tagline': 'Today’s matches, live scores and the full football agenda',
    'home.yesterday': 'Yesterday',
    'home.today': 'Today',
    'home.tomorrow': 'Tomorrow',
    'home.dataError': 'Data is temporarily unavailable. Try again in a few minutes.',
    'home.noMatches': 'No matches loaded for the selected date.',
    'home.matchSingular': 'match',
    'home.matchPlural': 'matches',
    'match.tv': 'TV',
    'status.finished': 'Finished',
    'status.halftime': 'Half-time',
    'status.live': 'LIVE',
    'status.postponed': 'Postponed',
    'status.interrupted': 'Interrupted',
    'status.suspended': 'Suspended',
    'status.cancelled': 'Cancelled',
  },
  pt: {
    'language.label': 'Idioma',
    'language.es': 'Espanhol',
    'language.en': 'Inglês',
    'language.pt': 'Português',
    'language.fr': 'Francês',
    'shell.openMenu': 'Abrir menu',
    'shell.closeMenu': 'Fechar menu',
    'shell.closeOverlay': 'Fechar menu tocando fora',
    'shell.sections': 'Seções',
    'shell.homeLabel': 'HAY FULBO início',
    'account.myAccount': 'Minha conta',
    'account.signingOut': 'Saindo...',
    'account.signOut': 'Sair',
    'account.notSignedIn': 'Você não iniciou sessão',
    'account.signIn': 'Entrar',
    'account.createAccount': 'Criar conta',
    'account.signOutError': 'Não foi possível sair.',
    'account.supabaseMissing': 'Supabase não está configurado.',
    'nav.favorites': 'Meus favoritos',
    'nav.noFavorites': 'Você ainda não adicionou favoritos.',
    'nav.addFavorite': 'Adicionar {name} aos favoritos',
    'nav.removeFavorite': 'Remover {name} dos favoritos',
    'footer.description': 'Resultados, jogos, estatísticas e bolão de futebol. Informação esportiva independente com foco na Argentina.',
    'footer.legalLabel': 'Links legais',
    'footer.privacy': 'Política de Privacidade',
    'footer.terms': 'Termos e Condições',
    'footer.contact': 'Contato',
    'footer.rights': 'Todos os direitos reservados.',
    'home.tagline': 'Jogos do dia, placares ao vivo e agenda completa do futebol',
    'home.yesterday': 'Ontem',
    'home.today': 'Hoje',
    'home.tomorrow': 'Amanhã',
    'home.dataError': 'Dados temporariamente indisponíveis. Tente novamente em alguns minutos.',
    'home.noMatches': 'Não há jogos carregados para a data selecionada.',
    'home.matchSingular': 'jogo',
    'home.matchPlural': 'jogos',
    'match.tv': 'TV',
    'status.finished': 'Finalizado',
    'status.halftime': 'Intervalo',
    'status.live': 'AO VIVO',
    'status.postponed': 'Adiado',
    'status.interrupted': 'Interrompido',
    'status.suspended': 'Suspenso',
    'status.cancelled': 'Cancelado',
  },
  fr: {
    'language.label': 'Langue',
    'language.es': 'Espagnol',
    'language.en': 'Anglais',
    'language.pt': 'Portugais',
    'language.fr': 'Français',
    'shell.openMenu': 'Ouvrir le menu',
    'shell.closeMenu': 'Fermer le menu',
    'shell.closeOverlay': 'Fermer le menu en touchant dehors',
    'shell.sections': 'Sections',
    'shell.homeLabel': 'Accueil HAY FULBO',
    'account.myAccount': 'Mon compte',
    'account.signingOut': 'Déconnexion...',
    'account.signOut': 'Se déconnecter',
    'account.notSignedIn': 'Vous n’êtes pas connecté',
    'account.signIn': 'Se connecter',
    'account.createAccount': 'Créer un compte',
    'account.signOutError': 'Impossible de se déconnecter.',
    'account.supabaseMissing': 'Supabase n’est pas configuré.',
    'nav.favorites': 'Mes favoris',
    'nav.noFavorites': 'Vous n’avez pas encore ajouté de favoris.',
    'nav.addFavorite': 'Ajouter {name} aux favoris',
    'nav.removeFavorite': 'Retirer {name} des favoris',
    'footer.description': 'Résultats, calendriers, statistiques et pronostics de football. Information sportive indépendante centrée sur l’Argentine.',
    'footer.legalLabel': 'Liens légaux',
    'footer.privacy': 'Politique de confidentialité',
    'footer.terms': 'Conditions générales',
    'footer.contact': 'Contact',
    'footer.rights': 'Tous droits réservés.',
    'home.tagline': 'Matchs du jour, scores en direct et calendrier complet du football',
    'home.yesterday': 'Hier',
    'home.today': 'Aujourd’hui',
    'home.tomorrow': 'Demain',
    'home.dataError': 'Les données sont temporairement indisponibles. Réessayez dans quelques minutes.',
    'home.noMatches': 'Aucun match chargé pour la date sélectionnée.',
    'home.matchSingular': 'match',
    'home.matchPlural': 'matchs',
    'match.tv': 'TV',
    'status.finished': 'Terminé',
    'status.halftime': 'Mi-temps',
    'status.live': 'EN DIRECT',
    'status.postponed': 'Reporté',
    'status.interrupted': 'Interrompu',
    'status.suspended': 'Suspendu',
    'status.cancelled': 'Annulé',
  },
}

const COUNTRY_LOCALE: Record<string, AppLocale> = {
  US: 'en',
  GB: 'en',
  IE: 'en',
  AU: 'en',
  NZ: 'en',
  CA: 'en',
  BR: 'pt',
  PT: 'pt',
  AO: 'pt',
  MZ: 'pt',
  FR: 'fr',
  BE: 'fr',
  CH: 'fr',
  LU: 'fr',
  MC: 'fr',
}

const SECTION_LABELS: Record<string, Partial<Record<AppLocale, string>>> = {
  internacional: { en: 'International', pt: 'Internacional', fr: 'International' },
  inglaterra: { en: 'England', pt: 'Inglaterra', fr: 'Angleterre' },
  espana: { es: 'España', en: 'Spain', pt: 'Espanha', fr: 'Espagne' },
  alemania: { en: 'Germany', pt: 'Alemanha', fr: 'Allemagne' },
  francia: { en: 'France', pt: 'França', fr: 'France' },
  brasil: { en: 'Brazil', pt: 'Brasil', fr: 'Brésil' },
  mexico: { es: 'México', en: 'Mexico', pt: 'México', fr: 'Mexique' },
  eeuu: { es: 'Estados Unidos', en: 'United States', pt: 'Estados Unidos', fr: 'États-Unis' },
  selecciones: { en: 'National Teams', pt: 'Seleções', fr: 'Sélections' },
}

const TOURNAMENT_LABELS: Record<string, Partial<Record<AppLocale, string>>> = {
  'selecciones-mundial': {
    es: 'Copa del Mundo 2026',
    en: 'World Cup 2026',
    pt: 'Copa do Mundo 2026',
    fr: 'Coupe du monde 2026',
  },
  'selecciones-amistosos-internacionales': {
    es: 'Amistosos internacionales',
    en: 'International friendlies',
    pt: 'Amistosos internacionais',
    fr: 'Matchs amicaux internationaux',
  },
  'selecciones-copa-america': {
    es: 'Copa América',
    en: 'Copa America',
    pt: 'Copa América',
    fr: 'Copa América',
  },
  'selecciones-eurocopa': { en: 'UEFA Euro', pt: 'Eurocopa', fr: 'Euro' },
  'selecciones-eliminatorias-conmebol': {
    en: 'CONMEBOL World Cup Qualifiers',
    pt: 'Eliminatórias CONMEBOL',
    fr: 'Qualifications CONMEBOL',
  },
  'selecciones-eliminatorias-uefa': {
    en: 'UEFA World Cup Qualifiers',
    pt: 'Eliminatórias UEFA',
    fr: 'Qualifications UEFA',
  },
  'selecciones-eliminatorias-concacaf': {
    en: 'CONCACAF World Cup Qualifiers',
    pt: 'Eliminatórias CONCACAF',
    fr: 'Qualifications CONCACAF',
  },
  'francia-copa-francia': { en: 'French Cup', pt: 'Copa da França', fr: 'Coupe de France' },
  'portugal-taca-de-portugal': {
    es: 'Taça de Portugal',
    en: 'Portuguese Cup',
    pt: 'Taça de Portugal',
    fr: 'Coupe du Portugal',
  },
  'brasil-brasileirao': {
    es: 'Brasileirão',
    en: 'Brasileirão',
    pt: 'Brasileirão',
    fr: 'Brasileirão',
  },
}

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null

  const normalized = value.trim().toLowerCase().split('-')[0]

  return isSupportedLocale(normalized) ? normalized : null
}

export function localeFromCountry(country: string | null | undefined): AppLocale | null {
  if (!country) return null

  return COUNTRY_LOCALE[country.trim().toUpperCase()] ?? null
}

export function localeFromAcceptLanguage(value: string | null | undefined): AppLocale | null {
  if (!value) return null

  const candidates = value
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter(Boolean)

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate)
    if (locale) return locale
  }

  return null
}

export function resolveAppLocale(input: {
  cookieLocale?: string | null
  country?: string | null
  acceptLanguage?: string | null
}) {
  return (
    normalizeLocale(input.cookieLocale) ??
    localeFromCountry(input.country) ??
    localeFromAcceptLanguage(input.acceptLanguage) ??
    DEFAULT_LOCALE
  )
}

export function t(locale: AppLocale, key: MessageKey, values: Record<string, string> = {}) {
  let message = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key]

  for (const [name, value] of Object.entries(values)) {
    message = message.replaceAll(`{${name}}`, value)
  }

  return message
}

export function getSectionDisplayName(key: string, fallback: string, locale: AppLocale) {
  return SECTION_LABELS[key]?.[locale] ?? fallback
}

export function getTournamentDisplayName(key: string, fallback: string, locale: AppLocale) {
  return TOURNAMENT_LABELS[key]?.[locale] ?? fallback
}
