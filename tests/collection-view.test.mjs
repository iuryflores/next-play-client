import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesView,
  priorityOrder,
  backlogOrder,
} from '../src/collection-view.ts';

test('reading wishlist and active books leave overview when read and respect archiving', () => {
  const book = { kind: 'book', status: 'planned', year: '2011' };
  assert.equal(matchesView(book, 'all'), true);
  assert.equal(matchesView(book, 'planned'), true);
  assert.equal(matchesView({ ...book, status: 'active' }, 'active'), true);
  assert.equal(matchesView({ ...book, status: 'active' }, 'all'), true);
  assert.equal(
    matchesView({ ...book, status: 'completed' }, 'completed'),
    true,
  );
  assert.equal(matchesView({ ...book, status: 'completed' }, 'all'), false);
  assert.equal(
    matchesView({ ...book, status: 'completed', archived: true }, 'completed'),
    false,
  );
  assert.equal(
    matchesView({ ...book, status: 'completed', archived: true }, 'archived'),
    true,
  );
});

test('future releases have their own view and return to overview after release', () => {
  const movie = { kind: 'movie', status: 'planned', releaseDate: '2099-12-18' };
  assert.equal(matchesView(movie, 'coming-soon'), true);
  assert.equal(matchesView(movie, 'all'), false);
  assert.equal(matchesView(movie, 'planned'), false);
  assert.equal(matchesView({ ...movie, archived: true }, 'coming-soon'), false);
  assert.equal(
    matchesView({ ...movie, status: 'completed' }, 'coming-soon'),
    false,
  );
  assert.equal(
    matchesView({ ...movie, releaseDate: '2000-01-01' }, 'coming-soon'),
    false,
  );
  assert.equal(
    matchesView({ ...movie, releaseDate: '2000-01-01' }, 'all'),
    true,
  );
  assert.equal(
    matchesView(
      { kind: 'game', status: 'planned', unreleased: true },
      'coming-soon',
    ),
    true,
  );
});

test('completed titles includes caught-up shows and returns them to overview when episodes become pending', () => {
  const show = { kind: 'series', status: 'active', caughtUp: true };
  assert.equal(matchesView(show, 'completed'), true);
  assert.equal(matchesView(show, 'all'), false);
  assert.equal(matchesView({ ...show, caughtUp: false }, 'completed'), false);
  assert.equal(matchesView({ ...show, caughtUp: false }, 'all'), true);
  assert.equal(matchesView({ ...show, archived: true }, 'completed'), false);
  assert.equal(matchesView({ ...show, archived: true }, 'archived'), true);
  assert.equal(
    matchesView({ kind: 'movie', status: 'completed' }, 'completed'),
    true,
  );
  assert.equal(
    matchesView({ kind: 'movie', status: 'planned' }, 'completed'),
    false,
  );
  assert.equal(
    matchesView({ kind: 'game', status: 'completed' }, 'completed'),
    true,
  );
  assert.equal(
    matchesView(
      { kind: 'series', status: 'completed', caughtUp: false },
      'completed',
    ),
    true,
  );
});

test('Em breve não repete séries acompanhadas entre os novos títulos', () => {
  const title = {
    kind: 'series',
    status: 'active',
    year: '2099',
    releaseDate: '2099-01-01',
  };
  assert.equal(matchesView(title, 'coming-soon'), true);
  assert.equal(
    matchesView({ ...title, episodeProgress: { watched: 1 } }, 'coming-soon'),
    false,
  );
  assert.equal(
    matchesView({ ...title, inProgress: true }, 'coming-soon'),
    false,
  );
});

test('prioridade do backlog ordena todas as mídias e mantém desempates existentes', () => {
  const rows = [
    { title: 'D', kind: 'game', priority: 'low' },
    { title: 'B', kind: 'book', priority: 'high' },
    { title: 'E', kind: 'movie' },
    { title: 'C', kind: 'series', priority: 'medium' },
    { title: 'A', kind: 'game', priority: 'high' },
  ];
  assert.deepEqual(
    rows
      .sort((a, b) => priorityOrder(a, b) || a.title.localeCompare(b.title))
      .map((row) => row.title),
    ['A', 'B', 'C', 'D', 'E'],
  );
  assert.equal(priorityOrder({}, { priority: 'none' }), 0);
  assert.equal(priorityOrder({ priority: 'unknown' }, {}), 0);
});

test('Para depois desempata por lançamento completo e usa lançamento quando não há prioridade', () => {
  const rows = [
    { title: 'Sem data' },
    {
      title: 'Antigo prioritário',
      priority: 'high',
      releaseDate: '2000-01-01',
    },
    { title: 'Março', releaseDate: '2025-03-01' },
    { title: 'Dezembro', priority: 'none', releaseDate: '2025-12-01' },
    { title: 'Só ano', year: '2024' },
    { title: 'Novo prioritário', priority: 'high', releaseDate: '2026-02-01' },
  ];
  assert.deepEqual(
    rows.sort(backlogOrder).map((row) => row.title),
    [
      'Novo prioritário',
      'Antigo prioritário',
      'Dezembro',
      'Março',
      'Só ano',
      'Sem data',
    ],
  );
});
