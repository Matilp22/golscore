'use client'

import { useMemo, useState } from 'react'

type BroadcastOption = {
  name: string
  logoUrl: string | null
}

type AdminMatchBroadcastFieldsProps = {
  tv?: string | null
  broadcastLogoUrl?: string | null
  options: BroadcastOption[]
}

const OPTION_ALIASES: Record<string, string[]> = {
  'TyC Sports': ['tyc sports', 'tyc', 'tyc sports play'],
  'D Sports': ['d sports', 'dsports', 'directv sports', 'directv'],
  'Fox Sports': ['fox sports', 'foxsports'],
  ESPN: ['espn', 'espn premium'],
  Telefe: ['telefe'],
}

function normalizeOption(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findOption(value: string, options: BroadcastOption[]) {
  const normalized = normalizeOption(value)
  if (!normalized) return null

  return (
    options.find((option) => normalizeOption(option.name) === normalized) ??
    options.find((option) => {
      const aliases = OPTION_ALIASES[option.name] ?? []

      return aliases.some((alias) => {
        const normalizedAlias = normalizeOption(alias)

        return normalizedAlias === normalized || normalized.includes(normalizedAlias)
      })
    }) ??
    null
  )
}

export default function AdminMatchBroadcastFields({
  tv,
  broadcastLogoUrl,
  options,
}: AdminMatchBroadcastFieldsProps) {
  const [selectedTv, setSelectedTv] = useState(tv ?? '')
  const [logoUrl, setLogoUrl] = useState(broadcastLogoUrl ?? '')
  const dataListId = 'admin-match-tv-options'
  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [options]
  )
  const selectedOption = findOption(selectedTv, sortedOptions)
  const savedLogoUrl = selectedOption?.logoUrl ?? null

  function handleTvChange(value: string) {
    setSelectedTv(value)

    const match = findOption(value, sortedOptions)
    if (match?.logoUrl) {
      setLogoUrl(match.logoUrl)
    }
  }

  function useSavedLogo() {
    if (savedLogoUrl) setLogoUrl(savedLogoUrl)
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="block min-w-0">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#90a0ae]">
          TV
        </span>
        <input
          name="tv"
          list={dataListId}
          value={selectedTv}
          onChange={(event) => handleTvChange(event.target.value)}
          placeholder="TyC Sports / ESPN / Telefe..."
          className="hf-input h-11 w-full rounded-xl px-3 text-sm"
        />
        <datalist id={dataListId}>
          {sortedOptions.map((option) => (
            <option key={option.name} value={option.name} />
          ))}
        </datalist>
        {savedLogoUrl ? (
          <button
            type="button"
            onClick={useSavedLogo}
            className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-[#25553d] bg-[#123022] px-2.5 text-xs font-black text-[#7ff0b2] transition hover:border-[#7ff0b2]/50"
          >
            Usar logo guardado
          </button>
        ) : null}
      </label>

      <label className="block min-w-0">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#90a0ae]">
          Logo TV
        </span>
        <textarea
          name="broadcastLogoUrl"
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
          placeholder="https://..."
          rows={2}
          className="hf-input min-h-20 w-full rounded-xl px-3 py-2 text-sm"
        />
      </label>
    </div>
  )
}
