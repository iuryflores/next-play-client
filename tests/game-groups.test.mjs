import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupGames } from '../src/game-groups.ts';
import { gameOrder, matchesView } from '../src/collection-view.ts';
const main = { id: 'main', kind: 'game', catalogId: 'igdb:game:1', status: 'completed', playtimeMinutes: 2400, lastPlayedOn: '2026-10-01' };
const dlc = { id: 'dlc', kind: 'game', catalogId: 'igdb:game:2', parentGameCatalogId: main.catalogId, status: 'active', playtimeMinutes: 600, lastPlayedOn: '2026-11-02' };

test('card reúne partes e horas sem alterar registros usados por sessões, XP e estatísticas', () => {
  const items = [main, dlc], snapshot = JSON.stringify(items);
  const cards = groupGames(items);
  assert.equal(cards.length, 1); assert.equal(cards[0].id, 'main'); assert.equal(cards[0].playtimeMinutes, 3000);
  assert.equal(cards[0].status, 'active'); assert.equal(cards[0].lastPlayedOn, '2026-11-02');
  assert.deepEqual(cards[0].gameParts.map(item => item.id), ['main', 'dlc']);
  assert.equal(cards[0].gameParts[0].playtimeMinutes, 2400); assert.equal(cards[0].gameParts[1].playtimeMinutes, 600);
  assert.equal(JSON.stringify(items), snapshot);
  assert.equal(matchesView(cards[0], 'active'), true); assert.equal(matchesView(cards[0], 'completed'), false);
  assert.equal(groupGames([main, { ...dlc, status: 'planned' }])[0].status, 'planned');
  assert.equal(groupGames([main, { ...dlc, status: 'completed' }])[0].status, 'completed');
});

test('sem principal, expansões independentes e arquivos separados continuam acessíveis', () => {
  assert.equal(groupGames([dlc])[0].id, 'dlc');
  const independent = { id: 'standalone', kind: 'game', catalogId: 'igdb:game:3', status: 'active', playtimeMinutes: 60 };
  assert.deepEqual(groupGames([main, dlc, independent]).map(item => item.id), ['main', 'standalone']);
  assert.equal(groupGames([{ ...main, archived: true }, dlc]).length, 2);
  assert.equal(groupGames([main, { ...dlc, archived: true }]).length, 2);
  const orphan = { ...dlc, parentGameCatalogId: 'igdb:game:999' }; assert.equal(groupGames([main, orphan]).length, 2);
});

test('agrupamento não duplica partes em cadeias e mantém ordenação por total de horas', () => {
  const nested = { ...dlc, id: 'nested', catalogId: 'igdb:game:4', parentGameCatalogId: dlc.catalogId, playtimeMinutes: 120 };
  const other = { ...main, id: 'other', catalogId: 'igdb:game:5', status: 'active', playtimeMinutes: 3001 };
  const cards = groupGames([nested, dlc, main, other]).sort(gameOrder);
  assert.equal(cards[0].id, 'main'); assert.equal(cards[0].playtimeMinutes, 3120); assert.equal(cards[0].gameParts.length, 3);
  const cycle = groupGames([{ ...main, parentGameCatalogId: dlc.catalogId }, dlc]); assert.equal(cycle.length, 2);
});
