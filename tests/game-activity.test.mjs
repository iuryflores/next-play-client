import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameActivity } from '../src/game-activity.ts';

test('tempo de jogos inclui arquivados, agrupa plataforma e ordena por minutos', () => {
  const items = [
    {
      id: 'a',
      title: 'Jogo A',
      kind: 'game',
      status: 'completed',
      platform: ' PC ',
      playtimeMinutes: 123,
      archived: true,
    },
    {
      id: 'b',
      title: 'Jogo B',
      kind: 'game',
      status: 'active',
      platform: 'pc',
      playtimeMinutes: 60,
    },
    {
      id: 'c',
      title: 'Jogo C',
      kind: 'game',
      status: 'planned',
      playtimeMinutes: 30,
    },
    {
      id: 'movie',
      title: 'Filme',
      kind: 'movie',
      status: 'completed',
      playtimeMinutes: 9999,
    },
  ];
  const original = structuredClone(items);
  const result = gameActivity(items);
  assert.equal(result.totalMinutes, 213);
  assert.equal(result.completionRate, 33);
  assert.equal(result.planned, 1);
  assert.equal(result.recordedGames, 3);
  assert.deepEqual(
    result.mostPlayed.map((game) => game.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(result.platforms, [
    { name: 'PC', minutes: 183 },
    { name: '', minutes: 30 },
  ]);
  assert.deepEqual(items, original);
});

test('dados ausentes ou inválidos não inventam tempo; empates têm ordem estável', () => {
  const invalid = [undefined, -1, NaN, Infinity, 1.5, 6000001];
  const games = invalid.map((value, index) => ({
    id: String(index),
    title: 'Sem tempo',
    kind: 'game',
    status: 'active',
    playtimeMinutes: value,
  }));
  assert.equal(gameActivity(games).totalMinutes, 0);
  assert.equal(gameActivity(games).mostPlayed.length, 0);
  assert.equal(gameActivity([]).completionRate, 0);
  const tie = gameActivity([
    {
      id: 'b',
      title: 'Mesmo',
      kind: 'game',
      status: 'active',
      playtimeMinutes: 1,
    },
    {
      id: 'a',
      title: 'Mesmo',
      kind: 'game',
      status: 'active',
      playtimeMinutes: 1,
    },
  ]);
  assert.deepEqual(
    tie.mostPlayed.map((game) => game.id),
    ['a', 'b'],
  );
});
