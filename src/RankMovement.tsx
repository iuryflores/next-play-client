import { t } from './i18n';
export type RankingChanges = Record<string, Record<string, number | null>>;
export const rankingKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
export default function RankMovement({
  changes,
  ranking,
  id,
}: {
  changes?: RankingChanges;
  ranking: string;
  id: string | number;
}) {
  const value = changes?.[ranking]?.[id];
  const label =
    value === undefined
      ? t('Sem comparação anterior')
      : value === null
        ? t('Novo no ranking')
        : value > 0
          ? t('Subiu {0} posições', value)
          : value < 0
            ? t('Caiu {0} posições', -value)
            : t('Sem mudança de posição');
  return (
    <span
      className={`rank-movement ${value === null ? 'new' : value === undefined || value === 0 ? 'same' : value > 0 ? 'up' : 'down'}`}
      title={label}
      aria-label={label}
    >
      {value === undefined || value === 0
        ? '—'
        : value === null
          ? t('Novo')
          : `${value > 0 ? '↑' : '↓'} ${Math.abs(value)}`}
    </span>
  );
}
