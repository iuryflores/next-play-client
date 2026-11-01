import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookSearchMode } from '../src/book-search-state.ts';

test('sugestões iniciais retornam ao limpar e título/autor exigem dois caracteres', () => {
  assert.equal(bookSearchMode('', 'title'), 'suggestions');
  assert.equal(bookSearchMode('   ', 'isbn'), 'suggestions');
  assert.equal(bookSearchMode('D', 'title'), 'idle');
  assert.equal(bookSearchMode('Do', 'title'), 'search');
  assert.equal(bookSearchMode('Clarice', 'author'), 'search');
});
test('busca automática por ISBN só consulta número completo com dígito válido', () => {
  for (const value of ['978', '978858285035', '9788582850351', 'abc']) assert.equal(bookSearchMode(value, 'isbn'), 'idle');
  for (const value of ['9788582850350', '978-85-8285-035-0', '0-306-40615-2']) assert.equal(bookSearchMode(value, 'isbn'), 'search');
});
