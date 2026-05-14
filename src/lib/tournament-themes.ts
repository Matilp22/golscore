export type TournamentTheme = {
  key: string
  name: string
  background: string
  accent: string
  secondaryAccent: string
  glow: string
  badgeClassName: string
  headerClassName: string
  tone: string
}

const defaultTheme: TournamentTheme = {
  key: 'default',
  name: 'Hay Fulbo',
  background:
    'radial-gradient(circle at 10% 0%, rgba(112,255,157,0.18), transparent 34%), linear-gradient(135deg, rgba(15,44,31,0.98), rgba(6,13,11,0.98))',
  accent: '#70ff9d',
  secondaryAccent: '#63c7ff',
  glow: '0 0 42px rgba(112,255,157,0.16)',
  badgeClassName: 'border-[#70ff9d]/30 bg-[#70ff9d]/10 text-[#70ff9d]',
  headerClassName: 'from-[#123a25] via-[#0b1713] to-[#050b09]',
  tone: 'stadium',
}

const themesByKey: Record<string, TournamentTheme> = {
  'selecciones-mundial': {
    key: 'selecciones-mundial',
    name: 'Mundial',
    background:
      'radial-gradient(circle at 12% 4%, rgba(246,202,88,0.24), transparent 30%), radial-gradient(circle at 88% 16%, rgba(99,199,255,0.18), transparent 30%), linear-gradient(135deg, #11172a, #06110d 58%, #050807)',
    accent: '#f6ca58',
    secondaryAccent: '#63c7ff',
    glow: '0 0 48px rgba(246,202,88,0.16)',
    badgeClassName: 'border-[#f6ca58]/35 bg-[#f6ca58]/12 text-[#ffe7a5]',
    headerClassName: 'from-[#222044] via-[#0b1714] to-[#090807]',
    tone: 'global',
  },
  'argentina-liga-profesional': {
    key: 'argentina-liga-profesional',
    name: 'Liga Profesional',
    background:
      'radial-gradient(circle at 8% 0%, rgba(112,255,157,0.2), transparent 32%), radial-gradient(circle at 88% 12%, rgba(116,214,255,0.11), transparent 28%), linear-gradient(135deg, #0d2a1b, #07110e 54%, #030706)',
    accent: '#70ff9d',
    secondaryAccent: '#74d6ff',
    glow: '0 0 42px rgba(112,255,157,0.18)',
    badgeClassName: 'border-[#70ff9d]/35 bg-[#70ff9d]/12 text-[#70ff9d]',
    headerClassName: 'from-[#123a25] via-[#081511] to-[#030706]',
    tone: 'argentina',
  },
  'argentina-copa-argentina': {
    key: 'argentina-copa-argentina',
    name: 'Copa Argentina',
    background:
      'radial-gradient(circle at 12% 0%, rgba(99,199,255,0.2), transparent 30%), radial-gradient(circle at 88% 18%, rgba(112,255,157,0.12), transparent 28%), linear-gradient(135deg, #071f2b, #07110d 58%, #050807)',
    accent: '#63c7ff',
    secondaryAccent: '#70ff9d',
    glow: '0 0 42px rgba(99,199,255,0.16)',
    badgeClassName: 'border-[#63c7ff]/35 bg-[#63c7ff]/12 text-[#b8eaff]',
    headerClassName: 'from-[#0c3143] via-[#071612] to-[#050807]',
    tone: 'national-cup',
  },
  'internacional-libertadores': {
    key: 'internacional-libertadores',
    name: 'Libertadores',
    background:
      'radial-gradient(circle at 8% 0%, rgba(246,202,88,0.22), transparent 30%), radial-gradient(circle at 86% 14%, rgba(255,95,98,0.12), transparent 26%), linear-gradient(135deg, #24170b, #08100e 58%, #050706)',
    accent: '#f6ca58',
    secondaryAccent: '#ff5f62',
    glow: '0 0 46px rgba(246,202,88,0.16)',
    badgeClassName: 'border-[#f6ca58]/35 bg-[#f6ca58]/12 text-[#ffe6a2]',
    headerClassName: 'from-[#39240d] via-[#0d1411] to-[#050706]',
    tone: 'continental-gold',
  },
  'internacional-sudamericana': {
    key: 'internacional-sudamericana',
    name: 'Sudamericana',
    background:
      'radial-gradient(circle at 8% 0%, rgba(99,199,255,0.18), transparent 30%), radial-gradient(circle at 86% 14%, rgba(112,255,157,0.16), transparent 26%), linear-gradient(135deg, #092337, #07140f 58%, #040807)',
    accent: '#63c7ff',
    secondaryAccent: '#70ff9d',
    glow: '0 0 46px rgba(99,199,255,0.14)',
    badgeClassName: 'border-[#63c7ff]/35 bg-[#63c7ff]/12 text-[#b8eaff]',
    headerClassName: 'from-[#0b344f] via-[#071713] to-[#040807]',
    tone: 'continental-blue',
  },
  'internacional-champions': {
    key: 'internacional-champions',
    name: 'Champions League',
    background:
      'radial-gradient(circle at 14% 0%, rgba(99,199,255,0.24), transparent 30%), radial-gradient(circle at 88% 18%, rgba(255,255,255,0.08), transparent 26%), linear-gradient(135deg, #071a3b, #070f18 58%, #040507)',
    accent: '#63c7ff',
    secondaryAccent: '#dbeafe',
    glow: '0 0 46px rgba(99,199,255,0.16)',
    badgeClassName: 'border-[#63c7ff]/35 bg-[#63c7ff]/12 text-[#cfefff]',
    headerClassName: 'from-[#0b2b63] via-[#070f1b] to-[#040507]',
    tone: 'europe-night',
  },
  'internacional-europa-league': {
    key: 'internacional-europa-league',
    name: 'Europa League',
    background:
      'radial-gradient(circle at 14% 0%, rgba(255,142,65,0.22), transparent 30%), radial-gradient(circle at 88% 18%, rgba(246,202,88,0.12), transparent 26%), linear-gradient(135deg, #2a1508, #0c100e 58%, #050706)',
    accent: '#ff9f43',
    secondaryAccent: '#f6ca58',
    glow: '0 0 46px rgba(255,159,67,0.14)',
    badgeClassName: 'border-[#ff9f43]/35 bg-[#ff9f43]/12 text-[#ffd0a1]',
    headerClassName: 'from-[#3a1b09] via-[#10110d] to-[#050706]',
    tone: 'europe-orange',
  },
}

export function getTournamentTheme(key?: string | null) {
  if (!key) return defaultTheme

  return themesByKey[key] ?? defaultTheme
}

export function getTournamentThemes() {
  return Object.values(themesByKey)
}
