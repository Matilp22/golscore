'use client'

import { useEffect, useState } from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import type { GlobalActionTeam, GlobalSearchCatalogData } from '@/shared/global-actions-data'

export type ProfileClub = Pick<GlobalActionTeam, 'id' | 'name' | 'logoUrl'>

export default function ProfileClubPicker({
  value,
  onChange,
}: {
  value: ProfileClub | null
  onChange: (team: ProfileClub | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalActionTeam[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setError('')
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/search-catalog?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('No se pudo buscar clubes.')
        const data = (await response.json()) as GlobalSearchCatalogData
        setResults(data.teams)
      } catch (caught) {
        if (controller.signal.aborted) return
        setResults([])
        setError(caught instanceof Error ? caught.message : 'No se pudo buscar clubes.')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  return (
    <section className="hf-profile-club-picker">
      <div className="hf-profile-section-heading">
        <span className="hf-type-overline">Tu escudo</span>
        <h3>Elegí el club que te representa</h3>
        <p>Puede ser de cualquier liga o país. Se usa como tu imagen dentro de Hay Fulbo.</p>
      </div>

      {value ? (
        <div className="hf-profile-selected-club">
          <TeamLogo src={value.logoUrl} team={{ id: value.id }} alt={value.name} size={48} />
          <div><strong>{value.name}</strong><span>Escudo seleccionado</span></div>
          <button type="button" onClick={() => onChange(null)}>Cambiar</button>
        </div>
      ) : null}

      <label className="hf-account-field">
        <span>Buscar club o selección</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej: River, Boca, Barcelona, Argentina…"
          autoComplete="off"
        />
      </label>

      {isLoading ? <p className="hf-profile-club-status" role="status">Buscando…</p> : null}
      {error ? <p className="hf-profile-club-status is-error" role="alert">{error}</p> : null}
      {results.length ? (
        <div className="hf-profile-club-results" role="listbox" aria-label="Clubes encontrados">
          {results.map((team) => (
            <button
              key={team.id}
              type="button"
              role="option"
              aria-selected={value?.id === team.id}
              onClick={() => {
                onChange({ id: team.id, name: team.name, logoUrl: team.logoUrl })
                setQuery('')
                setResults([])
              }}
            >
              <TeamLogo src={team.logoUrl} team={{ id: team.id }} alt="" size={34} />
              <span><strong>{team.name}</strong><small>{team.country || 'Equipo o selección'}</small></span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
