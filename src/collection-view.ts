import { upcomingRelease, type ReleaseInfo } from './release-status.ts';
type CollectionItem = ReleaseInfo & {
  kind: string;
  status: string;
  archived?: boolean;
  caughtUp?: boolean;
};

export function matchesView(item: CollectionItem, view: string) {
  if (view === 'archived') return Boolean(item.archived);
  if (item.archived) return false;
  const finished =
    item.status === 'completed' ||
    (item.kind === 'series' && item.caughtUp === true);
  if (view === 'completed') return finished;
  const upcoming = !finished && Boolean(upcomingRelease(item));
  if (view === 'coming-soon') return upcoming;
  if (view === 'all') return !finished && !upcoming;
  if (view === 'planned' && upcoming) return false;
  return item.status === view;
}
