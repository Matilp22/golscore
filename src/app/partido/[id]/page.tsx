import {
  ApiFootballError,
  getMatchDetail,
  type MatchEvent,
  type MatchFixture,
  type MatchLineup,
  type MatchStatistic,
  type MatchStatisticsTeam,
  type PlayerWrapper,
} from '@/lib/api-football'
import AutoRefresh from '@/frontend/components/AutoRefresh'
import FormationTeamPanel from '@/frontend/components/FormationTeamPanel'
import Image from 'next/image'
import Link from 'next/link'

type PageProps = {
  params: Promise<{ id: string }>
}

function translateStatus(statusLong: string) {
  const map: Record<string, string> = {
    'Match Finished': 'Finalizado',
    Finished: 'Finalizado',
    'Not Started': 'No iniciado',
    'Time to be defined': 'Horario a confirmar',
    'First Half': 'Primer tiempo',
    'Second Half': 'Segundo tiempo',
    Halftime: 'Entretiempo',
    'Extra Time': 'Tiempo extra',
    'Penalty In Progress': 'Penales en juego',
    'Match Cancelled': 'Cancelado',
    'Match Postponed': 'Postergado',
    'Match Suspended': 'Suspendido',
    Interrupted: 'Interrumpido',
    'Break Time': 'Pausa',
    Live: 'En vivo',
  }

  return map[statusLong] || statusLong
}

function formatStatusLabel(statusLong: string, elapsed?: number | null) {
  if (elapsed) return `${elapsed}'`
  return translateStatus(statusLong)
}

function translateCountry(country: string) {
  const map: Record<string, string> = {
    Argentina: 'Argentina',
    Spain: 'España',
    Italy: 'Italia',
    Germany: 'Alemania',
    England: 'Inglaterra',
    Portugal: 'Portugal',
    France: 'Francia',
    Netherlands: 'Países Bajos',
    Holland: 'Países Bajos',
    Brazil: 'Brasil',
    Serbia: 'Serbia',
    World: 'Mundo',
    Europe: 'Europa',
    USA: 'Estados Unidos',
    'United States': 'Estados Unidos',
  }

  return map[country] || country
}

function translateLeagueName(name: string) {
  const lower = name.toLowerCase()

  if (lower.includes('international friendlies')) return 'Amistoso'
  if (lower.includes('friendly international')) return 'Amistoso'
  if (lower.includes('friendlies')) return 'Amistoso'

  const map: Record<string, string> = {
    'World Cup': 'Mundial',
    'Copa America': 'Copa América',
    'UEFA Euro': 'Eurocopa',
    'UEFA Nations League': 'Liga de Naciones UEFA',
    'World Cup - Qualification Europe': 'Eliminatorias UEFA',
    'UEFA Europa League': 'Europa League',
    'UEFA Europa Conference League': 'Conference League',
  }

  return map[name] || name
}

function translateStatType(type: string) {
  const map: Record<string, string> = {
    'Shots on Goal': 'Remates al arco',
    'Shots off Goal': 'Remates afuera',
    'Total Shots': 'Remates totales',
    'Blocked Shots': 'Remates bloqueados',
    'Shots insidebox': 'Remates dentro del área',
    'Shots outsidebox': 'Remates fuera del área',
    Fouls: 'Faltas',
    'Corner Kicks': 'Tiros de esquina',
    Offsides: 'Offsides',
    'Ball Possession': 'Posesión',
    'Yellow Cards': 'Tarjetas amarillas',
    'Red Cards': 'Tarjetas rojas',
    'Goalkeeper Saves': 'Atajadas',
    'Total passes': 'Pases totales',
    'Passes accurate': 'Pases correctos',
    'Passes %': 'Precisión de pase',
    expected_goals: 'Goles esperados',
  }

  return map[type] || type
}

function parseStatNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return value
  if (!value) return 0

  const cleaned = String(value).replace('%', '').replace(',', '.').trim()
  const parsed = Number(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function formatStatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function formatVenueLocation(city?: string | null) {
  if (!city) return 'Ubicación no disponible'

  const parts = city
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return 'Ubicación no disponible'
  if (parts.length === 1) return parts[0]

  return `${parts[0]} (${parts.slice(1).join(', ')})`
}

function formatReferee(referee?: string | null) {
  if (!referee) return 'No disponible'

  const parts = referee
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 2) return referee

  const [name, ...nationalityParts] = parts
  return `${name} (${nationalityParts.join(', ')})`
}

function isHomeEvent(event: MatchEvent, homeTeamName: string) {
  return event.team?.name === homeTeamName
}

function isAwayEvent(event: MatchEvent, awayTeamName: string) {
  return event.team?.name === awayTeamName
}

type EventKind =
  | 'goal'
  | 'penalty-goal'
  | 'penalty-missed'
  | 'yellow-card'
  | 'red-card'
  | 'substitution'
  | 'var'
  | 'event'

function normalizeEventText(value?: string | null) {
  return (value || '').toLowerCase()
}

function getEventKind(event: MatchEvent): EventKind {
  const type = normalizeEventText(event.type)
  const detail = normalizeEventText(event.detail)
  const comments = normalizeEventText(event.comments)

  if (type.includes('var') || detail.includes('var') || comments.includes('var')) {
    return 'var'
  }

  if (detail.includes('missed penalty') || detail.includes('penalty missed')) {
    return 'penalty-missed'
  }

  if (type.includes('goal') && detail.includes('penalty')) {
    return 'penalty-goal'
  }

  if (type.includes('goal')) {
    return 'goal'
  }

  if (detail.includes('yellow')) {
    return 'yellow-card'
  }

  if (detail.includes('red')) {
    return 'red-card'
  }

  if (type.includes('subst')) {
    return 'substitution'
  }

  return 'event'
}

function translateEventDetail(event: MatchEvent) {
  const detail = event.detail || ''
  const type = event.type || ''
  const comments = event.comments || ''
  const normalizedDetail = normalizeEventText(detail)
  const normalizedType = normalizeEventText(type)
  const normalizedComments = normalizeEventText(comments)

  if (normalizedDetail.includes('yellow')) return 'Tarjeta amarilla'
  if (normalizedDetail.includes('red')) return 'Tarjeta roja'
  if (normalizedDetail.includes('second yellow')) return 'Segunda amarilla'
  if (normalizedDetail.includes('normal goal')) return 'Gol'
  if (normalizedDetail.includes('own goal')) return 'Gol en contra'
  if (normalizedDetail.includes('penalty')) return 'Penal'
  if (normalizedDetail.includes('missed penalty') || normalizedDetail.includes('penalty missed')) {
    return 'Penal errado'
  }
  if (normalizedType.includes('subst')) return 'Sustitución'
  if (normalizedType.includes('var') || normalizedComments.includes('var')) {
    return detail || comments || 'Revisión VAR'
  }

  const map: Record<string, string> = {
    Foul: 'Falta',
    Injury: 'Lesión',
    Offside: 'Offside',
    Handball: 'Mano',
    'Penalty Shootout': 'Penales',
  }

  return map[type] || detail || comments || type || 'Evento'
}

function getEventPrimary(event: MatchEvent) {
  const kind = getEventKind(event)

  if (kind === 'var') return 'VAR'
  if (kind === 'substitution') {
    return event.assist?.name || event.player?.name || 'Sustitución'
  }

  return event.player?.name || event.type || 'Evento'
}

function getEventSecondary(event: MatchEvent) {
  const kind = getEventKind(event)

  if (kind === 'goal' || kind === 'penalty-goal') {
    return event.assist?.name
      ? `Asistencia: ${event.assist.name}`
      : translateEventDetail(event)
  }

  if (kind === 'substitution') {
    return event.player?.name
      ? `por ${event.player.name}`
      : translateEventDetail(event)
  }

  return translateEventDetail(event)
}

function getEventTypeStyle(event: MatchEvent) {
  const kind = getEventKind(event)

  if (kind === 'goal') {
    return {
      kind,
      accent: 'text-[#7ff0b2]',
      badge: 'border-[#25553d] bg-[#163828] text-[#7ff0b2]',
    }
  }

  if (kind === 'penalty-goal') {
    return {
      kind,
      accent: 'text-[#7ff0b2]',
      badge: 'border-[#25553d] bg-[#163828] text-[#7ff0b2]',
    }
  }

  if (kind === 'penalty-missed') {
    return {
      kind,
      accent: 'text-[#ffb3b3]',
      badge: 'border-[#5a2a2a] bg-[#3b1919] text-[#ffb3b3]',
    }
  }

  if (kind === 'yellow-card') {
    return {
      kind,
      accent: 'text-[#f3d36c]',
      badge: 'border-[#574b20] bg-[#3f3616] text-[#f3d36c]',
    }
  }

  if (kind === 'red-card') {
    return {
      kind,
      accent: 'text-[#ff8f8f]',
      badge: 'border-[#5a2a2a] bg-[#3b1919] text-[#ff8f8f]',
    }
  }

  if (kind === 'substitution') {
    return {
      kind,
      accent: 'text-sky-300',
      badge: 'border-sky-900/80 bg-sky-950/40 text-sky-300',
    }
  }

  if (kind === 'var') {
    return {
      kind,
      accent: 'text-violet-300',
      badge: 'border-violet-900/80 bg-violet-950/40 text-violet-300',
    }
  }

  return {
    kind,
    accent: 'text-[#a8b0bc]',
    badge: 'border-[#2a3038] bg-[#1c2128] text-[#a8b0bc]',
  }
}

function EventIcon({
  kind,
  size = 'md',
}: {
  kind: EventKind
  size?: 'md' | 'lg'
}) {
  const ballClass = size === 'lg' ? 'h-[24px] w-[24px]' : 'h-[16px] w-[16px]'
  const ballIcon = (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`${ballClass} overflow-visible`}>
      <circle cx="16" cy="16" r="13.5" fill="#f8fafc" stroke="#0f1317" strokeWidth="1.8" />
      <path d="M16 8.2 21 11.8 19.1 17.6h-6.2L11 11.8 16 8.2Z" fill="#0f1317" />
      <path
        d="m7.8 12.2 3.2-.4M21 11.8l3.2.4M12.9 17.6l-2.7 3.8M19.1 17.6l2.7 3.8M12.2 26.5l-2-5.1M19.8 26.5l2-5.1"
        fill="none"
        stroke="#0f1317"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  )

  if (kind === 'yellow-card') {
    return <span className="inline-block h-4 w-3 rounded-[1px] bg-[#f3d36c]" />
  }

  if (kind === 'red-card') {
    return <span className="inline-block h-4 w-3 rounded-[1px] bg-[#ef4444]" />
  }

  if (kind === 'goal') {
    return ballIcon
  }

  if (kind === 'penalty-goal') {
    return (
      <span className="relative inline-flex h-4 w-5 items-center justify-center text-white">
        <span className="absolute inset-x-0 top-[1px] h-2.5 rounded-t-[2px] border-x border-t border-current" />
        <span className="relative scale-[0.62]">{ballIcon}</span>
      </span>
    )
  }

  if (kind === 'penalty-missed') {
    return (
      <span className="relative inline-flex h-4 w-5 items-center justify-center text-white">
        <span className="absolute inset-x-0 top-[1px] h-2.5 rounded-t-[2px] border-x border-t border-current" />
        <span className="relative scale-[0.62]">{ballIcon}</span>
        <span className="absolute h-[1.5px] w-6 rotate-45 bg-[#ff5f5f]" />
        <span className="absolute h-[1.5px] w-6 -rotate-45 bg-[#ff5f5f]" />
      </span>
    )
  }

  if (kind === 'var') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="relative inline-block h-3.5 w-5 rounded-[2px] border border-current">
          <span className="absolute left-1/2 top-full h-1 w-[1px] -translate-x-1/2 bg-current" />
        </span>
      </span>
    )
  }

  if (kind === 'substitution') {
    return (
      <span className="inline-flex items-center gap-[2px] text-xs font-black leading-none">
        <span className="text-[#7ff0b2]">&uarr;</span>
        <span className="text-[#ff8f8f]">&darr;</span>
      </span>
    )
  }

  return <span className="text-xs font-black leading-none">EVT</span>
}

type TeamStyle = {
  shirt: string
  secondary?: string
  text: string
  border: string
}

function normalizeHexColor(value?: string) {
  if (!value) return undefined

  const cleaned = value.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return undefined

  return `#${cleaned}`
}

function isLightColor(value: string) {
  const cleaned = value.replace('#', '')
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

  return luminance > 0.78
}

function ensureReadableTeamStyle(style: TeamStyle) {
  if (!isLightColor(style.shirt)) return style

  const fallbackText =
    (style.secondary && !isLightColor(style.secondary) ? style.secondary : undefined) ||
    (style.border && !isLightColor(style.border) ? style.border : undefined) ||
    '#111111'

  return {
    ...style,
    text: fallbackText,
  }
}

function getTeamStyle(
  teamName: string,
  isHome: boolean,
  lineup?: MatchLineup | null,
  role: 'player' | 'goalkeeper' = 'player'
): TeamStyle {
  const lineupColors = lineup?.team?.colors?.[role]

  const primary = normalizeHexColor(lineupColors?.primary)
  const text = normalizeHexColor(lineupColors?.number)
  const border = normalizeHexColor(lineupColors?.border)

  if (primary || text || border) {
    return ensureReadableTeamStyle({
      shirt: text || primary || (isHome ? '#dc2626' : '#2563eb'),
      secondary: undefined,
      text: primary || '#ffffff',
      border: border || '#ffffff',
    })
  }

  const map: Record<string, TeamStyle> = {
    Independiente: { shirt: '#d90429', text: '#ffffff', border: '#ffffff' },
    'Atenas Río Cuarto': { shirt: '#2563eb', text: '#ffffff', border: '#ffffff' },
    'Atenas Rio Cuarto': { shirt: '#2563eb', text: '#ffffff', border: '#ffffff' },
    River: { shirt: '#ffffff', secondary: '#e5e7eb', text: '#111111', border: '#dc2626' },
    Boca: { shirt: '#1d4ed8', secondary: '#facc15', text: '#facc15', border: '#facc15' },
    Racing: { shirt: '#60a5fa', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'Racing Club': { shirt: '#60a5fa', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    Estudiantes: { shirt: '#ef4444', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    Talleres: { shirt: '#123c69', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'San Lorenzo': { shirt: '#1d4ed8', secondary: '#ef4444', text: '#ffffff', border: '#ef4444' },
    'Vélez Sarsfield': { shirt: '#ffffff', secondary: '#1d4ed8', text: '#111111', border: '#1d4ed8' },
    Velez: { shirt: '#ffffff', secondary: '#1d4ed8', text: '#111111', border: '#1d4ed8' },
    Lanus: { shirt: '#7f1d1d', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'Rosario Central': { shirt: '#1d4ed8', secondary: '#facc15', text: '#facc15', border: '#facc15' },
    "Newell's Old Boys": { shirt: '#111111', secondary: '#ef4444', text: '#ffffff', border: '#ef4444' },
    'Godoy Cruz': { shirt: '#1d4ed8', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'Argentinos Juniors': { shirt: '#ef4444', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'Defensa y Justicia': { shirt: '#16a34a', secondary: '#facc15', text: '#ffffff', border: '#facc15' },
    Tigre: { shirt: '#1d4ed8', secondary: '#ef4444', text: '#ffffff', border: '#ef4444' },
    Platense: { shirt: '#ffffff', secondary: '#7f1d1d', text: '#111111', border: '#7f1d1d' },
    Gimnasia: { shirt: '#1f2937', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    Huracan: { shirt: '#ffffff', secondary: '#dc2626', text: '#dc2626', border: '#dc2626' },
    'Barracas Central': { shirt: '#ef4444', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    Botafogo: { shirt: '#111111', secondary: '#ffffff', text: '#ffffff', border: '#d1d5db' },
    Olimpia: { shirt: '#111111', secondary: '#ffffff', text: '#ffffff', border: '#d1d5db' },
    Spain: { shirt: '#ef4444', text: '#ffffff', border: '#facc15' },
    Serbia: { shirt: '#1d4ed8', text: '#ffffff', border: '#ef4444' },
  }

  return ensureReadableTeamStyle(
    map[teamName] || {
      shirt: isHome ? '#14532d' : '#f3f4f6',
      secondary: isHome ? '#2563eb' : '#9ca3af',
      text: isHome ? '#ffffff' : '#111827',
      border: isHome ? '#93c5fd' : '#9ca3af',
    }
  )
}

function parseGrid(grid?: string) {
  if (!grid || !grid.includes(':')) return { row: 1, col: 1 }
  const [row, col] = grid.split(':').map(Number)
  return {
    row: Number.isFinite(row) ? row : 1,
    col: Number.isFinite(col) ? col : 1,
  }
}

function totalRowsFromFormation(formation?: string) {
  if (!formation) return 5
  const lines = formation.split('-').map(Number).filter(Boolean)
  return lines.length + 1
}

const FALLBACK_FIELD_COORDINATES = [
  { x: 50, row: 1 },
  { x: 18, row: 2 },
  { x: 38, row: 2 },
  { x: 62, row: 2 },
  { x: 82, row: 2 },
  { x: 20, row: 3 },
  { x: 40, row: 3 },
  { x: 60, row: 3 },
  { x: 80, row: 3 },
  { x: 34, row: 4 },
  { x: 66, row: 4 },
] as const

function normalizeLineByPosition(pos?: string) {
  const normalized = (pos || '').trim().toUpperCase()

  if (normalized === 'G') return 'G'
  if (normalized === 'D') return 'D'
  if (normalized === 'M') return 'M'
  if (normalized === 'F' || normalized === 'A' || normalized === 'S') return 'F'

  return ''
}

function getInferredFormationPosition(
  players: PlayerWrapper[] | undefined,
  playerWrap: PlayerWrapper
) {
  const starters = players || []
  if (!starters.length) return null

  const grouped = new Map<string, PlayerWrapper[]>()

  for (const starter of starters) {
    const line = normalizeLineByPosition(starter.player?.pos)
    if (!line) continue
    const current = grouped.get(line) || []
    current.push(starter)
    grouped.set(line, current)
  }

  const orderedLines = ['G', 'D', 'M', 'F'].filter((line) => (grouped.get(line) || []).length)
  if (!orderedLines.length) return null

  const playerLine = normalizeLineByPosition(playerWrap.player?.pos)
  if (!playerLine || !grouped.get(playerLine)?.length) return null

  const row = orderedLines.indexOf(playerLine) + 1
  const sameRowPlayers = grouped.get(playerLine) || []
  const col = Math.max(
    1,
    sameRowPlayers.findIndex((candidate) => candidate.player?.id === playerWrap.player?.id) + 1
  )

  return {
    row,
    col,
    sameRowPlayers: sameRowPlayers.length,
    totalRows: orderedLines.length,
  }
}

function getPlayerPosition(
  playerWrap: PlayerWrapper,
  formation?: string,
  side: 'top' | 'bottom' = 'top',
  fallbackIndex = 0,
  lineupPlayers?: PlayerWrapper[],
  fullField = false
) {
  const rawGrid = playerWrap.player?.grid
  const hasGrid = Boolean(rawGrid && rawGrid.includes(':'))
  const { row, col } = parseGrid(rawGrid)
  const inferredPosition =
    !formation && !hasGrid
      ? getInferredFormationPosition(lineupPlayers, playerWrap)
      : null
  const totalRows = inferredPosition?.totalRows || totalRowsFromFormation(formation)

  if (!formation && !hasGrid && !inferredPosition) {
    const fallback =
      FALLBACK_FIELD_COORDINATES[
        Math.min(Math.max(fallbackIndex, 0), FALLBACK_FIELD_COORDINATES.length - 1)
      ] || FALLBACK_FIELD_COORDINATES[0]

    const fallbackRows = 4
    const normalizedRow = (fallback.row - 1) / Math.max(fallbackRows - 1, 1)
    if (fullField) {
      const start = side === 'top' ? 13 : 87
      const end = side === 'top' ? 87 : 13
      return { x: fallback.x, y: start + normalizedRow * (end - start) }
    }

    const topStart = 10
    const bottomStart = 90
    const halfHeight = 34
    const y = side === 'top' ? topStart + normalizedRow * halfHeight : bottomStart - normalizedRow * halfHeight

    return { x: fallback.x, y }
  }

  const safeRow = Math.min(Math.max(inferredPosition?.row || row, 1), totalRows)

  const sameRowPlayers =
    safeRow <= 1
      ? 1
      : inferredPosition?.sameRowPlayers || Number(formation?.split('-')?.[safeRow - 2] || 1)

  const resolvedCol = inferredPosition?.col || col
  const horizontalPadding = fullField
    ? sameRowPlayers >= 5
      ? 14
      : sameRowPlayers === 4
      ? 15
      : sameRowPlayers === 3
      ? 22
      : 28
    : sameRowPlayers >= 5
    ? 13
    : sameRowPlayers === 4
    ? 15
    : sameRowPlayers === 3
    ? 18
    : 22
  const horizontalSpan = 100 - horizontalPadding * 2

  const x =
    sameRowPlayers <= 1
      ? 50
      : horizontalPadding + ((resolvedCol - 1) / Math.max(sameRowPlayers - 1, 1)) * horizontalSpan

  const normalizedRow = (safeRow - 1) / Math.max(totalRows - 1, 1)
  if (fullField) {
    const start = side === 'top' ? 13 : 87
    const end = side === 'top' ? 87 : 13
    return { x, y: start + normalizedRow * (end - start) }
  }

  const topStart = 12
  const bottomStart = 88
  const halfHeight =
    totalRows >= 5
      ? 34
      : totalRows === 4
      ? 32
      : 30
  const y = side === 'top' ? topStart + normalizedRow * halfHeight : bottomStart - normalizedRow * halfHeight

  return { x, y }
}

function TeamLogo({
  logo,
  name,
  size = 'md',
}: {
  logo?: string
  name: string
  size?: 'sm' | 'md'
}) {
  const classes = size === 'sm' ? 'h-8 w-8' : 'h-16 w-16'

  return (
    <div className={`flex ${classes} items-center justify-center overflow-hidden`}>
      {logo ? (
        <Image
          src={logo}
          alt={name}
          width={size === 'sm' ? 32 : 64}
          height={size === 'sm' ? 32 : 64}
          className={`${classes} object-contain`}
        />
      ) : (
        <span className="text-xs text-[#6f7a87]">â€¢</span>
      )}
    </div>
  )
}

function TeamPanelLink({
  id,
}: {
  id?: number
}) {
  if (!id) return null

  return (
    <Link
      href={`/equipo/${id}`}
      className="mt-2 inline-flex rounded-lg border border-white/8 bg-[#161a20] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#c8d0da] transition hover:bg-[#1c2128]"
    >
      Ver equipo
    </Link>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/6 py-3 last:border-b-0">
      <span className="text-sm text-[#8d98a7]">{label}</span>
      <span className="text-right text-sm font-semibold text-[#f3f6fa]">{value}</span>
    </div>
  )
}

function getPanelStyle(style: TeamStyle) {
  const secondary = style.secondary || style.shirt

  return {
    backgroundImage: `linear-gradient(135deg, ${style.shirt}3d 0%, ${secondary}33 52%, rgba(15, 19, 23, 0.94) 100%)`,
    borderColor: `${style.border}66`,
    boxShadow: `inset 0 1px 0 ${style.border}1a`,
  }
}

function Shirt({
  number,
  style,
}: {
  number?: number | string
  style: TeamStyle
}) {
  return (
    <div
      className="flex h-10 w-8 items-center justify-center text-sm font-black sm:h-16 sm:w-14 sm:text-xl"
      style={{
        backgroundColor: style.shirt,
        color: style.text,
        clipPath:
          'polygon(18% 0%, 36% 0%, 40% 12%, 60% 12%, 64% 0%, 82% 0%, 100% 18%, 86% 28%, 86% 100%, 14% 100%, 14% 28%, 0% 18%)',
      }}
    >
      {number || ''}
    </div>
  )
}

function getStyleForPlayer(
  playerWrap: PlayerWrapper,
  teamName: string,
  isHome: boolean,
  lineup?: MatchLineup | null
) {
  const role = playerWrap.player?.pos === 'G' ? 'goalkeeper' : 'player'
  return getTeamStyle(teamName, isHome, lineup, role)
}

function isCaptainFlag(value: boolean | string | undefined) {
  if (value === true) return true
  if (typeof value !== 'string') return false

  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === 'yes' || normalized === '1'
}

function getCaptainReference(lineup?: MatchLineup | null) {
  const starters = lineup?.startXI || []
  const explicitCaptain = starters.find(
    (playerWrap) =>
      isCaptainFlag(playerWrap.captain) ||
      isCaptainFlag(playerWrap.player?.captain)
  )

  if (explicitCaptain?.player) {
    return {
      id: explicitCaptain.player.id,
      name: explicitCaptain.player.name,
    }
  }

  return undefined
}

type PlayerFieldState = {
  displayName: string
  displayNumber?: number
  substitutionMinute?: number | null
  substitutionReplacementName?: string | null
  goals: number
  goalMinutes: Array<number | null>
  yellowCards: number
  yellowCardMinutes: Array<number | null>
  redCards: number
  redCardMinutes: Array<number | null>
}

function matchesPlayerEvent(
  candidate: { id?: number; name?: string } | undefined,
  playerId?: number,
  playerName?: string
) {
  if (!candidate) return false
  if (playerId && candidate.id && candidate.id === playerId) return true

  const normalizedCandidate = (candidate.name || '').trim().toLowerCase()
  const normalizedPlayer = (playerName || '').trim().toLowerCase()

  return Boolean(normalizedCandidate && normalizedPlayer && normalizedCandidate === normalizedPlayer)
}

function getPlayerFieldState(
  playerWrap: PlayerWrapper,
  events: MatchEvent[]
): PlayerFieldState {
  const basePlayer = playerWrap.player || {}
  const displayName = basePlayer.name || 'Jugador'
  const displayNumber = basePlayer.number

  const substitutionEvent = events.find((event) => {
    const kind = getEventKind(event)
    return (
      kind === 'substitution' &&
      matchesPlayerEvent(event.player, basePlayer.id, basePlayer.name)
    )
  })

  const matchesDisplayedPlayer = (event: MatchEvent) =>
    matchesPlayerEvent(event.player, basePlayer.id, displayName) ||
    matchesPlayerEvent(event.player, undefined, displayName)

  const goalEvents = events.filter((event) => {
    const kind = getEventKind(event)
    return (kind === 'goal' || kind === 'penalty-goal') && matchesDisplayedPlayer(event)
  })

  const yellowCardEvents = events.filter((event) =>
    getEventKind(event) === 'yellow-card' && matchesDisplayedPlayer(event)
  )

  const redCardEvents = events.filter((event) =>
    getEventKind(event) === 'red-card' && matchesDisplayedPlayer(event)
  )

  return {
    displayName: abbreviatePlayerName(displayName),
    displayNumber,
    substitutionMinute: substitutionEvent?.time?.elapsed ?? null,
    substitutionReplacementName: substitutionEvent?.assist?.name
      ? abbreviatePlayerName(substitutionEvent.assist.name)
      : null,
    goals: goalEvents.length,
    goalMinutes: goalEvents.map((event) => event.time?.elapsed ?? null),
    yellowCards: yellowCardEvents.length,
    yellowCardMinutes: yellowCardEvents.map((event) => event.time?.elapsed ?? null),
    redCards: redCardEvents.length,
    redCardMinutes: redCardEvents.map((event) => event.time?.elapsed ?? null),
  }
}

function abbreviatePlayerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return name

  const lastName = parts[parts.length - 1]
  const firstInitial = parts[0]?.[0]

  return firstInitial ? `${firstInitial}. ${lastName}` : lastName
}

function incidenceSlots(count: number, minutes: Array<number | null>) {
  return Array.from({ length: count }, (_, index) => minutes[index] ?? null)
}

function FieldSideIncidences({
  goals,
  goalMinutes,
  yellowCards,
  yellowCardMinutes,
  redCards,
  redCardMinutes,
}: {
  goals: number
  goalMinutes: Array<number | null>
  yellowCards: number
  yellowCardMinutes: Array<number | null>
  redCards: number
  redCardMinutes: Array<number | null>
}) {
  if (!goals && !yellowCards && !redCards) return null

  return (
    <div className="absolute left-[calc(50%+20px)] top-1/2 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-left sm:left-[calc(50%+35px)] sm:gap-2">
      {incidenceSlots(goals, goalMinutes).map((minute, index) => (
        <span key={`goal-${index}`} className="inline-flex items-center gap-0.5 text-[10px] font-black text-white sm:text-xs">
          <EventIcon kind="goal" size="lg" />
          {minute ? <span>{minute}&apos;</span> : null}
        </span>
      ))}
      {incidenceSlots(yellowCards, yellowCardMinutes).map((minute, index) => (
        <span key={`yellow-${index}`} className="inline-flex items-center gap-0.5 text-[10px] font-black text-[#f3d36c] sm:text-xs">
          <EventIcon kind="yellow-card" />
          {minute ? <span>{minute}&apos;</span> : null}
        </span>
      ))}
      {incidenceSlots(redCards, redCardMinutes).map((minute, index) => (
        <span key={`red-${index}`} className="inline-flex items-center gap-0.5 text-[10px] font-black text-[#ff8f8f] sm:text-xs">
          <EventIcon kind="red-card" />
          {minute ? <span>{minute}&apos;</span> : null}
        </span>
      ))}
    </div>
  )
}

function FieldSubstitutionBadge({
  substitutionMinute,
  substitutionReplacementName,
}: {
  substitutionMinute?: number | null
  substitutionReplacementName?: string | null
}) {
  if (!substitutionMinute) return null

  return (
    <div className="mt-0.5 max-w-[96px] text-center leading-tight sm:max-w-[128px]">
      <div className="text-xs font-black text-[#ff8f8f] sm:text-sm">&darr; {substitutionMinute}&apos;</div>
      {substitutionReplacementName ? (
        <div className="mt-px truncate text-[10px] font-semibold text-[#dbe7de] sm:text-xs">
          por {substitutionReplacementName}
        </div>
      ) : null}
    </div>
  )
}

function CaptainBadge() {
  return (
    <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-[#f3d36c] bg-[#5b4a16] px-0.5 text-[8px] font-black uppercase tracking-[0.04em] text-[#ffe38a] shadow-[0_0_0_1px_rgba(0,0,0,0.28)] sm:h-4 sm:min-w-4 sm:px-1 sm:text-[9px]">
      C
    </span>
  )
}

function PlayerOnField({
  playerWrap,
  formation,
  side,
  teamName,
  isHome,
  lineup,
  events,
  captainReference,
  playerIndex,
  lineupPlayers,
  fullField = false,
}: {
  playerWrap: PlayerWrapper
  formation?: string
  side: 'top' | 'bottom'
  teamName: string
  isHome: boolean
  lineup?: MatchLineup | null
  events: MatchEvent[]
  captainReference?: {
    id?: number
    name?: string
  }
  playerIndex?: number
  lineupPlayers?: PlayerWrapper[]
  fullField?: boolean
}) {
  const pos = getPlayerPosition(playerWrap, formation, side, playerIndex, lineupPlayers, fullField)
  const player = playerWrap.player || {}
  const style = getStyleForPlayer(playerWrap, teamName, isHome, lineup)
  const playerState = getPlayerFieldState(playerWrap, events)
  const isCaptain = Boolean(
    isCaptainFlag(player.captain) ||
    isCaptainFlag(playerWrap.captain) ||
    (captainReference?.id && player.id && captainReference.id === player.id) ||
    (
      !captainReference?.id &&
      captainReference?.name &&
      player.name &&
      captainReference.name.trim().toLowerCase() === player.name.trim().toLowerCase()
    )
  )

  return (
    <div
      className="absolute w-[112px] -translate-x-1/2 -translate-y-1/2 text-center sm:w-[148px]"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
      }}
    >
      <div className="relative mx-auto flex w-fit max-w-full justify-center">
        {isCaptain ? (
          <div className="absolute -left-2 -top-1 z-10">
            <CaptainBadge />
          </div>
        ) : null}
        <Shirt number={playerState.displayNumber ?? player.number} style={style} />
        <FieldSideIncidences
          goals={playerState.goals}
          goalMinutes={playerState.goalMinutes}
          yellowCards={playerState.yellowCards}
          yellowCardMinutes={playerState.yellowCardMinutes}
          redCards={playerState.redCards}
          redCardMinutes={playerState.redCardMinutes}
        />
      </div>
      <div className="mx-auto mt-1 max-w-[94px] overflow-hidden truncate text-ellipsis whitespace-nowrap text-xs font-bold leading-tight text-white sm:mt-1.5 sm:max-w-[128px] sm:text-base">
        {playerState.displayName}
      </div>
      <FieldSubstitutionBadge
        substitutionMinute={playerState.substitutionMinute}
        substitutionReplacementName={playerState.substitutionReplacementName}
      />
    </div>
  )
}

function FormationPitch({
  teamName,
  teamLogo,
  formation,
  lineup,
  side,
  isHome,
  events,
  captainReference,
}: {
  teamName: string
  teamLogo?: string
  formation?: string
  lineup?: MatchLineup | null
  side: 'top' | 'bottom'
  isHome: boolean
  events: MatchEvent[]
  captainReference?: {
    id?: number
    name?: string
  }
}) {
  const starters = lineup?.startXI || []

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[#25553d] bg-[linear-gradient(180deg,#163828_0%,#12281d_12%,#0f1317_100%)]">
      <div className="flex items-center justify-between gap-2 border-b border-[#25553d] bg-black/10 px-2 py-2 md:px-4 md:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <TeamLogo logo={teamLogo} name={teamName} size="sm" />
          <span className="truncate font-bold text-white">{teamName}</span>
        </div>
        <span className="shrink-0 text-sm font-semibold text-[#dbe7de]">
          {formation || 'Sin formación real'}
        </span>
      </div>

      <div className="relative min-h-[560px] w-full min-w-0 overflow-hidden bg-transparent sm:min-h-[680px] lg:min-h-[760px]">
        <div className="absolute inset-x-0 top-1/2 h-px bg-[#4ea170]/50" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#4ea170]/40" />
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7ff0b2]/40" />

        <div className="absolute left-1/2 top-0 h-16 w-36 -translate-x-1/2 border-x border-b border-[#4ea170]/40 sm:w-40" />
        <div className="absolute left-1/2 top-0 h-7 w-16 -translate-x-1/2 border-x border-b border-[#4ea170]/40 sm:w-20" />
        <div className="absolute left-1/2 bottom-0 h-16 w-36 -translate-x-1/2 border-x border-t border-[#4ea170]/40 sm:w-40" />
        <div className="absolute left-1/2 bottom-0 h-7 w-16 -translate-x-1/2 border-x border-t border-[#4ea170]/40 sm:w-20" />

        {starters.map((playerWrap, index) => (
          <PlayerOnField
            key={`${playerWrap.player?.id || index}-${side}`}
            playerWrap={playerWrap}
            formation={formation}
            side={side}
            teamName={teamName}
            isHome={isHome}
            lineup={lineup}
            lineupPlayers={starters}
            events={events}
            captainReference={captainReference}
            playerIndex={index}
            fullField
          />
        ))}
      </div>
    </div>
  )
}

function buildPanelPlayers({
  players,
  events,
  teamName,
  isHome,
  lineup,
  captainReference,
}: {
  players: PlayerWrapper[]
  events: MatchEvent[]
  teamName: string
  isHome: boolean
  lineup?: MatchLineup | null
  captainReference?: {
    id?: number
    name?: string
  }
}) {
  return players.map((playerWrap, index) => {
    const player = playerWrap.player || {}
    const isCaptain = Boolean(
      isCaptainFlag(player.captain) ||
      isCaptainFlag(playerWrap.captain) ||
      (captainReference?.id && player.id && captainReference.id === player.id) ||
      (
        !captainReference?.id &&
        captainReference?.name &&
        player.name &&
        captainReference.name.trim().toLowerCase() === player.name.trim().toLowerCase()
      )
    )
    const playerOutEvent = events.find((event) => {
      const kind = getEventKind(event)
      return kind === 'substitution' && matchesPlayerEvent(event.player, player.id, player.name)
    })
    const playerInEvent = events.find((event) => {
      const kind = getEventKind(event)
      return kind === 'substitution' && matchesPlayerEvent(event.assist, player.id, player.name)
    })
    const goals = events.filter((event) => {
      const kind = getEventKind(event)
      return (kind === 'goal' || kind === 'penalty-goal') && matchesPlayerEvent(event.player, player.id, player.name)
    }).length
    const yellowCards = events.filter((event) =>
      getEventKind(event) === 'yellow-card' && matchesPlayerEvent(event.player, player.id, player.name)
    ).length
    const redCards = events.filter((event) =>
      getEventKind(event) === 'red-card' && matchesPlayerEvent(event.player, player.id, player.name)
    ).length
    const substitutionDirection: 'in' | 'out' | undefined = playerOutEvent
      ? 'out'
      : playerInEvent
      ? 'in'
      : undefined

    return {
      id: String(player.id || `${teamName}-${index}`),
      name: player.name || 'Jugador',
      number: player.number,
      style: getStyleForPlayer(playerWrap, teamName, isHome, lineup),
      isCaptain,
      goals,
      yellowCards,
      redCards,
      replacedPlayerName:
        playerOutEvent?.assist?.name ||
        playerInEvent?.player?.name,
      substitutionLabel:
        playerOutEvent?.assist?.name
          ? 'por'
          : playerInEvent?.player?.name
          ? 'por'
          : undefined,
      substitutionDirection,
      substitutionMinute: playerOutEvent?.time?.elapsed ?? playerInEvent?.time?.elapsed ?? null,
    }
  })
}

function hasVisualFormation(lineup?: MatchLineup | null) {
  const starters = lineup?.startXI || []
  return starters.some((playerWrap) => Boolean(playerWrap.player?.grid && playerWrap.player.grid.includes(':')))
}

export default async function PartidoDetallePage({ params }: PageProps) {
  const { id } = await params
  let data

  try {
    data = await getMatchDetail(Number(id))
  } catch (error) {
    const message =
      error instanceof ApiFootballError
        ? error.code === 'requests'
          ? 'Se alcanzó el límite diario de la API. El detalle del partido no pudo cargarse.'
          : error.message
        : 'No se pudo cargar el detalle del partido.'

    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="w-full rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-4 md:p-6">
            <h1 className="text-2xl font-black">Detalle no disponible</h1>
            <p className="mt-2 text-[#ffd5d5]">{message}</p>
          </div>
        </div>
      </div>
    )
  }

  const fixture = data.fixture as MatchFixture | null

  if (!fixture) {
    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="w-full rounded-2xl border border-white/8 bg-[#111418] p-4 md:p-6">
            <h1 className="text-2xl font-black">Partido no encontrado</h1>
            <p className="mt-2 text-[#8d98a7]">No existe información para este partido.</p>
          </div>
        </div>
      </div>
    )
  }

  const homeTeam = fixture.teams.home
  const awayTeam = fixture.teams.away
  const goals = fixture.goals
  const status = fixture.fixture.status
  const stats: MatchStatisticsTeam[] = Array.isArray(data.statistics) ? data.statistics : []
  const events: MatchEvent[] = Array.isArray(data.events) ? data.events : []
  const lineups: MatchLineup[] = Array.isArray(data.lineups) ? data.lineups : []

  const homeStats: MatchStatistic[] = stats[0]?.statistics || []
  const awayStats: MatchStatistic[] = stats[1]?.statistics || []

  const homeLineup =
    lineups.find((lineup) => lineup.team?.name === homeTeam.name) || lineups[0] || null
  const awayLineup =
    lineups.find((lineup) => lineup.team?.name === awayTeam.name) || lineups[1] || null

  const homeColors = getTeamStyle(homeTeam.name, true, homeLineup, 'player')
  const awayColors = getTeamStyle(awayTeam.name, false, awayLineup, 'player')
  const homeTeamEvents = events.filter((event) => isHomeEvent(event, homeTeam.name))
  const awayTeamEvents = events.filter((event) => isAwayEvent(event, awayTeam.name))
  const homeCaptainReference = getCaptainReference(homeLineup)
  const awayCaptainReference = getCaptainReference(awayLineup)
  const homeHasVisualFormation = hasVisualFormation(homeLineup)
  const awayHasVisualFormation = hasVisualFormation(awayLineup)
  const hasAnyVisualFormation = homeHasVisualFormation || awayHasVisualFormation
  const homeStarterPlayers = buildPanelPlayers({
    players: homeLineup?.startXI || [],
    events: homeTeamEvents,
    teamName: homeTeam.name,
    isHome: true,
    lineup: homeLineup,
    captainReference: homeCaptainReference,
  })
  const awayStarterPlayers = buildPanelPlayers({
    players: awayLineup?.startXI || [],
    events: awayTeamEvents,
    teamName: awayTeam.name,
    isHome: false,
    lineup: awayLineup,
    captainReference: awayCaptainReference,
  })
  const homeSubstitutePlayers = buildPanelPlayers({
    players: homeLineup?.substitutes || [],
    events: homeTeamEvents,
    teamName: homeTeam.name,
    isHome: true,
    lineup: homeLineup,
  })
  const awaySubstitutePlayers = buildPanelPlayers({
    players: awayLineup?.substitutes || [],
    events: awayTeamEvents,
    teamName: awayTeam.name,
    isHome: false,
    lineup: awayLineup,
  })
  return (
    <div className="min-h-screen text-white">
      <div className="w-full max-w-none px-0 py-3 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-6">
        <header className="relative mb-4 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#111418]/95 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
          <AutoRefresh
            intervalMs={60000}
            showButton
            className="absolute right-4 top-4 z-10"
          />

          <div className="border-b border-white/6 px-2 py-3 md:px-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
              {translateCountry(fixture.league.country)}
            </p>
            <h1 className="mt-1 text-lg font-bold text-white md:text-xl">
              {translateLeagueName(fixture.league.name)}
            </h1>
          </div>

          <div className="grid gap-3 px-2 py-3 md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4 md:px-4 md:py-5">
            <div
              className="flex items-center gap-3 rounded-2xl border px-2 py-3 md:justify-start md:px-4 md:py-4"
              style={getPanelStyle(homeColors)}
            >
              <TeamLogo logo={homeTeam.logo} name={homeTeam.name} />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-white md:text-xl">{homeTeam.name}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-[#8d98a7]">Local</p>
                <TeamPanelLink id={homeTeam.id} />
              </div>
            </div>

            <div className="pt-1 text-center md:self-start">
              <div className="inline-flex rounded-md border border-[#25553d] bg-[#163828] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ff0b2]">
                {formatStatusLabel(status.long, status.elapsed)}
              </div>
              <div className="mt-2 text-5xl font-black leading-none tracking-tight text-white md:text-6xl">
                {goals.home ?? '-'} <span className="text-[#566170]">-</span> {goals.away ?? '-'}
              </div>
            </div>

            <div
              className="flex items-center gap-3 rounded-2xl border px-2 py-3 md:justify-end md:px-4 md:py-4"
              style={getPanelStyle(awayColors)}
            >
              <div className="min-w-0 text-right">
                <p className="truncate text-lg font-bold text-white md:text-xl">{awayTeam.name}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-[#8d98a7]">Visitante</p>
                <div className="flex justify-end">
                  <TeamPanelLink id={awayTeam.id} />
                </div>
              </div>
              <TeamLogo logo={awayTeam.logo} name={awayTeam.name} />
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/6 bg-[#13181d] px-2 py-3 text-sm text-[#c8d0da] md:grid-cols-3 md:px-4">
            <div>
              <span className="text-[#8d98a7]">Estadio</span>
              <p className="mt-1 font-medium text-white">
                {fixture.fixture.venue?.name || 'Estadio no disponible'}
              </p>
            </div>
            <div>
              <span className="text-[#8d98a7]">Ubicación</span>
              <p className="mt-1 font-medium text-white">
                {formatVenueLocation(fixture.fixture.venue?.city)}
              </p>
            </div>
            <div>
              <span className="text-[#8d98a7]">Árbitro</span>
              <p className="mt-1 font-medium text-white">
                {formatReferee(fixture.fixture.referee)}
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_320px]">
          <section className="space-y-4">
            <div className="w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
              <div className="border-b border-white/6 bg-[#13181d] px-2 py-3 md:px-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-white">Minuto a minuto</h2>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#8d98a7]">
                    Cronología
                  </span>
                </div>
              </div>

              {events.length ? (
                <div>
                  <div className="grid grid-cols-[1fr_56px_1fr] border-b border-white/6 bg-[#12171c] px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d98a7] md:grid-cols-[1fr_72px_1fr] md:px-4">
                    <div>{homeTeam.name}</div>
                    <div className="text-center">Min</div>
                    <div className="text-right">{awayTeam.name}</div>
                  </div>

                  {[...events].reverse().map((event, index) => {
                    const isHome = isHomeEvent(event, homeTeam.name)
                    const isAway = isAwayEvent(event, awayTeam.name)
                    const minuteLabel = event.time?.elapsed ? `${event.time.elapsed}'` : '-'
                    const style = getEventTypeStyle(event)

                    return (
                      <div
                        key={`${event.time?.elapsed || 'x'}-${index}`}
                        className="grid grid-cols-[1fr_56px_1fr] items-center border-b border-white/6 px-2 py-3 last:border-b-0 md:grid-cols-[1fr_72px_1fr] md:px-4"
                      >
                        <div className="min-w-0 pr-3">
                          {isHome ? (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex min-h-4 min-w-4 items-center justify-center ${style.accent}`}>
                                <EventIcon kind={style.kind} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                  {getEventPrimary(event)}
                                </p>
                                <p className="truncate text-xs text-[#8d98a7]">
                                  {getEventSecondary(event)}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="text-center">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${style.badge}`}>
                            {minuteLabel}
                          </span>
                        </div>

                        <div className="min-w-0 pl-3">
                          {isAway ? (
                            <div className="flex items-center justify-end gap-2 text-right">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                  {getEventPrimary(event)}
                                </p>
                                <p className="truncate text-xs text-[#8d98a7]">
                                  {getEventSecondary(event)}
                                </p>
                              </div>
                              <span className={`inline-flex min-h-4 min-w-4 items-center justify-center ${style.accent}`}>
                                <EventIcon kind={style.kind} />
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">
                  No hay eventos disponibles.
                </div>
              )}
            </div>

            <div className="w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
              <div className="border-b border-white/6 bg-[#13181d] px-2 py-3 md:px-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-white">Formación</h2>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#8d98a7]">
                    Visual
                  </span>
                </div>
              </div>

              {homeLineup || awayLineup ? (
                <div className="w-full px-0 py-2 md:p-4">
                  {hasAnyVisualFormation ? (
                    <div className="space-y-3">
                      {homeHasVisualFormation && homeLineup ? (
                        <FormationPitch
                          teamName={homeTeam.name}
                          teamLogo={homeTeam.logo}
                          formation={homeLineup.formation}
                          lineup={homeLineup}
                          side="top"
                          isHome
                          events={homeTeamEvents}
                          captainReference={homeCaptainReference}
                        />
                      ) : null}

                      {awayHasVisualFormation && awayLineup ? (
                        <FormationPitch
                          teamName={awayTeam.name}
                          teamLogo={awayTeam.logo}
                          formation={awayLineup.formation}
                          lineup={awayLineup}
                          side="bottom"
                          isHome={false}
                          events={awayTeamEvents}
                          captainReference={awayCaptainReference}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-[#12171c] px-2 py-3 text-sm text-[#8d98a7] md:px-4 md:py-4">
                      Este partido no tiene una formación visual real cargada por la fuente de datos.
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 md:mt-4 md:grid-cols-2 md:gap-4">
                <FormationTeamPanel
                  title={homeTeam.name}
                  coachName={homeLineup?.coach?.name}
                  starters={homeStarterPlayers}
                  substitutes={homeSubstitutePlayers}
                  align="left"
                />

                <FormationTeamPanel
                  title={awayTeam.name}
                  coachName={awayLineup?.coach?.name}
                  starters={awayStarterPlayers}
                  substitutes={awaySubstitutePlayers}
                  align="right"
                />
                  </div>
                </div>
              ) : (
                <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">
                  No hay alineaciones disponibles.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
              <div className="border-b border-white/6 bg-[#13181d] px-2 py-3 md:px-4">
                <div className="flex items-center justify-center">
                  <h2 className="text-base font-bold text-white">Datos del partido</h2>
                </div>
              </div>

              <div className="px-2 py-1 md:px-4">
                <InfoRow label="Estado" value={translateStatus(status.long)} />
                <InfoRow label="Liga" value={translateLeagueName(fixture.league.name)} />
                <InfoRow label="País" value={translateCountry(fixture.league.country)} />
                <InfoRow label="Árbitro" value={formatReferee(fixture.fixture.referee)} />
              </div>
            </div>

            <div className="w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
              <div className="border-b border-white/6 bg-[#13181d] px-2 py-3 md:px-4">
                <div className="flex items-center justify-center">
                  <h2 className="text-lg font-bold tracking-[0.01em] text-white">Estadísticas</h2>
                </div>
              </div>

              {homeStats.length && awayStats.length ? (
                <div className="space-y-3 px-2 py-3 md:px-4 md:py-4">
                  {homeStats.map((stat, index) => {
                    const awayValue = awayStats[index]?.value
                    const homeNumber = parseStatNumber(stat.value)
                    const awayNumber = parseStatNumber(awayValue)
                    const total = homeNumber + awayNumber
                    const splitPoint = total > 0 ? (homeNumber / total) * 100 : 50

                    return (
                      <div
                        key={`${stat.type}-${index}`}
                        className="rounded-xl border border-white/6 bg-[#13181d] px-3 py-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[15px] font-extrabold text-white">
                            {formatStatValue(stat.value)}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8d98a7]">
                            {translateStatType(stat.type)}
                          </span>
                          <span className="text-[15px] font-extrabold text-white">
                            {formatStatValue(awayValue)}
                          </span>
                        </div>

                        <div className="relative h-2 overflow-hidden rounded-full bg-[#1b2128]">
                          <div
                            className="absolute left-0 top-0 h-full bg-[linear-gradient(90deg,#2fbf71_0%,#7ff0b2_100%)]"
                            style={{ width: `${splitPoint}%` }}
                          />
                          <div
                            className="absolute right-0 top-0 h-full bg-[linear-gradient(90deg,#c8d0da_0%,#5f6b7a_100%)]"
                            style={{ width: `${100 - splitPoint}%` }}
                          />
                          <div
                            className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-white/25"
                            style={{ left: `calc(${splitPoint}% - 1px)` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">
                  No hay estadísticas disponibles.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
