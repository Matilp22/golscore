import Link from 'next/link'
import type { ReactNode } from 'react'

function getSelectedDateParts(value: string) {
  const date = new Date(`${value}T12:00:00-03:00`)
  if (!Number.isFinite(date.getTime())) {
    return { day: '--', month: '---', weekday: value, full: value }
  }

  const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(date)
  const month = new Intl.DateTimeFormat('es-AR', { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
  const full = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

  return {
    day: String(date.getDate()).padStart(2, '0'),
    month,
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    full,
  }
}

function formatCompactDate(value: string) {
  const date = new Date(`${value}T12:00:00-03:00`)
  if (!Number.isFinite(date.getTime())) return { day: '--', month: '---' }

  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: new Intl.DateTimeFormat('es-AR', { month: 'short' })
      .format(date)
      .replace('.', '')
      .toUpperCase(),
  }
}

function shiftDate(value: string, amount: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export default function HomePulseDateBar({
  dayOptions,
  selectedDate,
  autoRefresh,
}: {
  dayOptions: Array<{ label: string; value: string }>
  selectedDate: string
  autoRefresh: ReactNode
}) {
  const selected = getSelectedDateParts(selectedDate)
  const visibleDays = dayOptions.some((day) => day.value === selectedDate)
    ? dayOptions
    : [
        { label: 'Anterior', value: shiftDate(selectedDate, -1) },
        { label: 'Elegido', value: selectedDate },
        { label: 'Siguiente', value: shiftDate(selectedDate, 1) },
      ]

  return (
    <section className="hf-stream-date" aria-labelledby="stream-date-title">
      <header>
        <div className="hf-stream-date-mark" aria-hidden="true">
          <strong>{selected.day}</strong>
          <span>{selected.month}</span>
        </div>

        <div className="hf-stream-date-copy">
          <span>Agenda</span>
          <h1 id="stream-date-title">{selected.weekday}</h1>
          <p>{selected.full}</p>
        </div>

        <form action="/" method="get" className="hf-stream-calendar">
          <label htmlFor="stream-date-picker">Elegir otra fecha</label>
          <input
            id="stream-date-picker"
            name="date"
            type="date"
            defaultValue={selectedDate}
          />
          <button type="submit">Ver</button>
        </form>
      </header>

      <nav className="hf-stream-day-jump" aria-label="Cambiar fecha">
        {visibleDays.map((day) => {
          const active = selectedDate === day.value
          const compact = formatCompactDate(day.value)

          return (
            <Link
              key={day.value}
              href={`/?date=${day.value}`}
              className={active ? 'is-active' : ''}
              aria-current={active ? 'date' : undefined}
            >
              <span>{day.label}</span>
              <strong>{compact.day}</strong>
              <small>{compact.month}</small>
            </Link>
          )
        })}
      </nav>

      <div className="hf-stream-date-refresh">{autoRefresh}</div>
    </section>
  )
}
