import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRottenTomatoesMovie as match } from '../src/rotten-tomatoes-match.ts';

test('recognizes Lord/Miller naming variation while retaining title, year and ambiguity checks', () => {
  const movie = { title: 'Project Hail Mary', year: 2026, directors: ['Phil Lord', 'Chris Miller'] };
  const directors = ['Phil Lord', 'Christopher Miller'];
  assert.equal(match([movie], 'Project Hail Mary', '2026', directors), movie);
  const fullName = { ...movie, directors };
  assert.equal(match([fullName], 'Project Hail Mary', '2026', movie.directors), fullName);
  assert.equal(match([movie], 'Project Hail Mary', '2025', directors), null);
  assert.equal(match([movie], 'Another Title', '2026', directors), null);
  assert.equal(match([movie, { ...movie }], 'Project Hail Mary', '2026', directors), null);
  assert.equal(match([{ ...movie, directors: ['Chris Miller'] }], 'Project Hail Mary', '2026', directors), null);
  assert.equal(match([{ ...movie, directors: ['Chris Miller'] }], 'Project Hail Mary', '2026', ['Christopher Miller']), null);
});

test('uses direction to distinguish identical titles and years without preferring scores', () => {
  const correct = { title: 'Oppenheimer', year: 2023, directors: ['Christopher Nolan'], tomatometer: null };
  const wrong = { ...correct, directors: ['Another Director'], tomatometer: 99 };
  assert.equal(match([wrong, correct], 'Oppenheimer', '2023', ['Christopher Nolan']), correct);
  assert.equal(match([wrong], 'Oppenheimer', '2023', ['Christopher Nolan']), null);
  assert.equal(match([correct], 'Oppenheimer', '2023', []), null);
  assert.equal(match([{ ...correct, directors: [] }], 'Oppenheimer', '2023', ['Christopher Nolan']), null);
  assert.equal(match([correct, { ...correct }], 'Oppenheimer', '2023', ['Christopher Nolan']), null);
  assert.equal(match([correct], 'Oppenheimer', '2022', ['Christopher Nolan']), null);
});

test('normalizes director names and checks all TMDB codirectors', () => {
  const movie = { title: 'Movie', year: 2023, directors: ['José Silva', 'Jane Doe'] };
  assert.equal(match([movie], 'Movie', '2023', ['JOSE SILVA', 'Jane Doe']), movie);
  assert.equal(match([{ ...movie, directors: ['José Silva'] }], 'Movie', '2023', ['Jose Silva', 'Jane Doe']), null);
});
test('matches exact normalized title and year instead of first search result', () => {
  const movie = { title: 'Interstellar', year: 2014 };
  assert.equal(match([{ title: 'Interstellar Wars', year: 2016 }, movie], 'INTERSTELLAR', '2014'), movie);
  assert.equal(match([movie], 'Interstellar', '2015'), null);
  assert.equal(match([movie], 'Interstellar'), null);
  assert.equal(match([movie, { ...movie }], 'Interstellar', '2014'), null);
  assert.equal(match([], 'Interstellar', '2014'), null);
  assert.equal(match([{ title: 'Amélie', year: 2001 }], 'Amelie', '2001')?.year, 2001);
});
