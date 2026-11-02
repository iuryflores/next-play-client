import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSuggestionPage } from '../src/suggestions.ts';

test('novidades ficam depois dos cards vistos, mesmo com lançamento mais recente', () => {
  const visible = [{ catalogId: 'old', year: 2000 }, { catalogId: 'recent', year: 2020 }];
  const incoming = [{ catalogId: 'new', year: 2026 }, { catalogId: 'older', year: 1990 }];
  assert.deepEqual(appendSuggestionPage(visible, incoming).map(item => item.catalogId),
    ['old', 'recent', 'new', 'older']);
  assert.equal(visible.length, 2);
  assert.equal(incoming.length, 2);
});

test('páginas sobrepostas não substituem cards existentes nem repetem novidades', () => {
  const saved = { catalogId: 'saved', title: 'Card já visto' };
  const next = { catalogId: 'next', title: 'Novidade' };
  const result = appendSuggestionPage([saved], [
    { catalogId: 'saved', title: 'Outro metadado' }, next, next,
  ]);
  assert.deepEqual(result, [saved, next]);
  assert.equal(result[0], saved);
  assert.deepEqual(appendSuggestionPage(result, [next]), result);
});

test('nova consulta pode reiniciar a lista sem carregar cards da anterior', () => {
  const next = { catalogId: 'new-query' };
  assert.deepEqual(appendSuggestionPage([], [next, next]), [next]);
});
