import type {
  PrivateTournamentDetail,
  PrivateTournamentSearchResult,
  PrivateTournamentSummary,
} from '@/frontend/types/private-tournaments'

type ApiResponse<T> = T & {
  ok?: boolean
  error?: string
}

async function parseResponse<T>(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok) {
    throw new Error(data.error || fallback)
  }

  return data
}

export async function getPrivateTournaments() {
  const response = await fetch('/api/prode/private-tournaments', {
    cache: 'no-store',
  })
  const data = await parseResponse<{ tournaments?: PrivateTournamentSummary[] }>(
    response,
    'No se pudieron cargar tus torneos.'
  )

  return data.tournaments ?? []
}

export async function createPrivateTournament(input: {
  baseName: string
  leagueExternalId: string
}) {
  const response = await fetch('/api/prode/private-tournaments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const data = await parseResponse<{ tournament?: PrivateTournamentSummary }>(
    response,
    'No se pudo crear el torneo.'
  )

  return data.tournament
}

export async function searchPrivateTournament(name: string) {
  const params = new URLSearchParams({ name })
  const response = await fetch(`/api/prode/private-tournaments/search?${params}`, {
    cache: 'no-store',
  })
  const data = await parseResponse<{
    found?: boolean
    tournament?: PrivateTournamentSearchResult | null
  }>(response, 'No se pudo buscar el torneo.')

  return data.tournament ?? null
}

export async function requestPrivateTournamentAccess(tournamentId: string) {
  const response = await fetch(
    `/api/prode/private-tournaments/${encodeURIComponent(tournamentId)}/request-access`,
    {
      method: 'POST',
    }
  )

  await parseResponse(response, 'No se pudo solicitar acceso.')
}

export async function getPrivateTournamentDetail(tournamentId: string) {
  const response = await fetch(
    `/api/prode/private-tournaments/${encodeURIComponent(tournamentId)}`,
    {
      cache: 'no-store',
    }
  )
  const data = await parseResponse<{ tournament?: PrivateTournamentDetail }>(
    response,
    'No se pudo cargar el torneo.'
  )

  if (!data.tournament) {
    throw new Error('No se pudo cargar el torneo.')
  }

  return data.tournament
}

export async function approvePrivateTournamentRequest(
  tournamentId: string,
  requestId: string
) {
  const response = await fetch(
    `/api/prode/private-tournaments/${encodeURIComponent(tournamentId)}/requests/${encodeURIComponent(requestId)}/approve`,
    {
      method: 'POST',
    }
  )
  const data = await parseResponse<{ tournament?: PrivateTournamentDetail }>(
    response,
    'No se pudo aprobar la solicitud.'
  )

  if (!data.tournament) {
    throw new Error('No se pudo aprobar la solicitud.')
  }

  return data.tournament
}

export async function rejectPrivateTournamentRequest(
  tournamentId: string,
  requestId: string
) {
  const response = await fetch(
    `/api/prode/private-tournaments/${encodeURIComponent(tournamentId)}/requests/${encodeURIComponent(requestId)}/reject`,
    {
      method: 'POST',
    }
  )
  const data = await parseResponse<{ tournament?: PrivateTournamentDetail }>(
    response,
    'No se pudo rechazar la solicitud.'
  )

  if (!data.tournament) {
    throw new Error('No se pudo rechazar la solicitud.')
  }

  return data.tournament
}
