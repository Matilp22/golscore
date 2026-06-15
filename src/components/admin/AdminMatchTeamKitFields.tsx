'use client'

import { useState } from 'react'

type AdminMatchTeamKitFieldsProps = {
  homeTeamName?: string | null
  awayTeamName?: string | null
  homePrimaryColor?: string | null
  homeSecondaryColor?: string | null
  awayPrimaryColor?: string | null
  awaySecondaryColor?: string | null
}

type ColorControlProps = {
  label: string
  name: string
  value?: string | null
  fallback: string
}

function normalizeHexColor(value: string) {
  const cleaned = value.trim().replace(/^#/, '')

  return /^[0-9a-fA-F]{6}$/.test(cleaned) ? `#${cleaned.toLowerCase()}` : null
}

function ColorControl({ label, name, value, fallback }: ColorControlProps) {
  const [text, setText] = useState(value ?? '')
  const normalizedText = normalizeHexColor(text)
  const pickerValue = normalizedText ?? fallback

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#90a0ae]">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(event) => setText(event.target.value)}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-[#101820] p-1"
          aria-label={label}
        />
        <input
          name={name}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="#70ff9d"
          className="hf-input h-11 min-w-0 flex-1 rounded-xl px-3 text-sm"
        />
        {text ? (
          <button
            type="button"
            onClick={() => setText('')}
            className="h-11 shrink-0 rounded-xl border border-white/8 bg-black/10 px-3 text-xs font-black text-[#cbd7e3] transition hover:border-[#70ff9d]/30 hover:text-white"
          >
            Limpiar
          </button>
        ) : null}
      </div>
    </label>
  )
}

function TeamKitCard({
  title,
  primaryName,
  primaryValue,
  secondaryName,
  secondaryValue,
  primaryFallback,
  secondaryFallback,
}: {
  title: string
  primaryName: string
  primaryValue?: string | null
  secondaryName: string
  secondaryValue?: string | null
  primaryFallback: string
  secondaryFallback: string
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
      <p className="mb-3 truncate text-sm font-black text-white">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ColorControl
          label="Primario"
          name={primaryName}
          value={primaryValue}
          fallback={primaryFallback}
        />
        <ColorControl
          label="Secundario"
          name={secondaryName}
          value={secondaryValue}
          fallback={secondaryFallback}
        />
      </div>
    </div>
  )
}

export default function AdminMatchTeamKitFields({
  homeTeamName,
  awayTeamName,
  homePrimaryColor,
  homeSecondaryColor,
  awayPrimaryColor,
  awaySecondaryColor,
}: AdminMatchTeamKitFieldsProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <TeamKitCard
        title={`Local - ${homeTeamName || 'Sin equipo'}`}
        primaryName="homePrimaryColor"
        primaryValue={homePrimaryColor}
        secondaryName="homeSecondaryColor"
        secondaryValue={homeSecondaryColor}
        primaryFallback="#14532d"
        secondaryFallback="#2563eb"
      />
      <TeamKitCard
        title={`Visitante - ${awayTeamName || 'Sin equipo'}`}
        primaryName="awayPrimaryColor"
        primaryValue={awayPrimaryColor}
        secondaryName="awaySecondaryColor"
        secondaryValue={awaySecondaryColor}
        primaryFallback="#f3f4f6"
        secondaryFallback="#9ca3af"
      />
    </div>
  )
}
