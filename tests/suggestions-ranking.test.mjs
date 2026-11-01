import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSuggestions } from '../src/suggestions.ts';
test('random variety preserves relevance priority and never mutates source suggestions', () => {
  const source = [{ id: 'low', relevance: 1 }, { id: 'best', relevance: 5 }, { id: 'tie', relevance: 5 }, { id: 'medium', relevance: 3 }];
  for (let i = 0; i < 30; i++) {
    const result = rankSuggestions(source);
    assert.deepEqual(result.map(item => item.relevance), [5, 5, 3, 1]);
    assert.equal(new Set(result.map(item => item.id)).size, 4);
  }
  assert.deepEqual(source.map(item => item.id), ['low','best','tie','medium']);
});
