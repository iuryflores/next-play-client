import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesView } from '../src/collection-view.ts';

test('future releases have their own view and return to overview after release', () => {
  const movie = { kind: 'movie', status: 'planned', releaseDate: '2099-12-18' };
  assert.equal(matchesView(movie, 'coming-soon'), true);
  assert.equal(matchesView(movie, 'all'), false);
  assert.equal(matchesView(movie, 'planned'), false);
  assert.equal(matchesView({ ...movie, archived: true }, 'coming-soon'), false);
  assert.equal(matchesView({ ...movie, status: 'completed' }, 'coming-soon'), false);
  assert.equal(matchesView({ ...movie, releaseDate: '2000-01-01' }, 'coming-soon'), false);
  assert.equal(matchesView({ ...movie, releaseDate: '2000-01-01' }, 'all'), true);
  assert.equal(matchesView({ kind: 'game', status: 'planned', unreleased: true }, 'coming-soon'), true);
});

test('completed titles includes caught-up shows and returns them to overview when episodes become pending', () => {
  const show = { kind: 'series', status: 'active', caughtUp: true };
  assert.equal(matchesView(show, 'completed'), true);
  assert.equal(matchesView(show, 'all'), false);
  assert.equal(matchesView({ ...show, caughtUp: false }, 'completed'), false);
  assert.equal(matchesView({ ...show, caughtUp: false }, 'all'), true);
  assert.equal(matchesView({ ...show, archived: true }, 'completed'), false);
  assert.equal(matchesView({ ...show, archived: true }, 'archived'), true);
  assert.equal(matchesView({ kind: 'movie', status: 'completed' }, 'completed'), true);
  assert.equal(matchesView({ kind: 'movie', status: 'planned' }, 'completed'), false);
  assert.equal(matchesView({ kind: 'game', status: 'completed' }, 'completed'), true);
  assert.equal(matchesView({ kind: 'series', status: 'completed', caughtUp: false }, 'completed'), true);
});
