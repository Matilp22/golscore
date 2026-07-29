import { classNames } from '@/frontend/components/ui/classNames'

type ScoreProps = {
  home: number | null | undefined
  away: number | null | undefined
  homeTeam: string
  awayTeam: string
  homePenalties?: number | null
  awayPenalties?: number | null
  aggregateLabel?: string | null
  className?: string
}

function displayValue(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : '—'
}

export default function Score({
  home,
  away,
  homeTeam,
  awayTeam,
  homePenalties,
  awayPenalties,
  aggregateLabel,
  className,
}: ScoreProps) {
  const hasPenalties =
    typeof homePenalties === 'number' && typeof awayPenalties === 'number'
  const accessibleScore = `${homeTeam} ${displayValue(home)}, ${awayTeam} ${displayValue(away)}`
  const penalties = hasPenalties
    ? `. Penales ${homePenalties} a ${awayPenalties}`
    : ''
  const aggregate = aggregateLabel ? `. ${aggregateLabel}` : ''

  return (
    <span
      className={classNames('hf-sport-score', className)}
      aria-label={`${accessibleScore}${penalties}${aggregate}`}
    >
      <span>{displayValue(home)}</span>
      <span aria-hidden="true">:</span>
      <span>{displayValue(away)}</span>
      {hasPenalties ? (
        <small>
          Pen. {homePenalties}–{awayPenalties}
        </small>
      ) : null}
      {aggregateLabel ? <small>{aggregateLabel}</small> : null}
    </span>
  )
}
