import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMatchday, canEditPlayers, automaticReplacements, systemRebuy } from './rules.mjs';

const squad = Array.from({ length: 26 }, (_, i) => `p${i}`);
const valid = { squad, starters: squad.slice(0, 11), bench: squad.slice(11, 16), reserves: squad.slice(16) };

test('26 players with 11 starters, 5 bench, 10 reserves', () => assert.equal(validateMatchday(valid).ok, true));
test('32 players with 16 reserves', () => {
  const s = Array.from({ length: 32 }, (_, i) => `p${i}`);
  assert.equal(validateMatchday({ squad: s, starters: s.slice(0, 11), bench: s.slice(11, 16), reserves: s.slice(16) }).ok, true);
});
test('reject missing bench and duplicated selection', () => {
  assert.equal(validateMatchday({ ...valid, bench: valid.bench.slice(0, 4) }).ok, false);
  assert.equal(validateMatchday({ ...valid, starters: [...valid.starters.slice(0, 10), valid.bench[0]] }).ok, false);
});
test('kickoff locks individually at exact instant and unknown kickoffs fail closed', () => {
  const k = { p1: '2026-11-07T17:00:00-03:00', p2: '2026-11-08T17:00:00-03:00' };
  assert.equal(canEditPlayers(['p1', 'p2'], k, '2026-11-07T16:59:59-03:00'), true);
  assert.equal(canEditPlayers(['p1', 'p2'], k, '2026-11-07T17:00:00-03:00'), false);
  assert.equal(canEditPlayers(['p2'], k, '2026-11-07T17:00:00-03:00'), true);
  assert.equal(canEditPlayers(['p3'], k, '2026-11-07T16:00:00-03:00'), false);
});
test('only confirmed zero-minute starters are substituted', () => {
  const m = { p0: 0, p1: 90, p11: 30, p12: 0, p13: 15 };
  const finals = { p0: true, p1: true, p11: true, p12: true, p13: true };
  assert.deepEqual(automaticReplacements({ starters: valid.starters, bench: valid.bench, minutesByPlayer: m, matchFinalByPlayer: finals, canFillPosition: () => true }), [{ out: 'p0', in: 'p11' }]);
});
test('no reuse of a bench player; only finished games count', () => {
  const m = { p0: 0, p1: 0, p11: 50 };
  const f = { p0: true, p1: true, p11: true };
  assert.deepEqual(automaticReplacements({ starters: valid.starters, bench: valid.bench, minutesByPlayer: m, matchFinalByPlayer: f, canFillPosition: () => true }), [{ out: 'p0', in: 'p11' }]);
  assert.deepEqual(automaticReplacements({ starters: valid.starters, bench: valid.bench, minutesByPlayer: m, matchFinalByPlayer: { ...f, p0: false }, canFillPosition: () => true }), [{ out: 'p1', in: 'p11' }]);
});
test('formation guard can skip an ineligible bench player', () => {
  const m = { p0: 0, p11: 90, p12: 40 };
  const f = { p0: true, p11: true, p12: true };
  assert.deepEqual(automaticReplacements({ starters: valid.starters, bench: valid.bench, minutesByPlayer: m, matchFinalByPlayer: f, canFillPosition: (_s, c) => c === 'p12' }), [{ out: 'p0', in: 'p12' }]);
});
test('system rebuy is 75% of frozen value only after departure', () => {
  assert.equal(systemRebuy(101, false), null);
  assert.equal(systemRebuy(101, true), 75);
  assert.throws(() => systemRebuy(-1, true));
});
