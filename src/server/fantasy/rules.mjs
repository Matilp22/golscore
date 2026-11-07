/** Pure, side-effect-free Hay Fulbo Fantasy rules. No database writes. */
export const MIN_SQUAD = 26;
export const MAX_SQUAD = 32;
export const STARTERS = 11;
export const BENCH = 5;

export function validateMatchday({ squad, starters, bench, reserves }) {
  const groups = [squad, starters, bench, reserves];
  if (groups.some((group) => !Array.isArray(group))) return { ok: false, error: 'INVALID_GROUP' };
  if (groups.some((group) => group.some((id) => typeof id !== 'string' || !id.trim()))) return { ok: false, error: 'INVALID_PLAYER_ID' };
  if (squad.length < MIN_SQUAD || squad.length > MAX_SQUAD) return { ok: false, error: 'SQUAD_SIZE' };
  if (starters.length !== STARTERS || bench.length !== BENCH) return { ok: false, error: 'MATCHDAY_SIZE' };
  if (reserves.length !== squad.length - STARTERS - BENCH) return { ok: false, error: 'RESERVE_SIZE' };
  if (groups.some((group) => new Set(group).size !== group.length)) return { ok: false, error: 'DUPLICATE_PLAYER' };
  const selected = [...starters, ...bench, ...reserves];
  if (selected.length !== squad.length || new Set(selected).size !== selected.length || selected.some((id) => !squad.includes(id))) return { ok: false, error: 'SQUAD_PARTITION' };
  return { ok: true };
}

/** Player locks at kickoff, including exact instant; missing times fail closed. */
export function canEditPlayers(playerIds, kickoffByPlayer, now) {
  if (!Array.isArray(playerIds) || playerIds.length === 0 || new Set(playerIds).size !== playerIds.length) return false;
  const instant = new Date(now).getTime();
  if (!Number.isFinite(instant)) return false;
  return playerIds.every((id) => {
    const kickoff = kickoffByPlayer?.[id];
    if (typeof kickoff !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(kickoff)) return false;
    const start = new Date(kickoff).getTime();
    return Number.isFinite(start) && instant < start;
  });
}

/** Bench order is priority; only confirmed 0-minute starters are replaced.
 * A bench candidate must have confirmed positive minutes in a finished game.
 * Caller supplies formation legality; no tactical/performance substitutions.
 */
export function automaticReplacements({ starters, bench, minutesByPlayer, matchFinalByPlayer, canFillPosition }) {
  if (starters.length !== STARTERS || bench.length !== BENCH) throw new Error('INVALID_MATCHDAY');
  if (typeof canFillPosition !== 'function') throw new Error('POSITION_CHECK_REQUIRED');
  const unused = [...bench];
  const replacements = [];
  for (const starter of starters) {
    if (matchFinalByPlayer?.[starter] !== true || minutesByPlayer?.[starter] !== 0) continue;
    const idx = unused.findIndex((candidate) =>
      matchFinalByPlayer?.[candidate] === true &&
      Number.isFinite(minutesByPlayer?.[candidate]) &&
      minutesByPlayer[candidate] > 0 &&
      canFillPosition(starter, candidate, replacements)
    );
    if (idx !== -1) replacements.push({ out: starter, in: unused.splice(idx, 1)[0] });
  }
  return replacements;
}

/** Integer credit units, rounding down. Only for departure from covered league. */
export function systemRebuy(frozenValue, hasLeftCoveredLeague) {
  if (!hasLeftCoveredLeague) return null;
  if (!Number.isSafeInteger(frozenValue) || frozenValue < 0) throw new Error('INVALID_FROZEN_VALUE');
  return Math.floor(frozenValue * 75 / 100);
}
