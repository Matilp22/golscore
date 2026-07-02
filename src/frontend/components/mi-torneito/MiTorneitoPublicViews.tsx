import Link from 'next/link'
import { submitMiTorneitoRequestAction } from '@/app/mi-torneito/actions'
import { TeamLogo } from '@/frontend/components/AssetImage'
import { MiTorneitoShareActions } from '@/frontend/components/mi-torneito/MiTorneitoShareActions'
import type {
  MiTorneitoDataError,
  MiTorneitoMatch,
  MiTorneitoStandingRow,
  MiTorneitoTeam,
  MiTorneitoTournament,
  MiTorneitoTournamentBundle,
} from '@/shared/mi-torneito/types'
import {
  MI_TORNEITO_MATCH_STATUS_LABELS,
  MI_TORNEITO_STATUS_LABELS,
} from '@/shared/mi-torneito/types'
import {
  formatMiTorneitoDate,
  formatMiTorneitoDateTime,
  formatMiTorneitoTime,
  getMiTorneitoScore,
  getMiTorneitoTeamById,
} from '@/shared/mi-torneito/utils'

type RequestFeedback = {
  kind: 'success' | 'error'
  message: string
} | null

export function MiTorneitoSetupNotice({ error }: { error?: MiTorneitoDataError | null }) {
  if (!error) return null

  return (
    <div className="hf-mi-notice">
      <strong>{error.setupRequired ? 'SQL pendiente' : 'Aviso'}</strong>
      <span>{error.message}</span>
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Zm2 10h4v4h3v2H7v-2h3v-4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function TeamBadge({ team, size = 38 }: { team: MiTorneitoTeam | null; size?: number }) {
  if (!team) {
    return (
      <span className="hf-mi-team-badge" style={{ width: size, height: size }}>
        HF
      </span>
    )
  }

  return (
    <span className="hf-mi-team-badge" style={{ width: size, height: size }}>
      <TeamLogo
        src={team.logoUrl}
        alt={team.name}
        size={size - 8}
        className="h-full w-full object-contain"
      />
    </span>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="hf-mi-empty">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

export function MiTorneitoRequestForm({ feedback }: { feedback?: RequestFeedback }) {
  return (
    <section id="solicitar" className="hf-mi-form-card">
      <div>
        <p className="hf-mi-kicker">Solicitud concierge</p>
        <h2>Pedí tu torneo</h2>
        <span>
          Cargá los datos principales. El equipo de Hay Fulbo revisa la solicitud,
          arma la estructura inicial y te habilita el panel de administración.
        </span>
      </div>

      {feedback ? (
        <div className={feedback.kind === 'success' ? 'hf-mi-feedback is-success' : 'hf-mi-feedback is-error'}>
          {feedback.message}
        </div>
      ) : null}

      <form action={submitMiTorneitoRequestAction} className="hf-mi-form-grid">
        <label>
          <span>Tu nombre</span>
          <input name="organizerName" required placeholder="Ej: Matias Perez" />
        </label>
        <label>
          <span>Email</span>
          <input name="organizerEmail" required type="email" placeholder="tu@email.com" />
        </label>
        <label>
          <span>Telefono</span>
          <input name="organizerPhone" placeholder="+54 9 ..." />
        </label>
        <label>
          <span>Nombre del torneo</span>
          <input name="tournamentName" required placeholder="Liga del barrio" />
        </label>
        <label>
          <span>Ciudad / zona</span>
          <input name="city" placeholder="Rosario, Santa Fe" />
        </label>
        <label>
          <span>Cantidad estimada de equipos</span>
          <input name="expectedTeams" type="number" min="2" max="256" placeholder="12" />
        </label>
        <label className="hf-mi-form-wide">
          <span>Detalle útil</span>
          <textarea
            name="notes"
            rows={4}
            placeholder="Formato, días de juego, categorías, fixture ya armado o cualquier dato importante."
          />
        </label>
        <button type="submit" className="hf-mi-primary-button">
          Enviar solicitud
          <ArrowIcon />
        </button>
      </form>
    </section>
  )
}

export function MiTorneitoTournamentCard({ tournament }: { tournament: MiTorneitoTournament }) {
  return (
    <Link href={`/mi-torneito/t/${tournament.slug}`} className="hf-mi-tournament-card">
      <span className="hf-mi-tournament-icon">
        <TrophyIcon />
      </span>
      <span className="min-w-0">
        <strong>{tournament.name}</strong>
        <small>
          {MI_TORNEITO_STATUS_LABELS[tournament.status]} · {tournament.city ?? 'Sede a confirmar'}
        </small>
      </span>
      <ArrowIcon />
    </Link>
  )
}

export function MiTorneitoLanding({
  tournaments,
  error,
  feedback,
}: {
  tournaments: MiTorneitoTournament[]
  error?: MiTorneitoDataError | null
  feedback?: RequestFeedback
}) {
  return (
    <main className="hf-mi-page">
      <MiTorneitoSetupNotice error={error} />

      <section className="hf-mi-hero">
        <div className="hf-mi-hero-copy">
          <p className="hf-mi-kicker">Nuevo producto</p>
          <h1>Mi Torneito</h1>
          <span>
            Tu liga amateur con fixture, tabla, resultados, equipos y links para compartir,
            todo dentro de Hay Fulbo.
          </span>
          <div className="hf-mi-hero-actions">
            <a href="#solicitar" className="hf-mi-primary-button">
              Crear mi torneo
              <ArrowIcon />
            </a>
            <Link href="/mi-torneito/torneos" className="hf-mi-secondary-button">
              Ver torneos activos
            </Link>
          </div>
        </div>
        <div className="hf-mi-hero-panel" aria-label="Vista previa de Mi Torneito">
          <div className="hf-mi-live-pill">En vivo</div>
          <div className="hf-mi-mini-score">
            <span>Los Pibes FC</span>
            <strong>2 - 1</strong>
            <span>La Banda</span>
          </div>
          <div className="hf-mi-mini-table">
            <span>Tabla</span>
            <strong>1. Los Pibes FC · 12 pts</strong>
            <strong>2. La Banda · 9 pts</strong>
            <strong>3. Norte Unido · 7 pts</strong>
          </div>
        </div>
      </section>

      <section className="hf-mi-benefits">
        {[
          ['Fixture claro', 'Fechas, horarios, sedes y estado de cada partido.'],
          ['Tabla automática', 'Puntos, goles y diferencia calculados desde resultados reales.'],
          ['Panel simple', 'El organizador carga resultados y administra equipos sin tocar código.'],
          ['Listo para compartir', 'Cada torneo, equipo y partido tiene link público.'],
        ].map(([title, description]) => (
          <article key={title}>
            <strong>{title}</strong>
            <span>{description}</span>
          </article>
        ))}
      </section>

      <section className="hf-mi-section">
        <div className="hf-mi-section-head">
          <div>
            <p className="hf-mi-kicker">Cómo funciona</p>
            <h2>Un MVP concierge, sin fricción</h2>
          </div>
        </div>
        <div className="hf-mi-steps">
          {[
            ['1', 'El organizador solicita el torneo.'],
            ['2', 'Hay Fulbo lo revisa y crea la estructura inicial.'],
            ['3', 'Se asigna un administrador del torneo.'],
            ['4', 'El torneo queda público con resultados, tabla y páginas para compartir.'],
          ].map(([number, text]) => (
            <article key={number}>
              <strong>{number}</strong>
              <span>{text}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="hf-mi-section">
        <div className="hf-mi-section-head">
          <div>
            <p className="hf-mi-kicker">Activos</p>
            <h2>Torneos publicados</h2>
          </div>
          <Link href="/mi-torneito/torneos">Ver todos</Link>
        </div>
        {tournaments.length ? (
          <div className="hf-mi-card-grid">
            {tournaments.map((tournament) => (
              <MiTorneitoTournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Todavía no hay torneos publicados"
            description="Cuando un superadmin publique un torneo, va a aparecer en esta sección."
          />
        )}
      </section>

      <MiTorneitoRequestForm feedback={feedback} />

      <section className="hf-mi-section">
        <div className="hf-mi-section-head">
          <div>
            <p className="hf-mi-kicker">FAQ</p>
            <h2>Preguntas frecuentes</h2>
          </div>
        </div>
        <div className="hf-mi-faq">
          <details>
            <summary>¿El organizador necesita una cuenta?</summary>
            <p>Para solicitar el torneo no. Para administrar resultados sí, porque el panel requiere sesión.</p>
          </details>
          <details>
            <summary>¿Hay pagos o planes en esta versión?</summary>
            <p>No. Esta primera versión es un MVP funcional sin pagos integrados.</p>
          </details>
          <details>
            <summary>¿La tabla se carga a mano?</summary>
            <p>No. Se calcula automáticamente desde los partidos finalizados.</p>
          </details>
        </div>
      </section>
    </main>
  )
}

export function MiTorneitoStandingsTable({
  standings,
  tournamentSlug,
}: {
  standings: MiTorneitoStandingRow[]
  tournamentSlug: string
}) {
  if (!standings.length) {
    return <EmptyState title="Sin equipos cargados" description="La tabla aparece cuando el torneo tenga equipos." />
  }

  return (
    <div className="hf-mi-table-wrap">
      <table className="hf-mi-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>DG</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.team.id}>
              <td>{row.position}</td>
              <td>
                <Link href={`/mi-torneito/t/${tournamentSlug}/e/${row.team.slug}`}>
                  <TeamBadge team={row.team} size={30} />
                  <span>{row.team.name}</span>
                </Link>
              </td>
              <td>{row.played}</td>
              <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function MiTorneitoTeamGrid({
  tournament,
  teams,
}: {
  tournament: MiTorneitoTournament
  teams: MiTorneitoTeam[]
}) {
  if (!teams.length) {
    return <EmptyState title="Sin equipos" description="El organizador todavía no cargó equipos." />
  }

  return (
    <div className="hf-mi-team-grid">
      {teams.map((team) => (
        <Link key={team.id} href={`/mi-torneito/t/${tournament.slug}/e/${team.slug}`}>
          <TeamBadge team={team} size={52} />
          <strong>{team.name}</strong>
          <span>{team.homeVenue || team.coachName || 'Ficha del equipo'}</span>
        </Link>
      ))}
    </div>
  )
}

function MatchRow({
  tournament,
  match,
  teams,
}: {
  tournament: MiTorneitoTournament
  match: MiTorneitoMatch
  teams: MiTorneitoTeam[]
}) {
  const home = getMiTorneitoTeamById(teams, match.homeTeamId)
  const away = getMiTorneitoTeamById(teams, match.awayTeamId)

  return (
    <Link href={`/mi-torneito/t/${tournament.slug}/p/${match.id}`} className="hf-mi-match-row">
      <span className="hf-mi-match-time">
        {match.status === 'live' ? 'En vivo' : formatMiTorneitoTime(match.scheduledAt)}
      </span>
      <span className="hf-mi-match-team is-home">
        <TeamBadge team={home} size={34} />
        <strong>{home?.name ?? 'Local'}</strong>
      </span>
      <span className="hf-mi-match-score">{getMiTorneitoScore(match)}</span>
      <span className="hf-mi-match-team">
        <TeamBadge team={away} size={34} />
        <strong>{away?.name ?? 'Visitante'}</strong>
      </span>
      <span className="hf-mi-match-meta">
        {MI_TORNEITO_MATCH_STATUS_LABELS[match.status]}
        {match.broadcastLabel ? <small>{match.broadcastLabel}</small> : null}
      </span>
    </Link>
  )
}

export function MiTorneitoMatchList({
  tournament,
  matches,
  teams,
}: {
  tournament: MiTorneitoTournament
  matches: MiTorneitoMatch[]
  teams: MiTorneitoTeam[]
}) {
  if (!matches.length) {
    return <EmptyState title="Sin partidos" description="El fixture se va a ver cuando el administrador cargue partidos." />
  }

  return (
    <div className="hf-mi-match-list">
      {matches.map((match) => (
        <MatchRow key={match.id} tournament={tournament} match={match} teams={teams} />
      ))}
    </div>
  )
}

export function MiTorneitoTournamentPageView({
  bundle,
  url,
}: {
  bundle: MiTorneitoTournamentBundle
  url: string
}) {
  const { tournament, organization, teams, matches, standings } = bundle

  return (
    <main className="hf-mi-page">
      <section className="hf-mi-tournament-hero">
        <div>
          <Link href="/mi-torneito" className="hf-mi-back-link">Mi Torneito</Link>
          <p className="hf-mi-kicker">{organization?.name ?? 'Hay Fulbo'}</p>
          <h1>{tournament.name}</h1>
          <span>
            {tournament.shortDescription || `${tournament.city ?? 'Sede a confirmar'} · ${tournament.format ?? 'Formato a confirmar'}`}
          </span>
          <div className="hf-mi-hero-tags">
            <span>{MI_TORNEITO_STATUS_LABELS[tournament.status]}</span>
            <span>{formatMiTorneitoDate(tournament.startsOn)}</span>
            <span>{teams.length} equipos</span>
          </div>
        </div>
        <MiTorneitoShareActions title={tournament.name} url={url} />
      </section>

      <div className="hf-mi-public-layout">
        <div className="hf-mi-main-column">
          <section className="hf-mi-section">
            <div className="hf-mi-section-head">
              <div>
                <p className="hf-mi-kicker">Fixture</p>
                <h2>Partidos</h2>
              </div>
            </div>
            <MiTorneitoMatchList tournament={tournament} matches={matches} teams={teams} />
          </section>

          <section className="hf-mi-section">
            <div className="hf-mi-section-head">
              <div>
                <p className="hf-mi-kicker">Planteles</p>
                <h2>Equipos</h2>
              </div>
            </div>
            <MiTorneitoTeamGrid tournament={tournament} teams={teams} />
          </section>
        </div>

        <aside className="hf-mi-side-column">
          <section className="hf-mi-section">
            <div className="hf-mi-section-head">
              <div>
                <p className="hf-mi-kicker">Tabla</p>
                <h2>Posiciones</h2>
              </div>
            </div>
            <MiTorneitoStandingsTable standings={standings} tournamentSlug={tournament.slug} />
          </section>
        </aside>
      </div>
    </main>
  )
}

export function MiTorneitoTeamPageView({
  bundle,
  team,
  url,
}: {
  bundle: MiTorneitoTournamentBundle
  team: MiTorneitoTeam
  url: string
}) {
  const teamMatches = bundle.matches.filter(
    (match) => match.homeTeamId === team.id || match.awayTeamId === team.id
  )
  const standing = bundle.standings.find((row) => row.team.id === team.id)

  return (
    <main className="hf-mi-page">
      <section className="hf-mi-tournament-hero">
        <div>
          <Link href={`/mi-torneito/t/${bundle.tournament.slug}`} className="hf-mi-back-link">
            {bundle.tournament.name}
          </Link>
          <div className="hf-mi-team-title">
            <TeamBadge team={team} size={64} />
            <div>
              <p className="hf-mi-kicker">Equipo</p>
              <h1>{team.name}</h1>
            </div>
          </div>
          <span>
            {team.homeVenue || team.coachName || 'Ficha pública del equipo en Mi Torneito.'}
          </span>
        </div>
        <MiTorneitoShareActions title={team.name} url={url} />
      </section>

      <div className="hf-mi-public-layout">
        <section className="hf-mi-section hf-mi-main-column">
          <div className="hf-mi-section-head">
            <div>
              <p className="hf-mi-kicker">Partidos</p>
              <h2>Fixture del equipo</h2>
            </div>
          </div>
          <MiTorneitoMatchList
            tournament={bundle.tournament}
            matches={teamMatches}
            teams={bundle.teams}
          />
        </section>

        <aside className="hf-mi-side-column">
          <section className="hf-mi-section">
            <div className="hf-mi-section-head">
              <div>
                <p className="hf-mi-kicker">Resumen</p>
                <h2>Campaña</h2>
              </div>
            </div>
            {standing ? (
              <div className="hf-mi-stats-grid">
                <span><strong>{standing.position}</strong>Posición</span>
                <span><strong>{standing.points}</strong>Puntos</span>
                <span><strong>{standing.played}</strong>PJ</span>
                <span><strong>{standing.goalDifference}</strong>DG</span>
              </div>
            ) : (
              <EmptyState title="Sin tabla" description="Todavía no hay datos de posiciones." />
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}

export function MiTorneitoMatchPageView({
  bundle,
  match,
  url,
}: {
  bundle: MiTorneitoTournamentBundle
  match: MiTorneitoMatch
  url: string
}) {
  const home = getMiTorneitoTeamById(bundle.teams, match.homeTeamId)
  const away = getMiTorneitoTeamById(bundle.teams, match.awayTeamId)
  const round = bundle.rounds.find((item) => item.id === match.roundId)

  return (
    <main className="hf-mi-page">
      <section className="hf-mi-match-hero">
        <Link href={`/mi-torneito/t/${bundle.tournament.slug}`} className="hf-mi-back-link">
          {bundle.tournament.name}
        </Link>
        <p className="hf-mi-kicker">
          {round?.name ?? 'Fecha'} · {formatMiTorneitoDateTime(match.scheduledAt)}
        </p>
        <div className="hf-mi-scoreboard">
          <div>
            <TeamBadge team={home} size={64} />
            <strong>{home?.name ?? 'Local'}</strong>
          </div>
          <span>{getMiTorneitoScore(match)}</span>
          <div>
            <TeamBadge team={away} size={64} />
            <strong>{away?.name ?? 'Visitante'}</strong>
          </div>
        </div>
        <div className="hf-mi-hero-tags">
          <span>{MI_TORNEITO_MATCH_STATUS_LABELS[match.status]}</span>
          <span>{match.venue || 'Sede a confirmar'}</span>
          <span>{match.broadcastLabel || 'TV no confirmada'}</span>
        </div>
        <MiTorneitoShareActions title={`${home?.name ?? 'Local'} vs ${away?.name ?? 'Visitante'}`} url={url} />
      </section>

      <section className="hf-mi-section">
        <div className="hf-mi-section-head">
          <div>
            <p className="hf-mi-kicker">Detalle</p>
            <h2>Información del partido</h2>
          </div>
        </div>
        <div className="hf-mi-detail-grid">
          <span><strong>Estado</strong>{MI_TORNEITO_MATCH_STATUS_LABELS[match.status]}</span>
          <span><strong>Fecha y hora</strong>{formatMiTorneitoDateTime(match.scheduledAt)}</span>
          <span><strong>Cancha</strong>{match.venue || 'A confirmar'}</span>
          <span><strong>Transmisión</strong>{match.broadcastLabel || 'TV no confirmada'}</span>
        </div>
      </section>
    </main>
  )
}
