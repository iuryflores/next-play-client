import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesPlatform, platformKey, platformOptions, missingPlatform } from '../src/game-platform-filter.ts';
import { gameOrder } from '../src/collection-view.ts';

test('plataformas agrupam grafias equivalentes e mantêm consoles e valores personalizados distintos', () => {
  const items = [
    { kind: 'game', platform: ' PC ' }, { kind: 'game', platform: 'pc' },
    { kind: 'game', platform: 'PlayStation  5' }, { kind: 'game', platform: 'PlayStation 4' },
    { kind: 'game', platform: 'Console próprio' }, { kind: 'game', platform: 'CONSOLE PROPRIO' },
    { kind: 'game' }, { kind: 'game', platform: '   ' }, { kind: 'movie', platform: 'PC' },
  ];
  const options = platformOptions(items);
  assert.equal(options.find(option => option.key === platformKey('pc')).count, 2);
  assert.equal(options.find(option => option.key === platformKey('Console próprio')).count, 2);
  assert.equal(options.at(-1).key, missingPlatform); assert.equal(options.at(-1).count, 2);
  assert.notEqual(platformKey('PlayStation 4'), platformKey('PlayStation 5'));
  assert.equal(options.length, 5); assert.equal(items[0].platform, ' PC ');
});

test('filtrar mantém Jogando primeiro e horas decrescentes, sem afetar os registros', () => {
  const items = [
    { id: 'done', kind: 'game', status: 'completed', platform: 'PC', playtimeMinutes: 900 },
    { id: 'other', kind: 'game', status: 'active', platform: 'Xbox', playtimeMinutes: 500 },
    { id: 'few', kind: 'game', status: 'active', platform: 'pc', playtimeMinutes: 50 },
    { id: 'many', kind: 'game', status: 'active', platform: 'PC', playtimeMinutes: 100 },
    { id: 'missing', kind: 'game', status: 'active', playtimeMinutes: 0 },
  ];
  assert.deepEqual(items.filter(item => matchesPlatform(item, platformKey('PC'))).sort(gameOrder).map(item => item.id), ['many', 'few', 'done']);
  assert.deepEqual(items.filter(item => matchesPlatform(item, missingPlatform)).map(item => item.id), ['missing']);
  assert.equal(items.filter(item => matchesPlatform(item, undefined)).length, 5);
  assert.equal(items.filter(item => matchesPlatform(item, platformKey('Nintendo Switch'))).length, 0);
  assert.equal(matchesPlatform({ kind: 'movie', platform: 'PC' }, platformKey('PC')), false);
});
