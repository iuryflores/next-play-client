import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exploreSelection } from '../src/suggestions.ts';
import { suggestionBatch } from '../src/suggestion-batch.ts';

test('seleção TMDB preserva afinidade/popularidade e prioriza novidades sem duplicar títulos', () => {
  const ranked = Array.from({ length: 20 }, (_, i) => ({
    catalogId: String(i),
  }));
  const first = exploreSelection(ranked, [], 12, true);
  assert.deepEqual(first.results, ranked.slice(0, 12));
  const next = exploreSelection(
    ranked,
    first.results.map((item) => item.catalogId),
    12,
    true,
  );
  assert.deepEqual(next.results.slice(0, 8), ranked.slice(12));
  assert.deepEqual(next.results.slice(8), ranked.slice(0, 4));
  assert.equal(
    new Set([...next.results, ...next.pending].map((item) => item.catalogId))
      .size,
    20,
  );
  assert.deepEqual(
    ranked.map((item) => item.catalogId),
    Array.from({ length: 20 }, (_, i) => String(i)),
  );
});

test('páginas sem obras novas preservam o cursor sem disparar consultas ilimitadas', async () => {
  const buffer = { pending: [], next: 1 };
  const pages = [];
  const result = await suggestionBatch(
    buffer,
    async (page) => {
      pages.push(page);
      return { results: [{ catalogId: 'already-saved' }], nextPage: page + 1 };
    },
    () => true,
    new AbortController().signal,
    12,
    3,
  );
  assert.deepEqual(pages, [1, 2, 3]);
  assert.deepEqual(result.results, []);
  assert.equal(buffer.next, 4);
  assert.equal(result.hasMore, true);
});

test('Explorar varia as obras entre visitas, sem repetir a seleção anterior quando há alternativas', () => {
  const source = Array.from({ length: 40 }, (_, n) => ({
    catalogId: 'movie:' + n,
  }));
  const before = source.map((x) => x.catalogId);
  const first = exploreSelection(source);
  const recent = first.results.map((x) => x.catalogId);
  const next = exploreSelection(source, recent);
  assert.equal(first.results.length, 12);
  assert.equal(next.results.length, 12);
  assert.ok(next.results.every((x) => !recent.includes(x.catalogId)));
  assert.equal(
    new Set([...next.results, ...next.pending].map((x) => x.catalogId)).size,
    40,
  );
  assert.deepEqual(
    source.map((x) => x.catalogId),
    before,
  );
});

test('catálogo pequeno não perde títulos nem duplica resultados para completar a grade', () => {
  const source = [
    { catalogId: 'one' },
    { catalogId: 'one' },
    { catalogId: 'two' },
  ];
  const selection = exploreSelection(source, ['one', 'two']);
  assert.deepEqual(selection.results.map((x) => x.catalogId).sort(), [
    'one',
    'two',
  ]);
  assert.equal(selection.pending.length, 0);
});
