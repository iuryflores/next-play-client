import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesView } from '../src/collection-view.ts';

test('quero rever aparece em Para depois e preserva o filme em Concluídos', () => {
  const film = { kind: 'movie', status: 'completed', rewatchWanted: true };
  assert.equal(matchesView(film, 'planned'), true);
  assert.equal(matchesView(film, 'completed'), true);
  assert.equal(matchesView(film, 'all'), false);
  assert.equal(matchesView({ ...film, rewatchWanted: false }, 'planned'), false);
});

test('repetição ativa continua no acompanhamento mesmo em dia e mantém a conclusão anterior', () => {
  const series = { kind: 'series', status: 'active', rewatching: true, watchedBefore: true, caughtUp: true };
  for (const view of ['all', 'active', 'completed']) assert.equal(matchesView(series, view), true);
  for (const view of ['planned', 'coming-soon', 'archived']) assert.equal(matchesView(series, view), false);
  assert.equal(matchesView({ ...series, archived: true }, 'all'), false);
  assert.equal(matchesView({ ...series, archived: true }, 'completed'), false);
  assert.equal(matchesView({ ...series, archived: true }, 'archived'), true);
});
