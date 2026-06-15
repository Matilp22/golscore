'use client'

import { useState } from 'react'

type AdminMatchTeamKitFieldsProps = {
  homeTeamName?: string | null
  awayTeamName?: string | null
  homePrimaryColor?: string | null
  homeSecondaryColor?: string | null
  homeNumberColor?: string | null
  homeGoalkeeperPrimaryColor?: string | null
  homeGoalkeeperSecondaryColor?: string | null
  homeGoalkeeperNumberColor?: string | null
  awayPrimaryColor?: string | null
  awaySecondaryColor?: string | null
  awayNumberColor?: string | null
  awayGoalkeeperPrimaryColor?: string | null
  awayGoalkeeperSecondaryColor?: string | null
  awayGoalkeeperNumberColor?: string | null
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
  numberName,
  numberValue,
  goalkeeperPrimaryName,
  goalkeeperPrimaryValue,
  goalkeeperSecondaryName,
  goalkeeperSecondaryValue,
  goalkeeperNumberName,
  goalkeeperNumberValue,
  primaryFallback,
  secondaryFallback,
  numberFallback,
  goalkeeperPrimaryFallback,
  goalkeeperSecondaryFallback,
  goalkeeperNumberFallback,
}: {
  title: string
  primaryName: string
  primaryValue?: string | null
  secondaryName: string
  secondaryValue?: string | null
  numberName: string
  numberValue?: string | null
  goalkeeperPrimaryName: string
  goalkeeperPrimaryValue?: string | null
  goalkeeperSecondaryName: string
  goalkeeperSecondaryValue?: string | null
  goalkeeperNumberName: string
  goalkeeperNumberValue?: string | null
  primaryFallback: string
  secondaryFallback: string
  numberFallback: string
  goalkeeperPrimaryFallback: string
  goalkeeperSecondaryFallback: string
  goalkeeperNumberFallback: string
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
      <p className="mb-3 truncate text-sm font-black text-white">{title}</p>
      <div className="mb-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
        Jugadores
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ColorControl
          label="Camiseta"
          name={primaryName}
          value={primaryValue}
          fallback={primaryFallback}
        />
        <ColorControl
          label="Detalle"
          name={secondaryName}
          value={secondaryValue}
          fallback={secondaryFallback}
        />
        <ColorControl
          label="Numero"
          name={numberName}
          value={numberValue}
          fallback={numberFallback}
        />
      </div>

      <div className="mb-3 mt-4 text-[11px] font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
        Arquero
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ColorControl
          label="Camiseta"
          name={goalkeeperPrimaryName}
          value={goalkeeperPrimaryValue}
          fallback={goalkeeperPrimaryFallback}
        />
        <ColorControl
          label="Detalle"
          name={goalkeeperSecondaryName}
          value={goalkeeperSecondaryValue}
          fallback={goalkeeperSecondaryFallback}
        />
        <ColorControl
          label="Numero"
          name={goalkeeperNumberName}
          value={goalkeeperNumberValue}
          fallback={goalkeeperNumberFallback}
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
  homeNumberColor,
  homeGoalkeeperPrimaryColor,
  homeGoalkeeperSecondaryColor,
  homeGoalkeeperNumberColor,
  awayPrimaryColor,
  awaySecondaryColor,
  awayNumberColor,
  awayGoalkeeperPrimaryColor,
  awayGoalkeeperSecondaryColor,
  awayGoalkeeperNumberColor,
}: AdminMatchTeamKitFieldsProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <TeamKitCard
        title={`Local - ${homeTeamName || 'Sin equipo'}`}
        primaryName="homePrimaryColor"
        primaryValue={homePrimaryColor}
        secondaryName="homeSecondaryColor"
        secondaryValue={homeSecondaryColor}
        numberName="homeNumberColor"
        numberValue={homeNumberColor}
        goalkeeperPrimaryName="homeGoalkeeperPrimaryColor"
        goalkeeperPrimaryValue={homeGoalkeeperPrimaryColor}
        goalkeeperSecondaryName="homeGoalkeeperSecondaryColor"
        goalkeeperSecondaryValue={homeGoalkeeperSecondaryColor}
        goalkeeperNumberName="homeGoalkeeperNumberColor"
        goalkeeperNumberValue={homeGoalkeeperNumberColor}
        primaryFallback="#14532d"
        secondaryFallback="#2563eb"
        numberFallback="#ffffff"
        goalkeeperPrimaryFallback="#f59e0b"
        goalkeeperSecondaryFallback="#111827"
        goalkeeperNumberFallback="#111827"
      />
      <TeamKitCard
        title={`Visitante - ${awayTeamName || 'Sin equipo'}`}
        primaryName="awayPrimaryColor"
        primaryValue={awayPrimaryColor}
        secondaryName="awaySecondaryColor"
        secondaryValue={awaySecondaryColor}
        numberName="awayNumberColor"
        numberValue={awayNumberColor}
        goalkeeperPrimaryName="awayGoalkeeperPrimaryColor"
        goalkeeperPrimaryValue={awayGoalkeeperPrimaryColor}
        goalkeeperSecondaryName="awayGoalkeeperSecondaryColor"
        goalkeeperSecondaryValue={awayGoalkeeperSecondaryColor}
        goalkeeperNumberName="awayGoalkeeperNumberColor"
        goalkeeperNumberValue={awayGoalkeeperNumberColor}
        primaryFallback="#f3f4f6"
        secondaryFallback="#9ca3af"
        numberFallback="#111827"
        goalkeeperPrimaryFallback="#38bdf8"
        goalkeeperSecondaryFallback="#0f172a"
        goalkeeperNumberFallback="#0f172a"
      />
    </div>
  )
}
