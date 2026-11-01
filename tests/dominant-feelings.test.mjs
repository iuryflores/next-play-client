import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dominantSeriesFeelings } from '../src/dominant-feelings.ts';
test('keeps the most frequent feeling per show, ties and movie feelings', () => {
  const sources = [
    { itemId: 'gotham', kind: 'series', feeling: 'liked', count: 3 },
    { itemId: 'gotham', kind: 'series', feeling: 'happy', count: 1 },
    { itemId: 'supernatural', kind: 'series', feeling: 'happy', count: 15 },
    { itemId: 'supernatural', kind: 'series', feeling: 'scared', count: 15 },
    { itemId: 'supernatural', kind: 'series', feeling: 'liked', count: 2 },
    { itemId: 'movie', kind: 'movie', feeling: 'liked', count: 1 },
  ];
  assert.deepEqual(dominantSeriesFeelings(sources), [sources[0], sources[2], sources[3], sources[5]]);
  assert.deepEqual(dominantSeriesFeelings([]), []);
});
