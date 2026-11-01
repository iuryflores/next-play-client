import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { feelings } from './Review';
import { t } from './i18n';
import { dominantSeriesFeelings } from './dominant-feelings';
import { orderRanking } from './stats-summary';
import RankMovement, { type RankingChanges } from './RankMovement';
export type FeelingSource = {
  itemId: string;
  title: string;
  kind: string;
  feeling: string;
  count: number;
};

export default function FeelingSources({
  sources,
  rankingChanges,
  rankingPositions,
}: {
  sources: FeelingSource[];
  rankingChanges?: RankingChanges;
  rankingPositions?: Record<string, Record<string, number>>;
}) {
  const [limits, setLimits] = useState<Record<string, number>>({});
  const groups = new Map<string, FeelingSource[]>();
  for (const source of dominantSeriesFeelings(sources))
    groups.set(source.feeling, [...(groups.get(source.feeling) || []), source]);
  const count = (entries: FeelingSource[]) =>
    entries.reduce((sum, source) => sum + source.count, 0);
  return (
    <article className="series-feelings">
      <h3>{t('Seus sentimentos')}</h3>
      <p>
        {t(
          'Sentimento mais frequente de cada série e quantos episódios receberam esse sentimento. Empates são mantidos.',
        )}
      </p>
      {groups.size ? (
        orderRanking(
          [...groups].sort(
            (a, b) => count(b[1]) - count(a[1]) || a[0].localeCompare(b[0]),
          ),
          rankingPositions?.['series:feelings'],
          (entry) => entry[0],
        ).map(([feeling, entries]) => (
          <div className="feeling-source-group" key={feeling}>
            <div className="series-feeling-row">
              <strong>{feelings[feeling] || feeling}</strong>
              <RankMovement
                changes={rankingChanges}
                ranking="series:feelings"
                id={feeling}
              />
              <span>{t('{0} avaliações', count(entries))}</span>
            </div>
            <ul className="feeling-source-list">
              {orderRanking(
                [...entries].sort(
                  (a, b) => b.count - a.count || a.title.localeCompare(b.title),
                ),
                rankingPositions?.[`series:feeling:${feeling}`],
                (entry) => entry.itemId,
              )
                .slice(0, limits[feeling] || 3)
                .map((source) => (
                  <li key={source.itemId}>
                    <RankMovement
                      changes={rankingChanges}
                      ranking={`series:feeling:${feeling}`}
                      id={source.itemId}
                    />
                    <span>{source.title}</span>
                    <small>
                      {source.kind === 'series'
                        ? t('{0} episódios', source.count)
                        : t('Filmes') +
                          ' · ' +
                          t('{0} avaliações', source.count)}
                    </small>
                  </li>
                ))}
            </ul>
            {entries.length > (limits[feeling] || 3) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setLimits((current) => ({
                    ...current,
                    [feeling]: (current[feeling] || 3) + 5,
                  }))
                }
              >
                {t('Ver mais títulos')}
              </Button>
            )}
            {(limits[feeling] || 3) > 3 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setLimits((current) => ({ ...current, [feeling]: 3 }))
                }
              >
                {t('Ver menos')}
              </Button>
            )}
          </div>
        ))
      ) : (
        <p>{t('Nenhum sentimento registrado ainda.')}</p>
      )}
    </article>
  );
}
