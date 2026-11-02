import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingExploreSlots, explorePageSize } from '../src/explore-grid.ts';
import { suggestionBatch } from '../src/suggestion-batch.ts';

test('grade de cinco colunas completa os três espaços e arredonda os próximos lotes', () => {
  assert.equal(missingExploreSlots(12, 5), 3);
  assert.equal(missingExploreSlots(15, 5), 0);
  assert.equal(explorePageSize(15, 5), 15);
  assert.equal(explorePageSize(12, 5), 13);
  assert.equal(missingExploreSlots(20, 3), 1);
  assert.equal(explorePageSize(21, 3, 20), 21);
  for (let columns = 1; columns <= 8; columns++)
    for (let count = 0; count < 100; count++) {
      const missing = missingExploreSlots(count, columns);
      assert.ok(missing >= 0 && missing < columns);
      assert.equal((count + missing) % columns, 0);
      const batch = explorePageSize(count, columns);
      assert.ok(batch >= 12);
      assert.equal((count + batch) % columns, 0);
    }
});

test('preenchimento usa só a reserva necessária e completa outra coluna ao redimensionar', async () => {
  const original = Array.from({ length: 12 }, (_, i) => ({
    catalogId: String(i),
  }));
  const buffer = {
    pending: Array.from({ length: 8 }, (_, i) => ({
      catalogId: String(i + 12),
    })),
    next: null,
  };
  const fetch = async () => {
    throw Error('A reserva já cobre os espaços faltantes');
  };
  const first = await suggestionBatch(
    buffer,
    fetch,
    () => false,
    new AbortController().signal,
    missingExploreSlots(original.length, 5),
  );
  const visible = [...original, ...first.results];
  assert.equal(visible.length, 15);
  assert.deepEqual(visible.slice(0, 12), original);
  assert.equal(buffer.pending.length, 5);
  const resized = await suggestionBatch(
    buffer,
    fetch,
    () => false,
    new AbortController().signal,
    missingExploreSlots(visible.length, 4),
  );
  assert.equal(resized.results.length, 1);
  assert.equal(visible.length + resized.results.length, 16);
  assert.equal(
    new Set([...visible, ...resized.results].map((x) => x.catalogId)).size,
    16,
  );
});

test('fim do catálogo mantém os títulos reais restantes, sem inventar ou repetir para preencher', async () => {
  const buffer = { pending: [{ catalogId: 'last' }], next: null };
  const result = await suggestionBatch(
    buffer,
    async () => {
      throw Error('Sem próxima página');
    },
    () => false,
    new AbortController().signal,
    3,
  );
  assert.deepEqual(result.results, [{ catalogId: 'last' }]);
  assert.equal(result.hasMore, false);
});
