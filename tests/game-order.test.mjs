import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameOrder } from '../src/collection-view.ts';

test('jogando vem primeiro e cada grupo segue o maior tempo jogado', () => {
  const games = [
    { id: 'planned', status: 'planned', playtimeMinutes: 900 },
    { id: 'active-short', status: 'active', playtimeMinutes: 50 },
    { id: 'active-long', status: 'active', playtimeMinutes: 290 },
    { id: 'no-time', status: 'active' },
    { id: 'completed', status: 'completed', playtimeMinutes: 2000 },
  ];
  assert.deepEqual(
    games.sort(gameOrder).map((game) => game.id),
    ['active-long', 'active-short', 'no-time', 'completed', 'planned'],
  );
  assert.equal(
    gameOrder(
      { status: 'active', playtimeMinutes: NaN },
      { status: 'active', playtimeMinutes: -1 },
    ),
    0,
  );
});
