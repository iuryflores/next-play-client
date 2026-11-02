import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityTime } from '../src/collection-view.ts';

test('livro em leitura cede lugar a atividades mais recentes e volta ao topo quando atualizado', () => {
  const book = {
    id: 'book',
    kind: 'book',
    status: 'active',
    updatedAt: '2026-11-01T12:00:00Z',
  };
  const series = {
    id: 'series',
    kind: 'series',
    inProgress: true,
    updatedAt: '2026-10-01T12:00:00Z',
    lastWatchedAt: '2026-11-02T12:00:00Z',
  };
  const game = {
    id: 'game',
    kind: 'game',
    status: 'active',
    updatedAt: '2026-11-02T13:00:00Z',
  };
  const ordered = [book, series, game].sort(
    (a, b) => activityTime(b) - activityTime(a),
  );
  assert.deepEqual(
    ordered.map((item) => item.id),
    ['game', 'series', 'book'],
  );
  const updatedBook = { ...book, updatedAt: '2026-11-02T14:00:00Z' };
  assert.deepEqual(
    [series, updatedBook, game]
      .sort((a, b) => activityTime(b) - activityTime(a))
      .map((item) => item.id),
    ['book', 'game', 'series'],
  );
  assert.equal(book.updatedAt, '2026-11-01T12:00:00Z');
});
test('atividade usa datas válidas e não confunde ano de lançamento com recência', () => {
  assert.equal(
    activityTime({
      updatedAt: 'invalid',
      lastWatchedAt: '2026-11-02T12:00:00Z',
    }),
    Date.parse('2026-11-02T12:00:00Z'),
  );
  assert.equal(activityTime({}), 0);
  assert.equal(
    activityTime({ lastWatchedAt: 'invalid', updatedAt: 'invalid' }),
    0,
  );
});
