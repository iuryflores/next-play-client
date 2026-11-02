import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTime, remainingEstimate } from '../src/game-estimate.ts';

test('restante estimado não inventa conclusão e respeita ausência de dados e jogos concluídos', () => {
  assert.equal(remainingEstimate(1800, 720, false), 1080);
  assert.equal(estimateTime(1080), '18h 00min');
  assert.equal(remainingEstimate(1800, 2000, false), 0);
  assert.equal(remainingEstimate(null, 720, false), null);
  assert.equal(remainingEstimate(0, 720, false), null);
  assert.equal(remainingEstimate(1800, 720, true), null);
  assert.equal(remainingEstimate(1800, 0, false), 1800);
  assert.equal(estimateTime(290), '4h 50min');
});
