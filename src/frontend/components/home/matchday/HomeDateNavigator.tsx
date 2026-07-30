import Link from 'next/link'
import type { ReactNode } from 'react'

function formatSelectedDate(value: string) {
  const date = new Date(`${value}T12:00:00-03:00`)
  if (!Number.isFinite(date.getTime())) return value

  const label = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)

  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function HomeDateNavigator({
  dayOptions,
  selectedDate,
  autoRefresh,
}: {
  dayOptions: Array<{ label: string; value: string }>
  selectedDate: string
  autoRefresh: ReactNode
}) {
  return (
    <section className="hf-matchday-date-card" aria-labelledby="home-date-title">
      <div className="hf-matchday-date-heading">
        <div>
          <span className="hf-type-overline">Agenda del día</span>
          <h1 id="home-date-title">{formatSelectedDate(selectedDate)}</h1>
        </div>
        <div className="hf-matchday-refresh">{autoRefresh}</div>
      </div>

      <nav className="hf-matchday-day-switcher" aria-label="Cambiar fecha">
        {dayOptions.map((day) => {
          const active = selectedDate === day.value

          return (
            <Link
              key={day.value}
              href={`/?date=${day.value}`}
              className={active ? 'is-active' : ''}
              aria-current={active ? 'date' : undefined}
            >
              <span>{day.label}</span>
              <time dateTime={day.value}>
                {new Intl.DateTimeFormat('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                }).format(new Date(`${day.value}T12:00:00-03:00`))}
              </time>
            </Link>
          )
        })}
      </nav>

      <form action="/" method="get" className="hf-matchday-date-picker">
        <label htmlFor="home-date-picker">Ir a otra fecha</label>
        <div>
          <input
            id="home-date-picker"
            name="date"
            type="date"
            defaultValue={selectedDate}
          />
          <button type="submit">Ver jornada</button>
        </div>
      </form>
    </section>
  )
}
