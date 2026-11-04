import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesOverview,
  overviewStatuses,
  defaultOverviewStatuses,
} from '../src/collection-view.ts';
import { homeRouteUrl, readHomeRoute } from '../src/home-route.ts';

test('combina status por união, sem incluir arquivados implicitamente', () => {
  const items = [
    {
      id: 'planned',
      kind: 'movie',
      status: 'planned',
      releaseDate: '2000-01-01',
    },
    { id: 'active', kind: 'book', status: 'active' },
    { id: 'completed', kind: 'game', status: 'completed' },
    { id: 'archived', kind: 'movie', status: 'active', archived: true },
  ];
  for (let mask = 0; mask < 16; mask++) {
    const selected = overviewStatuses.filter((_, index) => mask & (1 << index));
    assert.deepEqual(
      items
        .filter((item) => matchesOverview(item, selected))
        .map((item) => item.id),
      selected,
    );
  }
  assert.deepEqual(
    items
      .filter((item) => matchesOverview(item, defaultOverviewStatuses))
      .map((item) => item.id),
    ['planned', 'active'],
  );
});

test('séries em dia, progresso de episódios e repetições mantêm as regras de acompanhamento', () => {
  const caughtUp = { kind: 'series', status: 'active', caughtUp: true };
  assert.equal(matchesOverview(caughtUp, ['completed']), true);
  assert.equal(matchesOverview(caughtUp, ['active']), false);
  const started = {
    kind: 'series',
    status: 'planned',
    episodeProgress: { watched: 2 },
  };
  assert.equal(matchesOverview(started, ['active']), true);
  assert.equal(matchesOverview(started, ['planned']), false);
  const rewatch = {
    kind: 'movie',
    status: 'completed',
    watchedBefore: true,
    rewatching: true,
  };
  assert.equal(matchesOverview(rewatch, ['active']), true);
  assert.equal(matchesOverview(rewatch, ['completed']), true);
  assert.equal(
    matchesOverview({ ...rewatch, archived: true }, ['active', 'completed']),
    false,
  );
});

test('filtros combinados e seleção vazia sobrevivem à URL e aos detalhes', () => {
  for (const statuses of [
    [],
    ['active'],
    ['active', 'completed'],
    overviewStatuses,
  ]) {
    const route = {
      view: 'all',
      category: 'game',
      detailId: 'a'.repeat(24),
      historyMode: false,
      statuses,
      platform: 'platform:pc',
    };
    assert.deepEqual(
      readHomeRoute(new URL(homeRouteUrl(route), 'https://example.test')),
      route,
    );
    assert.ok(!homeRouteUrl({ ...route, view: 'explore' }).includes('status='));
  }
  assert.deepEqual(
    readHomeRoute(
      new URL('https://example.test/biblioteca?status=active,invalid,active'),
    ).statuses,
    ['active'],
  );
});

test('obras futuras ficam em Em breve e entram na visão geral na data da estreia', () => {
  const today = new Date().toISOString().slice(0, 10);
  const future = {
    kind: 'movie',
    status: 'planned',
    releaseDate: '2099-01-01',
  };
  for (const statuses of [
    defaultOverviewStatuses,
    overviewStatuses,
    ['planned'],
  ]) {
    assert.equal(matchesOverview(future, statuses), false);
    assert.equal(
      matchesOverview({ ...future, releaseDate: today }, statuses),
      true,
    );
    assert.equal(
      matchesOverview({ ...future, releaseDate: '2000-01-01' }, statuses),
      true,
    );
  }
  assert.equal(
    matchesOverview(
      { kind: 'game', status: 'planned', unreleased: true },
      overviewStatuses,
    ),
    false,
  );
  assert.equal(
    matchesOverview(
      { kind: 'book', status: 'planned', year: '2099' },
      overviewStatuses,
    ),
    false,
  );
  assert.equal(
    matchesOverview(
      { kind: 'movie', status: 'planned' },
      defaultOverviewStatuses,
    ),
    true,
  );
  // Endereços antigos com o filtro removido voltam à visão geral sem manter uma seleção sem resultados.
  const route = readHomeRoute(
    new URL('https://example.test/biblioteca?lancamento=upcoming'),
  );
  assert.equal(homeRouteUrl(route), '/biblioteca');
});
