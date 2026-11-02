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
  return Math.max(
    0,
    ...[item.lastWatchedAt, item.updatedAt, item.completedAt].map((value) => {
      const time = Date.parse(value || '');
      return Number.isFinite(time) ? time : 0;
    }),
  );
}

export function gameOrder(
  a: { status: string; playtimeMinutes?: number },
  b: { status: string; playtimeMinutes?: number },
) {
  const minutes = (value?: number) =>
    Number.isFinite(value) && value! > 0 ? value! : 0;
  // O acompanhamento em andamento vem primeiro; o tempo acumulado desempata dentro de cada grupo.
  return (
    Number(b.status === 'active') - Number(a.status === 'active') ||
    minutes(b.playtimeMinutes) - minutes(a.playtimeMinutes)
  );
}

type OverviewItem = CollectionItem & {
  id: string;
  lastWatchedAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

export function overviewOrder() {
  const watchedTime = (item: OverviewItem) => {
    const time = Date.parse(item.lastWatchedAt || '');
    return Number.isFinite(time) ? time : 0;
  };
  // Todas as séries já assistidas vêm por recência, seguidas dos livros em leitura.
  const priority = (item: OverviewItem) =>
    item.kind === 'series' && watchedTime(item) > 0
      ? 0
      : item.kind === 'book' && item.status === 'active'
        ? 1
        : 2;
  const releaseTime = (item: OverviewItem) => {
    const date = Date.parse(item.releaseDate || '');
    if (Number.isFinite(date)) return date;
    // Sem data completa, o ano representa o início do ano; sem ambos, fica no fim.
    return /^\d{4}$/.test(item.year || '')
      ? Date.parse(`${item.year}-01-01`)
      : -Infinity;
  };
  return (a: OverviewItem, b: OverviewItem) =>
    priority(a) - priority(b) ||
    (priority(a) === 0 ? watchedTime(b) - watchedTime(a) : 0) ||
    (priority(a) === 1 ? activityTime(b) - activityTime(a) : 0) ||
    releaseTime(b) - releaseTime(a);
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
