import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionBatch, suggestionCount } from '../src/suggestion-batch.ts';
const title = id => ({ catalogId: String(id) });
test('refills missing slots plus twelve without counting previously replaced slots again', async () => {
  assert.equal(suggestionCount(1, 0), 12);
  assert.equal(suggestionCount(2, 10), 14);
  assert.equal(suggestionCount(3, 24), 12);
  assert.equal(suggestionCount(3, 22), 14);
  assert.equal(suggestionCount(2, 0), 24);
  const buffer = { pending: Array.from({ length: 30 }, (_, i) => title(i + 12)), next: null };
  const result = await suggestionBatch(buffer, async () => { throw Error('Should use buffer'); }, () => false, new AbortController().signal, suggestionCount(2, 10));
  assert.equal(result.results.length, 14);
  assert.equal(10 + result.results.length, 24);
  assert.equal(buffer.pending.length, 16);
});
test('fills twelve unique suggestions across pages and keeps leftovers for the next click', async () => {
  const buffer = { pending: [], next: 1 }, calls = [];
  const pages = { 1: [0,1,2,3], 2: [3,4,5,6,7,8], 3: [9,10,11,12,13,14,15] };
  const fetchPage = async page => { calls.push(page); return { results: pages[page].map(title), nextPage: page === 3 ? null : page + 1 }; };
  const first = await suggestionBatch(buffer, fetchPage, item => item.catalogId === '0', new AbortController().signal);
  assert.equal(first.results.length, 12); assert.deepEqual(calls, [1,2,3]); assert.equal(first.hasMore, true);
  const second = await suggestionBatch(buffer, fetchPage, item => item.catalogId === '13', new AbortController().signal);
  assert.deepEqual(second.results.map(item => item.catalogId), ['14','15']); assert.equal(second.hasMore, false); assert.equal(calls.length, 3);
});
test('failed pages can be retried without losing previously fetched suggestions', async () => {
  const buffer = { pending: [], next: 1 }, signal = new AbortController().signal;
  await assert.rejects(() => suggestionBatch(buffer, async page => { if (page === 2) throw Error('offline'); return { results: [title(1)], nextPage: 2 }; }, () => false, signal));
  assert.equal(buffer.next, 2);
  const result = await suggestionBatch(buffer, async () => ({ results: [title(2)], nextPage: null }), () => false, signal);
  assert.deepEqual(result.results.map(item => item.catalogId), ['1','2']);
});
