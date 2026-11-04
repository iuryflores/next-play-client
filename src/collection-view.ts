import { upcomingRelease, type ReleaseInfo } from './release-status.ts';
type CollectionItem = ReleaseInfo & {
  kind: string;
  status: string;
  archived?: boolean;
  rewatchWanted?: boolean;
  rewatching?: boolean;
  watchedBefore?: boolean;
  caughtUp?: boolean;
  inProgress?: boolean;
  episodeProgress?: { watched: number };
};

export function priorityOrder(
  a: { priority?: string },
  b: { priority?: string },
) {
  const weight = (value?: string) =>
    value === 'high' ? 3 : value === 'medium' ? 2 : value === 'low' ? 1 : 0;
  // Só Para depois usa este comparador; os demais critérios desempatarão na mesma prioridade.
  return weight(b.priority) - weight(a.priority);
}

export function backlogOrder(
  a: { priority?: string; releaseDate?: string; year?: string },
  b: { priority?: string; releaseDate?: string; year?: string },
) {
  const released = (item: typeof a) => {
    const date = Date.parse(item.releaseDate || '');
    if (Number.isFinite(date)) return date;
    return /^\d{4}$/.test(item.year || '')
      ? Date.parse(`${item.year}-01-01`)
      : Number.MIN_SAFE_INTEGER;
  };
  // Prioridade primeiro; dentro do grupo, lançamentos mais recentes. Sem data fica ao final.
  return priorityOrder(a, b) || released(b) - released(a);
}

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
  // A intenção aparece no backlog; a repetição ativa aparece no acompanhamento,
  // mantendo o título entre os concluídos por sua visualização anterior.
  if (view === 'completed') return finished || Boolean(item.watchedBefore);
  if (item.rewatching) return view === 'all' || view === 'active';
  if (view === 'planned' && item.rewatchWanted) return true;
  const upcoming = !finished && Boolean(upcomingRelease(item));
  // Séries já iniciadas aparecem em Suas séries, sem repetir o mesmo título entre novidades.
  if (view === 'coming-soon')
    return (
      upcoming &&
      !(
        item.kind === 'series' &&
        (item.inProgress || (item.episodeProgress?.watched || 0) > 0)
      )
    );
  if (view === 'all') return !finished && !upcoming;
  if (view === 'planned' && upcoming) return false;
  return item.status === view;
}

export type OverviewStatus = 'planned' | 'active' | 'completed' | 'archived';
export const overviewStatuses: OverviewStatus[] = [
  'planned',
  'active',
  'completed',
  'archived',
];
// A visão inicial prioriza o que ainda falta iniciar ou concluir.
export const defaultOverviewStatuses: OverviewStatus[] = ['planned', 'active'];

export function matchesOverview(
  item: CollectionItem,
  statuses: readonly OverviewStatus[],
) {
  // Obras futuras ficam em Em breve; na data da estreia passam a respeitar os filtros de status.
  // Sem data ou indicação de lançamento futuro, não presumimos que a obra ainda não estreou.
  if (upcomingRelease(item)) return false;
  // Arquivamento prevalece sobre o status anterior, para não misturar itens guardados aos atuais.
  if (item.archived) return statuses.includes('archived');
  const finished =
    item.status === 'completed' ||
    (item.kind === 'series' && item.caughtUp === true);
  // Uma repetição mantém o histórico concluído e também aparece entre os títulos em andamento.
  return (
    (statuses.includes('completed') &&
      (finished || Boolean(item.watchedBefore))) ||
    (statuses.includes('active') &&
      (Boolean(item.rewatching) ||
        (!finished &&
          (item.status === 'active' ||
            Boolean(item.inProgress) ||
            (item.episodeProgress?.watched || 0) > 0)))) ||
    (statuses.includes('planned') &&
      !finished &&
      !item.rewatching &&
      !item.inProgress &&
      !(item.episodeProgress?.watched || 0) &&
      item.status === 'planned')
  );
}
