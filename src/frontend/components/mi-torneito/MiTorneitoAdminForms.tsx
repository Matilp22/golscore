import Link from 'next/link'
import {
  assignMiTorneitoAdminAction,
  createMiTorneitoMatchAction,
  createMiTorneitoRoundAction,
  createMiTorneitoTeamAction,
  createMiTorneitoTournamentAction,
  saveMiTorneitoMatchResultAction,
  updateMiTorneitoRequestStatusAction,
} from '@/app/mi-torneito/actions'
import AdminCard from '@/components/admin/AdminCard'
import type {
  MiTorneitoMatch,
  MiTorneitoTournamentBundle,
  MiTorneitoTournamentRequest,
} from '@/shared/mi-torneito/types'
import {
  MI_TORNEITO_MATCH_STATUS_LABELS,
  MI_TORNEITO_REQUEST_STATUS_LABELS,
  MI_TORNEITO_STATUS_LABELS,
} from '@/shared/mi-torneito/types'
import {
  formatMiTorneitoDateTime,
  getMiTorneitoMatchLabel,
  getMiTorneitoScore,
} from '@/shared/mi-torneito/utils'

type SelectOption = {
  value: string
  label: string
}

function Field({
  label,
  name,
  value,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  name: string
  value?: string | number | null
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#90a0ae]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        required={required}
        className="hf-input h-11 w-full rounded-xl px-3 text-sm"
      />
    </label>
  )
}

function TextArea({
  label,
  name,
  value,
  rows = 3,
  placeholder,
}: {
  label: string
  name: string
  value?: string | null
  rows?: number
  placeholder?: string
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#90a0ae]">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={value ?? ''}
        rows={rows}
        placeholder={placeholder}
        className="hf-input min-h-20 w-full rounded-xl px-3 py-2 text-sm"
      />
    </label>
  )
}

function Select({
  label,
  name,
  options,
  value,
  includeEmpty,
  required,
}: {
  label: string
  name: string
  options: SelectOption[]
  value?: string | null
  includeEmpty?: string
  required?: boolean
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#90a0ae]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value ?? ''}
        required={required}
        className="hf-input h-11 w-full rounded-xl px-3 text-sm"
      >
        {includeEmpty ? <option value="">{includeEmpty}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function MiTorneitoCreateTournamentForm({
  requests,
}: {
  requests: MiTorneitoTournamentRequest[]
}) {
  const pendingRequests = requests.filter((request) => request.status !== 'approved')

  return (
    <AdminCard
      title="Crear torneo"
      description="Alta concierge: organización, torneo público y administrador delegado."
    >
      <form action={createMiTorneitoTournamentAction} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Solicitud vinculada"
            name="requestId"
            includeEmpty="Sin solicitud vinculada"
            options={pendingRequests.map((request) => ({
              value: request.id,
              label: `${request.tournamentName} - ${request.organizerEmail}`,
            }))}
          />
          <Field label="Email admin del torneo" name="adminEmail" type="email" placeholder="organizador@email.com" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Organización" name="organizationName" required placeholder="Club, liga o grupo" />
          <Field label="Ciudad organización" name="organizationCity" placeholder="Ciudad" />
          <Field label="Email contacto" name="contactEmail" type="email" placeholder="contacto@email.com" />
          <Field label="Teléfono contacto" name="contactPhone" placeholder="+54 9 ..." />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre del torneo" name="tournamentName" required placeholder="Apertura 2026" />
          <Field label="Temporada" name="season" placeholder="2026" />
          <Field label="Ciudad / zona" name="city" placeholder="Buenos Aires" />
          <Field label="Sede principal" name="venue" placeholder="Complejo deportivo" />
          <Field label="Formato" name="format" placeholder="Todos contra todos + playoff" />
          <Select
            label="Estado"
            name="status"
            value="scheduled"
            options={[
              { value: 'draft', label: MI_TORNEITO_STATUS_LABELS.draft },
              { value: 'scheduled', label: MI_TORNEITO_STATUS_LABELS.scheduled },
              { value: 'active', label: MI_TORNEITO_STATUS_LABELS.active },
              { value: 'finished', label: MI_TORNEITO_STATUS_LABELS.finished },
            ]}
          />
          <Select
            label="Visibilidad"
            name="visibility"
            value="public"
            options={[
              { value: 'public', label: 'Público' },
              { value: 'unlisted', label: 'Oculto con link' },
              { value: 'private', label: 'Privado' },
            ]}
          />
          <Field label="Inicio" name="startsOn" type="date" />
          <Field label="Fin" name="endsOn" type="date" />
        </div>
        <TextArea
          label="Descripción corta"
          name="shortDescription"
          placeholder="Texto visible en la página pública del torneo."
        />
        <button type="submit" className="hf-button h-11 rounded-xl px-4 text-sm font-black">
          Crear torneo
        </button>
      </form>
    </AdminCard>
  )
}

export function MiTorneitoRequestsTable({
  requests,
  returnPath,
}: {
  requests: MiTorneitoTournamentRequest[]
  returnPath: string
}) {
  if (!requests.length) {
    return <p className="text-sm text-[#9aa7b5]">No hay solicitudes para mostrar.</p>
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <form
          key={request.id}
          action={updateMiTorneitoRequestStatusAction}
          className="rounded-xl border border-white/8 bg-black/10 p-3"
        >
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-white">{request.tournamentName}</p>
              <p className="mt-1 text-xs text-[#9aa7b5]">
                {request.organizerName} · {request.organizerEmail}
                {request.city ? ` · ${request.city}` : ''}
              </p>
              <p className="mt-2 text-sm text-[#dce7f2]">
                {request.notes || 'Sin detalle adicional.'}
              </p>
            </div>
            <div className="grid min-w-[280px] gap-2 sm:grid-cols-[1fr_auto] lg:max-w-md">
              <select name="status" defaultValue={request.status} className="hf-input h-10 rounded-xl px-3 text-sm">
                {Object.entries(MI_TORNEITO_REQUEST_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button className="hf-button h-10 rounded-xl px-3 text-xs font-black" type="submit">
                Guardar
              </button>
              <textarea
                name="adminNotes"
                defaultValue={request.adminNotes ?? ''}
                placeholder="Nota interna"
                className="hf-input min-h-16 rounded-xl px-3 py-2 text-sm sm:col-span-2"
              />
            </div>
          </div>
        </form>
      ))}
    </div>
  )
}

function teamOptions(bundle: MiTorneitoTournamentBundle): SelectOption[] {
  return bundle.teams.map((team) => ({ value: team.id, label: team.name }))
}

function roundOptions(bundle: MiTorneitoTournamentBundle): SelectOption[] {
  return bundle.rounds.map((round) => ({ value: round.id, label: round.name }))
}

function matchResultForm({
  bundle,
  match,
  returnPath,
}: {
  bundle: MiTorneitoTournamentBundle
  match: MiTorneitoMatch
  returnPath: string
}) {
  return (
    <form key={match.id} action={saveMiTorneitoMatchResultAction} className="hf-mi-admin-match">
      <input type="hidden" name="tournamentId" value={bundle.tournament.id} />
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <div>
        <strong>{getMiTorneitoMatchLabel(match, bundle.teams)}</strong>
        <span>
          {formatMiTorneitoDateTime(match.scheduledAt)} · {getMiTorneitoScore(match)}
        </span>
      </div>
      <select name="status" defaultValue={match.status} className="hf-input h-10 rounded-xl px-3 text-sm">
        {Object.entries(MI_TORNEITO_MATCH_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <input name="homeScore" type="number" min="0" defaultValue={match.homeScore ?? ''} className="hf-input h-10 rounded-xl px-3 text-sm" placeholder="Local" />
      <input name="awayScore" type="number" min="0" defaultValue={match.awayScore ?? ''} className="hf-input h-10 rounded-xl px-3 text-sm" placeholder="Visitante" />
      <input name="minute" type="number" min="0" max="130" defaultValue={match.minute ?? ''} className="hf-input h-10 rounded-xl px-3 text-sm" placeholder="Min" />
      <button type="submit" className="hf-button h-10 rounded-xl px-3 text-xs font-black">
        Guardar
      </button>
    </form>
  )
}

export function MiTorneitoTournamentAdminPanel({
  bundle,
  returnPath,
  showSuperAdminTools = true,
}: {
  bundle: MiTorneitoTournamentBundle
  returnPath: string
  showSuperAdminTools?: boolean
}) {
  return (
    <div className="space-y-4">
      <AdminCard
        title={bundle.tournament.name}
        description={`${bundle.teams.length} equipos · ${bundle.matches.length} partidos · ${bundle.rounds.length} rondas`}
        actions={
          <Link href={`/mi-torneito/t/${bundle.tournament.slug}`} className="hf-button-secondary rounded-xl px-3 py-2 text-xs font-black">
            Ver público
          </Link>
        }
      >
        <div className="grid gap-2 sm:grid-cols-4">
          <span className="rounded-xl border border-white/8 bg-black/10 p-3 text-sm text-[#dce7f2]">
            <strong className="block text-xl text-white">{bundle.teams.length}</strong>
            Equipos
          </span>
          <span className="rounded-xl border border-white/8 bg-black/10 p-3 text-sm text-[#dce7f2]">
            <strong className="block text-xl text-white">{bundle.rounds.length}</strong>
            Rondas
          </span>
          <span className="rounded-xl border border-white/8 bg-black/10 p-3 text-sm text-[#dce7f2]">
            <strong className="block text-xl text-white">{bundle.matches.length}</strong>
            Partidos
          </span>
          <span className="rounded-xl border border-white/8 bg-black/10 p-3 text-sm text-[#dce7f2]">
            <strong className="block text-xl text-white">{bundle.standings.length}</strong>
            En tabla
          </span>
        </div>
      </AdminCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminCard title="Equipos" description="Cargá equipos con logo opcional.">
          <form action={createMiTorneitoTeamAction} className="space-y-3">
            <input type="hidden" name="tournamentId" value={bundle.tournament.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre" name="name" required />
              <Field label="Logo URL" name="logoUrl" />
              <Field label="Color principal" name="primaryColor" placeholder="#58C91F" />
              <Field label="Cancha / sede" name="homeVenue" />
              <Field label="DT / contacto" name="coachName" />
            </div>
            <button type="submit" className="hf-button h-10 rounded-xl px-3 text-xs font-black">
              Agregar equipo
            </button>
          </form>
        </AdminCard>

        <AdminCard title="Rondas" description="Fechas, grupos o fases eliminatorias.">
          <form action={createMiTorneitoRoundAction} className="space-y-3">
            <input type="hidden" name="tournamentId" value={bundle.tournament.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Nombre" name="name" required placeholder="Fecha 1" />
              <Select
                label="Fase"
                name="phase"
                value="group"
                options={[
                  { value: 'group', label: 'Grupo / liga' },
                  { value: 'knockout', label: 'Eliminatoria' },
                  { value: 'final', label: 'Final' },
                ]}
              />
              <Field label="Orden" name="sortOrder" type="number" value={bundle.rounds.length + 1} />
            </div>
            <button type="submit" className="hf-button h-10 rounded-xl px-3 text-xs font-black">
              Agregar ronda
            </button>
          </form>
        </AdminCard>
      </div>

      <AdminCard title="Partidos" description="Cargá fixture y actualizá resultados rápidos.">
        <form action={createMiTorneitoMatchAction} className="mb-4 space-y-3 rounded-xl border border-white/8 bg-black/10 p-3">
          <input type="hidden" name="tournamentId" value={bundle.tournament.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <div className="grid gap-3 md:grid-cols-3">
            <Select label="Ronda" name="roundId" includeEmpty="Sin ronda" options={roundOptions(bundle)} />
            <Select label="Local" name="homeTeamId" includeEmpty="Local a confirmar" options={teamOptions(bundle)} />
            <Select label="Visitante" name="awayTeamId" includeEmpty="Visitante a confirmar" options={teamOptions(bundle)} />
            <Field label="Fecha y hora" name="scheduledAt" type="datetime-local" />
            <Field label="Cancha" name="venue" />
            <Field label="TV / transmisión" name="broadcastLabel" placeholder="Streaming, YouTube, cancha 1" />
            <Select
              label="Estado"
              name="status"
              value="scheduled"
              options={Object.entries(MI_TORNEITO_MATCH_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>
          <TextArea label="Notas" name="notes" rows={2} />
          <button type="submit" className="hf-button h-10 rounded-xl px-3 text-xs font-black">
            Agregar partido
          </button>
        </form>

        {bundle.matches.length ? (
          <div className="space-y-2">
            {bundle.matches.map((match) => matchResultForm({ bundle, match, returnPath }))}
          </div>
        ) : (
          <p className="text-sm text-[#9aa7b5]">Todavía no hay partidos cargados.</p>
        )}
      </AdminCard>

      {showSuperAdminTools ? (
        <AdminCard title="Administradores del torneo" description="Habilitá acceso al panel del organizador.">
          <form action={assignMiTorneitoAdminAction} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input type="hidden" name="tournamentId" value={bundle.tournament.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <Field label="Email" name="email" type="email" required />
            <Select
              label="Rol"
              name="role"
              value="editor"
              options={[
                { value: 'owner', label: 'Owner' },
                { value: 'editor', label: 'Editor' },
              ]}
            />
            <div className="flex items-end">
              <button type="submit" className="hf-button h-11 rounded-xl px-4 text-sm font-black">
                Asignar
              </button>
            </div>
          </form>
          {bundle.admins?.length ? (
            <div className="mt-4 grid gap-2">
              {bundle.admins.map((admin) => (
                <div key={admin.id} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-sm text-[#dce7f2]">
                  <strong className="text-white">{admin.email}</strong> · {admin.role} · {admin.active ? 'activo' : 'inactivo'}
                </div>
              ))}
            </div>
          ) : null}
        </AdminCard>
      ) : null}
    </div>
  )
}
