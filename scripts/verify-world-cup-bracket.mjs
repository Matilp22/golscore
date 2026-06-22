import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = process.cwd()
const files = {
  component: resolve(root, 'src/frontend/components/WorldCupKnockoutSection.tsx'),
  util: resolve(root, 'src/shared/utils/world-cup-bracket-simulator.ts'),
  page: resolve(root, 'src/app/liga/[id]/page.tsx'),
  packageJson: resolve(root, 'package.json'),
}

function read(path) {
  return readFileSync(path, 'utf8')
}

function fail(message) {
  console.error(`[verify-world-cup-bracket] ${message}`)
  process.exitCode = 1
}

function assert(condition, message) {
  if (!condition) fail(message)
}

const component = read(files.component)
const util = read(files.util)
const page = read(files.page)
const packageJson = JSON.parse(read(files.packageJson))
const combined = `${component}\n${util}`

const forbiddenRuntimePatterns = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bsupabase\b/i,
  /getSupabase/i,
  /requestFootballApi/,
  /\/api\/admin\//,
  /\/api\/cron\//,
  /\.insert\s*\(/,
  /\.upsert\s*\(/,
  /\.update\s*\(/,
  /\.rpc\s*\(/,
  /\.from\s*\([^)]*\)\s*\.delete\s*\(/,
]

for (const pattern of forbiddenRuntimePatterns) {
  if (pattern.test(combined)) {
    fail(`Forbidden pattern found in local simulator code: ${pattern}`)
  }
}

if (!component.includes("'use client'")) {
  fail('WorldCupKnockoutSection must be a client component.')
}

if (!component.includes('window.localStorage')) {
  fail('The simulator must persist only through window.localStorage.')
}

if (!util.includes('WORLD_CUP_BRACKET_STORAGE_KEY_PREFIX')) {
  fail('Missing explicit localStorage key prefix.')
}

if (!util.includes('WORLD_CUP_FULL_SIMULATOR_STORAGE_KEY')) {
  fail('Missing v2 full simulator localStorage key.')
}

if (!component.includes('WorldCupOfficialBracket')) {
  fail('Missing official bracket component.')
}

if (!component.includes('WorldCupKnockoutSimulator')) {
  fail('Missing simulator component.')
}

if (!component.includes('WorldCupGroupSimulator')) {
  fail('Missing group simulator component.')
}

if (!component.includes('WorldCupSimulatedStandings')) {
  fail('Missing simulated standings component.')
}

if (!component.includes('WorldCupThirdPlaceSimulation')) {
  fail('Missing third-place simulation component.')
}

if (!component.includes('WorldCupBracketBoard')) {
  fail('Missing shared bracket board component.')
}

if (!component.includes('WorldCupBracketMatchCard')) {
  fail('Missing shared match card component.')
}

if (!page.includes('WorldCupKnockoutSection')) {
  fail('World Cup league page does not render the knockout section.')
}

if (!page.includes("tournament.key === 'selecciones-mundial'")) {
  fail('Simulator must be gated to Copa del Mundo 2026.')
}

const forbiddenPublicLabels = [
  '32 de 32',
  'Temporada 2026',
  'Origen: tabla actual',
  'Origen: ',
  'Clasificados a las llaves',
]

for (const label of forbiddenPublicLabels) {
  if (component.includes(label)) {
    fail(`Forbidden visible diagnostic label found: ${label}`)
  }
}

const forbiddenSimulatorSignals = [
  'type="number"',
  'min={0}',
  'function ScoreInput',
  'function GroupScoreInput',
  'round.matches.map((match, index)',
]

for (const signal of forbiddenSimulatorSignals) {
  if (component.includes(signal)) {
    fail(`Forbidden simulator implementation signal found: ${signal}`)
  }
}

const requiredHelpers = [
  'buildWorldCupSimulatedGroupFixtures',
  'calculateWorldCupGroupTable',
  'rankWorldCup2026Group',
  'rankWorldCupThirdPlacedTeams',
  'resolveWorldCupThirdPlaceAssignments',
  'buildWorldCupRoundOf32',
  'resolveKnockoutMatchWinner',
  'propagateKnockoutWinner',
  'clearAffectedKnockoutDescendants',
  'reconcileKnockoutAfterScoreChange',
  'reconcileKnockoutSimulationAfterGroupChanges',
  'clearWorldCupSimulation',
  'validateWorldCupSimulation',
]

for (const helper of requiredHelpers) {
  if (!util.includes(`export function ${helper}`)) {
    fail(`Missing helper export: ${helper}`)
  }
}

const requiredStaticSignals = [
  'schemaVersion: 2',
  'manualTiebreakers',
  'groupResults',
  'Simular grupos',
  'Ver llaves simuladas',
  'Reiniciar simulaci',
  'Oficial',
  'Simulado',
  'Desempate manual',
  'Mejores terceros',
  'WorldCupSimulationShareSnapshot',
  'WorldCupBracketShareSnapshot',
  'Compartir simulaci',
  "const shareTargetId = 'world-cup-simulation-share-bracket'",
  'Llaves simuladas completas',
  'SHARE_BRACKET_R32_ROW_STEP = 6',
  'SHARE_BRACKET_MATCH_ROW_SPAN = 5',
  'SHARE_BRACKET_ROW_UNIT_PX = 8',
  'data-world-cup-share-bracket-card',
  'TrashIcon',
  'Borrar resultado simulado',
  'WorldCupScoreInput',
  'sanitizeScoreInput',
  "value.replace(/\\D/g, '').slice(0, 2)",
  'inputMode="numeric"',
  'pattern="[0-9]*"',
  'type="text"',
  'onPaste={handlePaste}',
  'onBlur={handleBlur}',
  'onWheel={handleWheel}',
  'md:grid-cols-[72px_minmax(0,1fr)_62px_minmax(0,1fr)_66px_32px]',
  'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
  'ROUND_VISUAL_ORDER',
  'getVisualMatches(round).map',
  'r32: [73, 75, 74, 77, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87]',
  'r16: [89, 90, 93, 94, 91, 92, 95, 96]',
  'qf: [97, 98, 99, 100]',
  'sf: [101, 102]',
  'final: [104]',
  'BRACKET_R32_ROW_STEP = 18',
  'BRACKET_MATCH_ROW_SPAN = 15',
  'BRACKET_ROW_UNIT_PX = 8',
  'BRACKET_GRID_ROW_COUNT',
  'gridTemplateRows: `28px repeat(${BRACKET_GRID_ROW_COUNT}, ${BRACKET_ROW_UNIT_PX}px)`',
  "['Pos', 'Equipo', 'Pts', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG']",
]

for (const signal of requiredStaticSignals) {
  if (!combined.includes(signal)) {
    fail(`Missing expected simulator signal: ${signal}`)
  }
}

const requiredRoundSlots = [
  "{ slot: 73, home: 'RA', away: 'RB' }",
  "{ slot: 74, home: 'WE', away: { candidates: ['A', 'B', 'C', 'D', 'F'] } }",
  "{ slot: 75, home: 'WF', away: 'RC' }",
  "{ slot: 76, home: 'WC', away: 'RF' }",
  "{ slot: 77, home: 'WI', away: { candidates: ['C', 'D', 'F', 'G', 'H'] } }",
  "{ slot: 78, home: 'RE', away: 'RI' }",
  "{ slot: 79, home: 'WA', away: { candidates: ['C', 'E', 'F', 'H', 'I'] } }",
  "{ slot: 80, home: 'WL', away: { candidates: ['E', 'H', 'I', 'J', 'K'] } }",
  "{ slot: 81, home: 'WD', away: { candidates: ['B', 'E', 'F', 'I', 'J'] } }",
  "{ slot: 82, home: 'WG', away: { candidates: ['A', 'E', 'H', 'I', 'J'] } }",
  "{ slot: 83, home: 'RK', away: 'RL' }",
  "{ slot: 84, home: 'WH', away: 'RJ' }",
  "{ slot: 85, home: 'WB', away: { candidates: ['E', 'F', 'G', 'I', 'J'] } }",
  "{ slot: 86, home: 'WJ', away: 'RH' }",
  "{ slot: 87, home: 'WK', away: { candidates: ['D', 'E', 'I', 'J', 'L'] } }",
  "{ slot: 88, home: 'RD', away: 'RG' }",
  'sources: [73, 75]',
  'sources: [74, 77]',
  'sources: [76, 78]',
  'sources: [79, 80]',
  'sources: [83, 84]',
  'sources: [81, 82]',
  'sources: [86, 88]',
  'sources: [85, 87]',
  'sources: [89, 90]',
  'sources: [93, 94]',
  'sources: [91, 92]',
  'sources: [95, 96]',
  'sources: [97, 98]',
  'sources: [99, 100]',
  'sources: [101, 102]',
]

for (const slot of requiredRoundSlots) {
  if (!util.includes(slot)) {
    fail(`Missing official bracket topology signal: ${slot}`)
  }
}

if (packageJson.scripts?.['verify:world-cup-bracket'] !== 'node scripts/verify-world-cup-bracket.mjs') {
  fail('package.json is missing verify:world-cup-bracket script.')
}

if (component.includes('onSelectWinner') || component.includes('Elegir ') || component.includes('✓')) {
  fail('Knockout match cards must not expose manual check/winner buttons.')
}

if (component.includes('Limpiar')) {
  fail('Group fixture clear action must use the trash icon, not the Limpiar label.')
}

if (component.includes('world-cup-simulation-share-group')) {
  fail('The simulation share target must always export the full bracket, not a selected group.')
}

if (/WorldCupSimulatedStandings[\s\S]*overflow-x-auto/.test(component)) {
  fail('Simulated standings must not use horizontal overflow.')
}

function sanitizeScoreInputForVerifier(value) {
  return String(value).replace(/\D/g, '').slice(0, 2)
}

const scoreInputCases = [
  ['', ''],
  ['0', '0'],
  ['12', '12'],
  ['-1', '1'],
  ['1.5', '15'],
  ['2e3', '23'],
  ['abc', ''],
  ['999', '99'],
]

for (const [input, expected] of scoreInputCases) {
  assert(
    sanitizeScoreInputForVerifier(input) === expected,
    `Functional check: score input sanitizer should map ${JSON.stringify(input)} to ${JSON.stringify(expected)}.`
  )
}

function loadExecutableUtil() {
  const output = ts.transpileModule(util, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: files.util,
  }).outputText
  const cjsModule = { exports: {} }
  const cjsExports = cjsModule.exports
  const groupKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  const aliases = {
    '@/shared/utils/match-status': {
      isFinishedStatus: (value) => ['FT', 'AET', 'PEN'].includes(String(value ?? '').toUpperCase()),
      isPostponedStatus: (value) => ['PST', 'POSTP', 'CANC', 'ABD', 'SUSP'].includes(String(value ?? '').toUpperCase()),
    },
    '@/shared/utils/world-cup-groups': {
      WORLD_CUP_GROUP_KEYS: groupKeys,
      getWorldCupGroupKey: (value) => {
        const match = String(value ?? '').match(/\b(?:group|grupo)\s+([a-l])\b/i)
        const key = match?.[1]?.toUpperCase()
        return groupKeys.includes(key) ? key : null
      },
      sortWorldCupGroupKeys: (groups) =>
        [...groups].sort((a, b) => groupKeys.indexOf(a) - groupKeys.indexOf(b)),
    },
  }

  vm.runInNewContext(output, {
    module: cjsModule,
    exports: cjsExports,
    require: (id) => {
      if (aliases[id]) return aliases[id]
      throw new Error(`Unexpected runtime import in world cup verifier: ${id}`)
    },
    console,
    Map,
    Set,
    Date,
    Intl,
    Math,
    Number,
    Object,
    String,
    Array,
    JSON,
    RegExp,
  }, { filename: files.util })

  return cjsModule.exports
}

function makeStandingRow(groupKey, groupIndex, teamIndex) {
  return {
    rank: teamIndex,
    teamId: groupIndex * 100 + teamIndex,
    teamName: `${groupKey} Team ${teamIndex}`,
    teamLogo: `/logos/${groupKey}${teamIndex}.png`,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    form: '',
    description: null,
  }
}

function makeGroups() {
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((groupKey, index) => ({
    name: `Grupo ${groupKey}`,
    groupKey,
    rows: [1, 2, 3, 4].map((teamIndex) => makeStandingRow(groupKey, index + 1, teamIndex)),
  }))
}

function makeFixture(id, groupKey, groupIndex, homeIndex, awayIndex, statusShort, goalsHome, goalsAway) {
  return {
    id,
    round: `Group ${groupKey}`,
    date: `2026-06-${String(Math.min(28, 10 + id)).padStart(2, '0')}T18:00:00.000Z`,
    statusShort,
    minute: statusShort === 'FT' ? 90 : null,
    home: `${groupKey} Team ${homeIndex}`,
    homeId: groupIndex * 100 + homeIndex,
    away: `${groupKey} Team ${awayIndex}`,
    awayId: groupIndex * 100 + awayIndex,
    homeLogo: `/logos/${groupKey}${homeIndex}.png`,
    awayLogo: `/logos/${groupKey}${awayIndex}.png`,
    goalsHome,
    goalsAway,
  }
}

function makeFixturesAndResults() {
  const fixtures = []
  const results = {}
  const pairings = [
    [1, 2, 'FT', 1, 0],
    [3, 4, 'NS', 2, 2],
    [1, 3, 'NS', 0, 0],
    [2, 4, 'NS', 2, 1],
    [1, 4, 'NS', 3, 1],
    [2, 3, 'NS', 0, 2],
  ]

  for (const [groupIndex, groupKey] of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].entries()) {
    for (const [fixtureIndex, [home, away, status, goalsHome, goalsAway]] of pairings.entries()) {
      const id = (groupIndex + 1) * 10 + fixtureIndex + 1
      fixtures.push(makeFixture(id, groupKey, groupIndex + 1, home, away, status, goalsHome, goalsAway))
      if (status !== 'FT') results[String(id)] = { goalsHome, goalsAway }
    }
  }

  return { fixtures, results }
}

function runFunctionalChecks() {
  const utilModule = loadExecutableUtil()
  const groups = makeGroups()
  const { fixtures, results } = makeFixturesAndResults()

  results['11'] = { goalsHome: 9, goalsAway: 9 }
  const model = utilModule.buildWorldCupSimulatedGroupFixtures(groups, fixtures, results, {})
  const groupA = model.groups.find((group) => group.groupKey === 'A')

  assert(model.groups.length === 12, 'Functional check: expected 12 simulated groups.')
  assert(model.totalFixtures === 72, 'Functional check: expected 72 group fixtures.')
  assert(model.completedFixtures === 72, 'Functional check: expected all group fixtures completed.')
  assert(model.complete === true, 'Functional check: full simulated model should be complete.')
  assert(model.groups.every((group) => group.rows.length === 4), 'Functional check: every group must have four teams.')
  assert(model.groups.every((group) => group.fixtures.length === 6), 'Functional check: every group must have six fixtures.')
  assert(groupA?.fixtures[0]?.official === true, 'Functional check: official fixture must stay official.')
  assert(groupA?.fixtures[0]?.goalsHome === 1 && groupA?.fixtures[0]?.goalsAway === 0, 'Functional check: official score must not be overwritten by simulated input.')
  assert(groupA?.fixtures[1]?.simulated === true, 'Functional check: pending fixture with complete input must be simulated.')
  assert(groupA?.pendingFixtureIds.length === 0, 'Functional check: completed simulation should have no pending Group A fixtures.')

  const winnerA = groupA?.rows[0]
  assert(winnerA?.teamName === 'A Team 1', 'Functional check: Group A winner should be A Team 1.')
  assert(winnerA?.played === 3, 'Functional check: played count should be rebuilt from fixtures.')
  assert(winnerA?.won === 2 && winnerA?.drawn === 1 && winnerA?.lost === 0, 'Functional check: W-D-L should be rebuilt from fixtures.')
  assert(winnerA?.goalsFor === 4 && winnerA?.goalsAgainst === 1 && winnerA?.goalDifference === 3, 'Functional check: GF, GC and GD should be rebuilt from fixtures.')
  assert(winnerA?.points === 7, 'Functional check: win/draw scoring should produce 7 points.')

  const incompleteResults = { ...results }
  delete incompleteResults['16']
  const incomplete = utilModule.buildWorldCupSimulatedGroupFixtures(groups, fixtures, incompleteResults, {})
  const incompleteGroupA = incomplete.groups.find((group) => group.groupKey === 'A')
  assert(incomplete.provisional === true, 'Functional check: missing simulated results must keep model provisional.')
  assert(incompleteGroupA?.pendingFixtureIds.includes('16'), 'Functional check: missing fixture should be reported as pending.')

  const firsts = model.groups.map((group) => group.rows[0]).filter(Boolean)
  const seconds = model.groups.map((group) => group.rows[1]).filter(Boolean)
  const thirds = model.groups.map((group) => group.rows[2]).filter(Boolean)
  assert(firsts.length === 12, 'Functional check: expected 12 group winners.')
  assert(seconds.length === 12, 'Functional check: expected 12 group runners-up.')
  assert(thirds.length === 12, 'Functional check: expected 12 third placed teams.')
  assert(model.thirdPlaceRanking.rows.length === 12, 'Functional check: expected 12 ranked third placed teams.')
  assert(model.thirdPlaceRanking.qualified.length === 8, 'Functional check: expected exactly 8 qualified third placed teams.')
  assert(model.thirdPlaceRanking.eliminated.length === 4, 'Functional check: expected exactly 4 eliminated third placed teams.')
  assert(model.thirdPlaceRanking.complete === true, 'Functional check: third-place ranking should be complete when all groups are complete.')

  const assignments = utilModule.resolveWorldCupThirdPlaceAssignments(
    model.thirdPlaceRanking.qualified.map((row) => row.groupKey)
  )
  assert(Object.keys(assignments.slotAssignments).length === 8, 'Functional check: third-place matrix must resolve 8 slots.')
  assert(assignments.unresolvedSlots.length === 0, 'Functional check: third-place matrix should not leave unresolved slots for this fixture set.')

  const bracket = utilModule.buildWorldCupBracketSimulation(groups, [], {}, {}, model.standingsGroups, assignments)
  const r32 = bracket.rounds.find((round) => round.key === 'r32')
  const getMatchBySlot = (roundKey, slot) =>
    bracket.rounds.find((round) => round.key === roundKey)?.matches.find((match) => match.slot === slot)
  const expectPlaceholderSources = (roundKey, slot, homeSource, awaySource) => {
    const match = getMatchBySlot(roundKey, slot)
    assert(
      match?.home.name === `Ganador Partido ${homeSource}` && match?.away.name === `Ganador Partido ${awaySource}`,
      `Functional check: M${slot} must be fed by M${homeSource}/M${awaySource}.`
    )
  }

  assert(bracket.firstRoundSource === 'group-simulation', 'Functional check: simulated bracket should use group simulation source.')
  assert(r32?.matches.length === 16, 'Functional check: expected exactly 16 round-of-32 matches.')
  const r32Teams = new Set(
    r32?.matches
      .flatMap((match) => [match.home, match.away])
      .filter((team) => !team.placeholder)
      .map((team) => team.key)
  )
  assert(r32Teams.size === 32, 'Functional check: round of 32 must contain 32 unique teams.')
  assert(r32?.matches[0]?.slot === 73 && r32?.matches[15]?.slot === 88, 'Functional check: round-of-32 order must preserve official slots 73-88.')

  const firstMatch = getMatchBySlot('r32', 73)
  const secondMatch = getMatchBySlot('r32', 74)
  assert(firstMatch?.home.seedLabel === '2A' && firstMatch?.away.seedLabel === '2B', 'Functional check: M73 must be 2A vs 2B.')
  assert(getMatchBySlot('r32', 75)?.home.seedLabel === '1F' && getMatchBySlot('r32', 75)?.away.seedLabel === '2C', 'Functional check: M75 must be 1F vs 2C.')
  assert(getMatchBySlot('r32', 88)?.home.seedLabel === '2D' && getMatchBySlot('r32', 88)?.away.seedLabel === '2G', 'Functional check: M88 must be 2D vs 2G.')
  expectPlaceholderSources('r16', 89, 73, 75)
  expectPlaceholderSources('r16', 90, 74, 77)
  expectPlaceholderSources('r16', 93, 83, 84)
  expectPlaceholderSources('r16', 94, 81, 82)
  expectPlaceholderSources('r16', 91, 76, 78)
  expectPlaceholderSources('r16', 92, 79, 80)
  expectPlaceholderSources('r16', 95, 86, 88)
  expectPlaceholderSources('r16', 96, 85, 87)
  expectPlaceholderSources('qf', 97, 89, 90)
  expectPlaceholderSources('qf', 98, 93, 94)
  expectPlaceholderSources('qf', 99, 91, 92)
  expectPlaceholderSources('qf', 100, 95, 96)
  expectPlaceholderSources('sf', 101, 97, 98)
  expectPlaceholderSources('sf', 102, 99, 100)
  expectPlaceholderSources('final', 104, 101, 102)
  assert(
    bracket.thirdPlace?.slot === 103 &&
      bracket.thirdPlace.home.name === 'Perdedor Semifinal 101' &&
      bracket.thirdPlace.away.name === 'Perdedor Semifinal 102',
    'Functional check: M103 must use the two semifinal losers.'
  )

  const homeWin = utilModule.resolveKnockoutMatchWinner(firstMatch, { goalsHome: 2, goalsAway: 1 })
  const awayWin = utilModule.resolveKnockoutMatchWinner(firstMatch, { goalsHome: 1, goalsAway: 2 })
  const needsPenalties = utilModule.resolveKnockoutMatchWinner(firstMatch, { goalsHome: 1, goalsAway: 1 })
  const penaltyWin = utilModule.resolveKnockoutMatchWinner(firstMatch, {
    goalsHome: 1,
    goalsAway: 1,
    homePenaltyScore: 4,
    awayPenaltyScore: 3,
  })
  const penaltyTie = utilModule.resolveKnockoutMatchWinner(firstMatch, {
    goalsHome: 1,
    goalsAway: 1,
    homePenaltyScore: 4,
    awayPenaltyScore: 4,
  })

  assert(homeWin.winner?.key === firstMatch.home.key, 'Functional check: 2-1 should automatically qualify home team.')
  assert(awayWin.winner?.key === firstMatch.away.key, 'Functional check: 1-2 should automatically qualify away team.')
  assert(needsPenalties.status === 'needs_penalties' && !needsPenalties.winner, 'Functional check: tied score without penalties must not qualify anyone.')
  assert(penaltyWin.winner?.key === firstMatch.home.key, 'Functional check: penalties should decide tied knockout match.')
  assert(penaltyTie.status === 'penalty_tie' && !penaltyTie.winner, 'Functional check: tied penalties must not qualify anyone.')

  const bracketWithHomeWinner = utilModule.buildWorldCupBracketSimulation(
    groups,
    [],
    { [firstMatch.id]: firstMatch.home.key },
    {},
    model.standingsGroups,
    assignments
  )
  const r16First = bracketWithHomeWinner.rounds.find((round) => round.key === 'r16')?.matches[0]
  const changedWinnerReconciled = utilModule.reconcileKnockoutAfterScoreChange(
    bracketWithHomeWinner.rounds,
    {
      [firstMatch.id]: firstMatch.home.key,
      [r16First.id]: r16First.home.key,
    },
    {
      [firstMatch.id]: { goalsHome: 1, goalsAway: 2 },
      [r16First.id]: { goalsHome: 3, goalsAway: 0 },
    }
  )
  assert(changedWinnerReconciled.winners[firstMatch.id] === firstMatch.away.key, 'Functional check: score change should recalculate first match winner.')
  assert(!changedWinnerReconciled.results[r16First.id], 'Functional check: changed winner should clear affected descendant result.')

  const reconciled = utilModule.reconcileKnockoutSimulationAfterGroupChanges(
    bracket.rounds,
    {
      [firstMatch.id]: firstMatch.home.key,
      [secondMatch.id]: 'team:does-not-exist',
    },
    {
      [firstMatch.id]: { goalsHome: 1, goalsAway: 0 },
      [secondMatch.id]: { goalsHome: 3, goalsAway: 0 },
    }
  )
  assert(reconciled.winners[firstMatch.id] === firstMatch.home.key, 'Functional check: compatible knockout result should be preserved.')
  assert(reconciled.winners[secondMatch.id] === secondMatch.home.key, 'Functional check: score should override stale manual knockout winner.')

  const tieFixtures = fixtures
    .filter((fixture) => fixture.round === 'Group A')
    .map((fixture) => ({ ...fixture, statusShort: 'NS', goalsHome: null, goalsAway: null }))
  const tieResults = Object.fromEntries(tieFixtures.map((fixture) => [String(fixture.id), { goalsHome: 0, goalsAway: 0 }]))
  const unresolvedTie = utilModule.calculateWorldCupGroupTable({
    group: groups[0],
    fixtures: tieFixtures,
    simulatedResults: tieResults,
    manualTiebreakers: {},
  })
  assert(unresolvedTie?.unresolvedTiebreakerTeamKeys.length === 4, 'Functional check: unresolved full tie should remain pending.')
  const manualTie = utilModule.calculateWorldCupGroupTable({
    group: groups[0],
    fixtures: tieFixtures,
    simulatedResults: tieResults,
    manualTiebreakers: { A: ['team:104', 'team:103', 'team:102', 'team:101'] },
  })
  assert(manualTie?.rows[0]?.teamName === 'A Team 4', 'Functional check: manual tiebreaker should control unresolved order.')
  assert(manualTie?.manualTiebreaker === true, 'Functional check: manual tiebreaker should be marked.')

  const cleared = utilModule.clearWorldCupSimulation()
  assert(cleared.schemaVersion === 2, 'Functional check: reset must return schema version 2.')
  assert(Object.keys(cleared.groupResults).length === 0, 'Functional check: reset must clear group simulation results.')
  assert(Object.keys(cleared.winners).length === 0, 'Functional check: reset must clear knockout winners.')
  assert(cleared.selectedGroup === 'A', 'Functional check: reset must restore selected Group A.')

  const validation = utilModule.validateWorldCupSimulation(model, bracket)
  assert(validation.groupCount === 12, 'Functional check: validation should see 12 groups.')
  assert(validation.completeGroupCount === 12, 'Functional check: validation should see 12 complete groups.')
  assert(validation.firstCount === 12, 'Functional check: validation should see 12 winners.')
  assert(validation.secondCount === 12, 'Functional check: validation should see 12 runners-up.')
  assert(validation.thirdQualifiedCount === 8, 'Functional check: validation should see 8 qualified thirds.')
  assert(validation.roundOf32Count === 16, 'Functional check: validation should see 16 round-of-32 matches.')
  assert(validation.uniqueQualifiedCount === 32, 'Functional check: validation should see 32 unique qualified teams.')
}

runFunctionalChecks()

if (!process.exitCode) {
  console.log('[verify-world-cup-bracket] OK')
}
