'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import {
  GUESS_PLAYER_POOLS,
  type GuessLevel,
  type GuessPlayer,
} from '@/shared/config/guess-player-data'
import styles from './GuessThePlayerGame.module.css'
import updateStyles from './GuessThePlayerGameUpdate.module.css'

const ROUND_SIZE = 10
const PLAYER_STARTING_POINTS = 1000
const EXTRA_CLUE_COST = 50
const HISTORY_KEY = 'hf-guess-player-history-v1'

const LEVELS: Array<{
  key: GuessLevel
  label: string
  eyebrow: string
  description: string
  clues: string
}> = [
  { key: 'facil', label: 'Fácil', eyebrow: 'Para entrar en calor', description: 'Las figuras más famosas del planeta.', clues: 'Club de debut + pistas' },
  { key: 'intermedio', label: 'Intermedio', eyebrow: 'Para futboleros', description: 'Nombres conocidos, con menos margen.', clues: 'Club de debut + pistas' },
  { key: 'avanzado', label: 'Avanzado', eyebrow: 'Para enfermos del fútbol', description: 'Figuras históricas para conocedores.', clues: 'Club de debut + pistas' },
]

type GameStatus = 'playing' | 'correct' | 'revealed' | 'finished'
type ExtraClue = 'nationality' | 'age' | 'position'

function startingTeamClues(level: GuessLevel) {
  if (level === 'facil') return 3
  if (level === 'intermedio') return 2
  return 1
}

function startingExtraClues(level: GuessLevel): ExtraClue[] {
  return level === 'avanzado'
    ? ['nationality', 'age', 'position']
    : []
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function getPlayerSurname(name: string) {
  const cleanedName = name.replace(/\b(jr\.?|junior)\b/gi, '').trim()
  const parts = cleanedName.split(/\s+/)

  if (normalize(cleanedName) === normalize('Son Heung-min')) return 'Son'
  if (parts.length === 1) return cleanedName

  const lastName = parts.at(-1) || cleanedName
  const previousPart = parts.at(-2)?.toLowerCase()
  return previousPart && ['da', 'de', 'del', 'di', 'dos', 'van', 'von'].includes(previousPart)
    ? `${parts.at(-2)} ${lastName}`
    : lastName
}

const SURNAME_PLAYER_IDS = Object.values(GUESS_PLAYER_POOLS)
  .flat()
  .reduce<Map<string, Set<string>>>((surnameMap, candidate) => {
    const surname = normalize(getPlayerSurname(candidate.name))
    const playerIds = surnameMap.get(surname) || new Set<string>()
    playerIds.add(candidate.id)
    surnameMap.set(surname, playerIds)
    return surnameMap
  }, new Map())

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function createRound(level: GuessLevel): GuessPlayer[] {
  const pool = GUESS_PLAYER_POOLS[level]
  let recent: string[] = []
  try {
    recent = JSON.parse(localStorage.getItem(`${HISTORY_KEY}-${level}`) || '[]')
  } catch {}
  const fresh = pool.filter((item) => !recent.includes(item.id))
  const selected = shuffle(fresh.length >= ROUND_SIZE ? fresh : pool).slice(0, ROUND_SIZE)
  localStorage.setItem(`${HISTORY_KEY}-${level}`, JSON.stringify([...selected.map((item) => item.id), ...recent].slice(0, 30)))
  return selected
}

function ClubCrest({
  name,
  index,
  logoUrl,
}: {
  name: string
  index: number
  logoUrl?: string | null
}) {
  return (
    <div className={`${styles.crestWrap} ${updateStyles.crestWrap}`} style={{ '--delay': `${index * 90}ms` } as React.CSSProperties}>
      <span className={`${styles.crest} ${updateStyles.crest}`}>
        <TeamLogo
          src={logoUrl}
          alt={`Escudo de ${name}`}
          size={62}
          className="h-full w-full object-contain"
        />
      </span>
      <span className={`${styles.clubName} ${updateStyles.clubName}`}>{name}</span>
      {index === 0 ? <small>DEBUT</small> : null}
    </div>
  )
}

export default function GuessThePlayerGame({
  clubLogos,
}: {
  clubLogos: Record<string, string | null>
}) {
  const [level, setLevel] = useState<GuessLevel | null>(null)
  const [round, setRound] = useState<GuessPlayer[]>([])
  const [current, setCurrent] = useState(0)
  const [extraClues, setExtraClues] = useState<ExtraClue[]>([])
  const [teamCluesShown, setTeamCluesShown] = useState(3)
  const [answer, setAnswer] = useState('')
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [playerPoints, setPlayerPoints] = useState(PLAYER_STARTING_POINTS)
  const [status, setStatus] = useState<GameStatus>('playing')
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const player = round[current]

  useEffect(() => {
    if (status === 'playing') inputRef.current?.focus()
  }, [current, status, extraClues])

  const visibleTeams = useMemo(() => {
    if (!player) return []
    return player.teams.slice(0, teamCluesShown)
  }, [player, teamCluesShown])

  function startGame(nextLevel: GuessLevel) {
    setLevel(nextLevel)
    setRound(createRound(nextLevel))
    setCurrent(0)
    setExtraClues(startingExtraClues(nextLevel))
    setTeamCluesShown(startingTeamClues(nextLevel))
    setAnswer('')
    setScore(0)
    setCorrectCount(0)
    setPlayerPoints(PLAYER_STARTING_POINTS)
    setMessage('')
    setStatus('playing')
  }

  function submitAnswer(event: React.FormEvent) {
    event.preventDefault()
    if (!player || !answer.trim() || status !== 'playing') return
    const normalizedAnswer = normalize(answer)
    const normalizedSurname = normalize(getPlayerSurname(player.name))
    const surnameIsUnique = SURNAME_PLAYER_IDS.get(normalizedSurname)?.size === 1
    const matchesFullName = [player.name, ...(player.aliases || [])].some(
      (name) => normalize(name) === normalizedAnswer
    )
    const matchesUniqueSurname =
      surnameIsUnique && normalizedSurname === normalizedAnswer
    const accepted = matchesFullName || matchesUniqueSurname

    if (accepted) {
      const points = playerPoints
      setScore((value) => value + points)
      setCorrectCount((value) => value + 1)
      setMessage(`¡Golazo! +${points} puntos`)
      setStatus('correct')
    } else if (
      normalizedSurname === normalizedAnswer &&
      !surnameIsUnique
    ) {
      setMessage(`Hay más de un ${getPlayerSurname(player.name)}. Escribí el nombre completo.`)
    } else {
      setMessage('No es ese. Probá otra vez o pedí una pista.')
    }
  }

  function revealClue(clue: ExtraClue) {
    if (extraClues.includes(clue) || status !== 'playing') return
    setExtraClues((value) => [...value, clue])
    setPlayerPoints((value) => Math.max(100, value - EXTRA_CLUE_COST))
    setMessage(`Pista revelada: −${EXTRA_CLUE_COST} puntos`)
  }

  function revealAnotherTeam() {
    if (!player || teamCluesShown >= player.teams.length) return
    setTeamCluesShown((value) => value + 1)
    setPlayerPoints((value) => Math.max(100, value - EXTRA_CLUE_COST))
    setMessage(`Nuevo equipo revelado: −${EXTRA_CLUE_COST} puntos`)
  }

  function revealPlayer() {
    setMessage(`Era ${player.name}`)
    setStatus('revealed')
  }

  function nextPlayer() {
    if (!level) return
    if (current === ROUND_SIZE - 1) {
      setStatus('finished')
      return
    }
    setCurrent((value) => value + 1)
    setExtraClues(startingExtraClues(level))
    setTeamCluesShown(startingTeamClues(level))
    setPlayerPoints(PLAYER_STARTING_POINTS)
    setAnswer('')
    setMessage('')
    setStatus('playing')
  }

  if (!level) {
    return (
      <main className={`${styles.page} ${updateStyles.page}`}>
        <section className={`${styles.hero} ${updateStyles.hero}`}>
          <div className={`${styles.heroBall} ${updateStyles.heroBall}`} aria-hidden="true">?</div>
          <p>HAY FULBO PRESENTA</p>
          <h1>¿Quién es el<br /><em>futbolista?</em></h1>
          <span>Leé su carrera. Confiá en tu memoria. Escribí el nombre.</span>
        </section>
        <section className={`${styles.levelSection} ${updateStyles.levelSection}`}>
          <div className={styles.sectionHeading}><h2>Elegí tu cancha</h2><p>10 jugadores por partida</p></div>
          <div className={`${styles.levelGrid} ${updateStyles.levelGrid}`}>
            {LEVELS.map((item) => (
              <button key={item.key} type="button" className={`${styles.levelCard} ${updateStyles.levelCard}`} onClick={() => startGame(item.key)}>
                <small>{item.eyebrow}</small>
                <h3>{item.label}</h3>
                <p>{item.description}</p>
                <div><b>{item.clues}</b><span>JUGAR →</span></div>
              </button>
            ))}
          </div>
          <p className={styles.poolNote}><b>150 futbolistas</b> en rotación · No vas a jugar siempre con los mismos</p>
        </section>
      </main>
    )
  }

  if (status === 'finished') {
    return (
      <main className={`${styles.page} ${updateStyles.page} ${styles.resultPage} ${updateStyles.resultPage}`}>
        <section className={`${styles.resultCard} ${updateStyles.resultCard}`}>
          <span className={`${styles.resultKicker} ${updateStyles.resultKicker}`}>FINAL DEL PARTIDO</span>
          <div className={`${styles.resultScore} ${updateStyles.resultScore}`}>{score.toLocaleString('es-AR')}</div>
          <p>PUNTOS</p>
          <h1>{score >= 3500 ? 'Clase mundial.' : score >= 1800 ? 'Sabés de fútbol.' : 'Hay que mirar más fulbo.'}</h1>
          <span>Completaste los 10 futbolistas del nivel {level}. Aciertos: {correctCount}/10.</span>
          <div className={updateStyles.knowledgeRank}>
            <small>TU CATEGORÍA</small>
            <strong>
              {score >= 8500
                ? 'Enciclopedia del fútbol'
                : score >= 6500
                  ? 'Conocedor de fútbol'
                  : score >= 4000
                    ? 'Futbolero de primera'
                    : score >= 2000
                      ? 'Hincha de tribuna'
                      : 'Recién llegado al vestuario'}
            </strong>
          </div>
          <div className={`${styles.resultActions} ${updateStyles.resultActions}`}>
            <button type="button" onClick={() => startGame(level)}>Jugar otra partida</button>
            <button type="button" onClick={() => setLevel(null)}>Cambiar nivel</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={`${styles.gamePage} ${updateStyles.gamePage}`}>
      <header className={`${styles.gameHeader} ${updateStyles.gameHeader}`}>
        <button type="button" onClick={() => setLevel(null)}>← Niveles</button>
        <div className={styles.progressMeta}><b>{current + 1}</b><span>/ {ROUND_SIZE}</span></div>
        <div><small>PUNTOS</small><strong>{score.toLocaleString('es-AR')}</strong></div>
      </header>
      <div className={`${styles.progress} ${updateStyles.progress}`}><span style={{ width: `${((current + 1) / ROUND_SIZE) * 100}%` }} /></div>
      <section className={`${styles.gameBoard} ${updateStyles.gameBoard}`}>
        <aside className={`${styles.boardIntro} ${updateStyles.boardIntro}`}>
          <span className={`${styles.levelPill} ${updateStyles.levelPill}`}>NIVEL {level.toUpperCase()}</span>
          <p>JUGADOR ACTUAL</p>
          <h1>Seguí<br />las <em>pistas.</em></h1>
          <small>Los clubes aparecen en orden cronológico. El primero siempre es donde debutó.</small>
        </aside>
        <div className={`${styles.cluePanel} ${updateStyles.cluePanel}`}>
          <div className={styles.clueTitle}><span>EQUIPOS REVELADOS</span><b>{playerPoints} PTS EN JUEGO</b></div>
          <div
            key={`clubs-${player.id}`}
            className={`${styles.clues} ${updateStyles.clues}`}
          >
            {visibleTeams.map((team, index) => (
              <ClubCrest
                key={`${player.id}-${team}`}
                name={team}
                index={index}
                logoUrl={clubLogos[team]}
              />
            ))}
          </div>
          <div
            key={`facts-${player.id}`}
            className={updateStyles.extraClues}
          >
            {extraClues.includes('nationality') ? <div className={styles.fact}><small>Nacionalidad</small><strong>{player.nationality}</strong></div> : null}
            {extraClues.includes('age') ? <div className={styles.fact}><small>Edad</small><strong>{player.age} años</strong></div> : null}
            {extraClues.includes('position') ? <div className={styles.fact}><small>Posición</small><strong>{player.position}</strong></div> : null}
          </div>
          {status === 'playing' ? (
            <>
              <form className={`${styles.answerForm} ${updateStyles.answerForm}`} onSubmit={submitAnswer}>
                <label htmlFor="player-answer">¿Quién es?</label>
                <div><input ref={inputRef} id="player-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Nombre del futbolista…" autoComplete="off" /><button type="submit">PROBAR</button></div>
              </form>
              <p className={`${styles.feedback} ${updateStyles.feedback}`} aria-live="polite">{message}</p>
              <div className={`${styles.clueActions} ${updateStyles.clueActions}`}>
                <div className={updateStyles.hintButtons}>
                  <span>PEDIR PISTA (−{EXTRA_CLUE_COST})</span>
                  {teamCluesShown < player.teams.length ? (
                    <button
                      type="button"
                      onClick={revealAnotherTeam}
                    >
                      Otro equipo
                    </button>
                  ) : null}
                  <button type="button" onClick={() => revealClue('nationality')} disabled={extraClues.includes('nationality')}>Nacionalidad</button>
                  <button type="button" onClick={() => revealClue('age')} disabled={extraClues.includes('age')}>Edad</button>
                  <button type="button" onClick={() => revealClue('position')} disabled={extraClues.includes('position')}>Posición</button>
                </div>
                <button type="button" onClick={revealPlayer}>Me rindo</button>
              </div>
            </>
          ) : (
            <div className={`${styles.revealBox} ${updateStyles.revealBox}`}>
              <small>{status === 'correct' ? 'RESPUESTA CORRECTA' : 'EL FUTBOLISTA ERA'}</small>
              <strong>{player.name}</strong>
              <p>{message}</p>
              <button type="button" onClick={nextPlayer}>{current === ROUND_SIZE - 1 ? 'VER RESULTADO' : 'SIGUIENTE JUGADOR'} →</button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
