const CATEGORY_LABELS: Record<string, string> = {
  'mundial-2026': 'Mundial 2026',
  'futbol-argentino': 'Fútbol argentino',
  libertadores: 'Libertadores',
  champions: 'Champions',
  guias: 'Guías',
  estadisticas: 'Estadísticas',
  'historias-mundialistas': 'Historias mundialistas',
  'momento-bajonero': 'Momento bajonero',
  prode: 'Prode',
}

const STATUS_LABELS: Record<string, string> = {
  confirmado: 'Confirmado',
  rumor: 'Rumor',
  negociacion: 'Negociación',
  caido: 'Caído',
}

const TYPE_LABELS: Record<string, string> = {
  alta: 'Alta',
  baja: 'Baja',
  prestamo: 'Préstamo',
  renovacion: 'Renovación',
  'jugador-libre': 'Jugador libre',
}

export function formatEditorialDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date =
    Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new Date(Date.UTC(year, month - 1, day, 12))
      : new Date(value)

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

export function formatEditorialCategory(value: string) {
  return CATEGORY_LABELS[value] ?? value
}

export function formatTransferStatus(value: string) {
  return STATUS_LABELS[value] ?? value
}

export function formatTransferType(value: string) {
  return TYPE_LABELS[value] ?? value
}
