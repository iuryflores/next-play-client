import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeKind, summarizeActors } from '../src/stats-summary.ts';

test('game platforms separate completions, omit missing values and isolate other media', () => {
  const items = [
    { kind: 'game', status: 'completed', platform: 'PC', genres: ['RPG', 'RPG'] },
    { kind: 'game', status: 'active', platform: ' pc ', genres: ['Luta'] },
    { kind: 'game', status: 'planned', platform: 'PS1' },
    { kind: 'game', status: 'completed', platform: '  ' },
    { kind: 'movie', status: 'completed', platform: 'PC' },
  ];
  const result = summarizeKind(items, 'game');
  assert.deepEqual(result.addedPlatforms, [{ name: 'PC', count: 2 }, { name: 'PS1', count: 1 }]);
  assert.deepEqual(result.completedPlatforms, [{ name: 'PC', count: 1 }]);
  assert.equal(result.missingPlatforms, 1);
  assert.deepEqual(result.watchedGenres, [{ name: 'RPG', count: 1 }]);
  assert.deepEqual(summarizeKind([], 'game').addedPlatforms, []);
});

test('IGDB and manually entered game genres share one ranking entry', () => {
  const result = summarizeKind([
    { kind: 'game', status: 'completed', genres: ['Fighting', 'Luta'] },
    { kind: 'game', status: 'completed', genres: ['luta', 'Role-playing (RPG)'] },
  ], 'game');
  assert.deepEqual(result.watchedGenres, [{ name: 'Luta', count: 2 }, { name: 'RPG', count: 1 }]);
});

test('actor vote sources retain movie and show contributions without mutating input', () => {
  const movie = { itemId: 'm', title: 'Movie', kind: 'movie', count: 1 };
  const series = { itemId: 's', title: 'Show', kind: 'series', count: 8 };
  const result = summarizeActors([
    { id: '1', name: 'Actor', photo: '', kind: 'movie', count: 1, sources: [movie] },
    { id: '1', name: 'Actor', photo: '', kind: 'series', count: 8, sources: [series] },
  ]);
  assert.equal(result[0].count, 9);
  assert.deepEqual(result[0].sources, [series, movie]);
  assert.notEqual(result[0].sources[0], series);
});

test('general actor ranking combines movies and series by actor ID without merging namesakes', () => {
  const entries = [
    { id: '1', name: 'Alex', photo: '', kind: 'movie', count: 2 },
    { id: '1', name: 'Alex', photo: 'photo.jpg', kind: 'series', count: 4 },
    { id: '2', name: 'Alex', photo: '', kind: 'movie', count: 5 },
    { id: '3', name: 'Other', photo: '', kind: 'game', count: 20 },
  ];
  assert.deepEqual(summarizeActors(entries), [
    { id: '1', name: 'Alex', photo: 'photo.jpg', count: 6 },
    { id: '2', name: 'Alex', photo: '', count: 5 },
  ]);
  assert.equal(entries[0].count, 2);
  assert.deepEqual(summarizeActors([]), []);
});
test('statistics tabs isolate ratings, feelings and genres, counting unrated completions without lowering averages', () => {
  const items = [
    { kind: 'movie', status: 'completed', genres: ['Drama', 'drama'], stars: 4, feeling: 'happy' },
    { kind: 'movie', status: 'completed', genres: ['Drama'], stars: 0 },
    { kind: 'movie', status: 'planned', genres: ['Fantasia'] },
    { kind: 'game', status: 'completed', genres: ['Aventura'], stars: 2, feeling: 'scared' },
    { kind: 'game', status: 'active', genres: ['Aventura'] },
    { kind: 'series', status: 'active', genres: ['Comédia'], episodeProgress: { watched: 2 } },
    { kind: 'book', status: 'completed', genres: ['Drama'], stars: 5 },
  ];
  const movies = summarizeKind(items, 'movie');
  assert.equal(movies.total, 3); assert.equal(movies.completed, 2); assert.equal(movies.average, 4); assert.equal(movies.rated, 1);
  assert.deepEqual(movies.feelings, [{ feeling: 'happy', count: 1 }]);
  assert.deepEqual(movies.watchedGenres, [{ name: 'drama', count: 2 }]);
  const games = summarizeKind(items, 'game'); assert.equal(games.active, 1); assert.equal(games.average, 2); assert.equal(games.addedGenres[0].count, 2); assert.equal(games.watchedGenres[0].count, 1);
  assert.equal(summarizeKind(items, 'series').watchedGenres[0].count, 1);
  assert.equal(summarizeKind([], 'movie').average, null);
});
