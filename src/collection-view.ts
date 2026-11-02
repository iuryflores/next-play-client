import { upcomingRelease, type ReleaseInfo } from './release-status.ts';
type CollectionItem = ReleaseInfo & {
  kind: string;
  status: string;
  archived?: boolean;
  caughtUp?: boolean;
};

export function activityTime(item: {
  lastWatchedAt?: string;
  updatedAt?: string;
  completedAt?: string;
}) {
  // Livros iniciados e episódios vistos entram na mesma sequência de atividade;
  // estar "Lendo" não fixa uma obra acima de tudo que aconteceu depois.
  return Math.max(
    0,
    ...[item.lastWatchedAt, item.updatedAt, item.completedAt].map((value) => {
      const time = Date.parse(value || '');
      return Number.isFinite(time) ? time : 0;
    }),
  );
}

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
