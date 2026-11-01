import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upcomingRelease } from '../src/release-status.ts';
test('coming soon uses full dates, future years and known unreleased status without guessing missing dates', () => {
  const today = '2026-09-07';
  assert.deepEqual(upcomingRelease({ releaseDate: '2026-09-08' }, today), { date: '2026-09-08' });
  assert.equal(upcomingRelease({ releaseDate: today, unreleased: true }, today), null);
  assert.equal(upcomingRelease({ releaseDate: '2020-01-01' }, today), null);
  assert.deepEqual(upcomingRelease({ year: '2027' }, today), {});
  assert.deepEqual(upcomingRelease({ unreleased: true }, today), {});
  assert.equal(upcomingRelease({}, today), null);
  assert.equal(upcomingRelease({ year: '2026' }, today), null);
  assert.equal(upcomingRelease({ releaseDate: '2027-02-30' }, today), null);
});
