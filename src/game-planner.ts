import {
  remainingEstimate,
  type EstimateMode,
  type GameEstimateData,
} from './game-estimate.ts';
export type PlannerGame = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  platform?: string;
  genres?: string[];
  coverUrl?: string;
  unreleased?: boolean;
  releaseDate?: string;
  parentGameCatalogId?: string;
  catalogId?: string;
  playtimeMinutes?: number;
  estimate: GameEstimateData | null;
  estimateFailed: boolean;
};
export function plannerSummary(items: PlannerGame[], mode: EstimateMode) {
  let minutes = 0,
    known = 0,
    failed = 0;
  for (const item of items) {
    const left = remainingEstimate(
      item.estimate?.[mode] ?? null,
      item.playtimeMinutes || 0,
      false,
    );
    if (item.estimateFailed) failed++;
    if (left !== null) {
      minutes += left;
      known++;
    }
  }
  return { minutes, known, unknown: items.length - known, failed };
}
export function recommendGames(
  items: PlannerGame[],
  mode: EstimateMode,
  budget: number,
  platform: string,
  genre: string,
  today: string,
) {
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
  // Horas restantes descrevem o jogo inteiro, não a duração de uma sessão. Sem média não há promessa de caber.
  return items
    .filter(
      (item) =>
        !item.unreleased &&
        (!item.releaseDate || item.releaseDate <= today) &&
        (!platform || item.platform === platform) &&
        (!genre || item.genres?.includes(genre)),
    )
    .map((item) => ({
      item,
      remaining: remainingEstimate(
        item.estimate?.[mode] ?? null,
        item.playtimeMinutes || 0,
        false,
      ),
    }))
    .filter(
      (row) =>
        !budget ||
        (row.remaining !== null &&
          row.remaining > 0 &&
          row.remaining <= budget),
    )
    .sort(
      (a, b) =>
        (rank[b.item.priority || 'none'] || 0) -
          (rank[a.item.priority || 'none'] || 0) ||
        Number(b.item.status === 'active') -
          Number(a.item.status === 'active') ||
        (a.remaining ?? Infinity) - (b.remaining ?? Infinity) ||
        a.item.title.localeCompare(b.item.title) ||
        a.item.id.localeCompare(b.item.id),
    )
    .slice(0, 5);
}
