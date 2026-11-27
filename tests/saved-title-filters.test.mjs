import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSavedTitle } from '../src/saved-title-filters.ts';

test('combina ano, desenvolvedora e avaliação e preserva as cópias da mesma obra', () => {
  const title = { kind: 'game', year: '2020', catalogId: 'igdb:game:1' };
  const copies = [{ ...title, id: 'disc' }, { ...title, id: 'digital' }];
  const filter = { year: '2020', company: 'estudio', source: 'personal', minimum: 4 };
  const metadata = { companies: ['Estúdio Exemplo'], rating: 100 };
  assert.deepEqual(copies.filter(copy => matchesSavedTitle(copy, filter, metadata, 4)), copies);
  assert.equal(matchesSavedTitle(title, filter, metadata, 3), false);
  assert.equal(matchesSavedTitle({ ...title, year: '2021' }, filter, metadata, 5), false);
  assert.equal(matchesSavedTitle(title, filter, { companies: ['Outro'] }, 5), false);
});

test('zero da crítica existe e zero pessoal representa ausência de nota', () => {
  const movie = { kind: 'movie', productionCompanies: [{ name: 'Produtora' }] };
  const filter = { year: '', company: 'produtora', source: 'critic', minimum: 0 };
  assert.equal(matchesSavedTitle(movie, filter, { rating: 0 }), true);
  assert.equal(matchesSavedTitle(movie, filter, { rating: null }), false);
  assert.equal(matchesSavedTitle(movie, { ...filter, source: 'personal' }, undefined, 0), false);
  assert.equal(matchesSavedTitle(movie, { ...filter, source: 'community', minimum: 3.5 }, { rating: 3.49 }), false);
  assert.equal(matchesSavedTitle({ kind: 'book' }, { ...filter, company: '', source: '' }), true);
});

test('idioma e país de uma coprodução combinam com os filtros de obras salvas', () => {
  const title = { kind: 'series', year: '2020', catalogId: 'tmdb:series:1' };
  const filter = { year: '2020', company: 'estúdio', source: 'community', minimum: 4,
    originalLanguage: 'fr', originCountry: 'CA' };
  const metadata = { originalLanguage: 'fr', originCountries: ['FR', 'CA'], companies: ['Estúdio'], rating: 4.5 };
  assert.equal(matchesSavedTitle(title, filter, metadata), true);
  assert.equal(matchesSavedTitle(title, { ...filter, originCountry: 'BR' }, metadata), false);
  assert.equal(matchesSavedTitle(title, { ...filter, originalLanguage: 'en' }, metadata), false);
  assert.equal(matchesSavedTitle(title, filter, { ...metadata, originCountries: undefined }), false);
  assert.equal(matchesSavedTitle({ ...title, kind: 'game' }, filter, metadata), false);
});

test('streaming mantém os demais filtros e exige oferta confirmada de filme ou série', () => {
  const movie = { kind: 'movie', year: '2020' };
  const filter = { year: '2020', company: '', source: 'personal', minimum: 4, streaming: true };
  assert.equal(matchesSavedTitle(movie, filter, { streamingMatch: true }, 5), true);
  assert.equal(matchesSavedTitle(movie, filter, { streamingMatch: false }, 5), false);
  assert.equal(matchesSavedTitle(movie, filter, undefined, 5), false);
  assert.equal(matchesSavedTitle(movie, filter, { streamingMatch: true }, 3), false);
  assert.equal(matchesSavedTitle({ ...movie, kind: 'game' }, filter, { streamingMatch: true }, 5), false);
});

test('classificação máxima combina com disponibilidade e distingue Livre de ausência', () => {
  const movie = { kind: 'movie', year: '2020' };
  const filter = { year: '2020', company: '', source: '', minimum: 0, streaming: true, maxAge: 12 };
  const metadata = { streamingMatch: true, ageRating: 12 };
  assert.equal(matchesSavedTitle(movie, filter, metadata), true);
  assert.equal(matchesSavedTitle(movie, filter, { ...metadata, ageRating: 14 }), false);
  assert.equal(matchesSavedTitle(movie, filter, { ...metadata, streamingMatch: false }), false);
  assert.equal(matchesSavedTitle(movie, { ...filter, maxAge: 0 }, { ...metadata, ageRating: 0 }), true);
  assert.equal(matchesSavedTitle(movie, { ...filter, maxAge: 0 }, { ...metadata, ageRating: null }), false);
  assert.equal(matchesSavedTitle({ ...movie, kind: 'game' }, { ...filter, streaming: false }, metadata), false);
});

test('franquia e universo exigem vínculo de catálogo em combinação com os demais filtros', () => {
  const title = { kind: 'movie', year: '2017' };
  const filter = { year: '2017', company: '', source: 'personal', minimum: 4, grouped: true };
  assert.equal(matchesSavedTitle(title, filter, { groupsMatch: true }, 4), true);
  assert.equal(matchesSavedTitle(title, filter, { groupsMatch: false }, 4), false);
  assert.equal(matchesSavedTitle(title, filter, { groupsMatch: true }, 3), false);
  assert.equal(matchesSavedTitle(title, filter, undefined, 4), false);
});
