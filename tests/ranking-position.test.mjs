import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderRanking } from '../src/stats-summary.ts';
test('the UI uses unique positions from the movement comparison', () => {
  const entries = [{ id: 'brad', count: 5 }, { id: 'angelina', count: 5 }, { id: 'ian', count: 5 }];
  assert.deepEqual(orderRanking(entries, { angelina: 6, ian: 7, brad: 8 }, actor => actor.id).map(actor => actor.id), ['angelina', 'ian', 'brad']);
  assert.equal(entries[0].id, 'brad');
  assert.deepEqual(orderRanking(entries, undefined, actor => actor.id), entries);
});
