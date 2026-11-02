import { Button } from '@/components/ui/button';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { dateLabel, t } from './i18n';
import type { LibraryItem } from './library';
export const watchedTime = (item: LibraryItem) => {
  const value = Date.parse(item.lastWatchedAt || '');
  return Number.isFinite(value) ? value : 0;
};
export const hasWatched = (item: LibraryItem) =>
  ['movie', 'series'].includes(item.kind) &&
  (watchedTime(item) > 0 ||
    item.status === 'completed' ||
    (item.episodeProgress?.watched || 0) > 0);
export function WatchedWhen({ item }: { item: LibraryItem }) {
  return (
    <small className="watched-when">
      {item.lastWatchedEpisode
        ? t(
            'T{0} E{1}',
            item.lastWatchedEpisode.season,
            item.lastWatchedEpisode.episode,
          ) + ' · '
        : ''}
      {item.lastWatchedAt
        ? dateLabel(item.lastWatchedAt)
        : t('Data desconhecida')}
    </small>
  );
}
export default function RecentWatched({
  items,
  open,
  more,
}: {
  items: LibraryItem[];
  open: (id: string) => void;
  more: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [capacity, setCapacity] = useState(5);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const recent = items
    // Sem data conhecida, o consumo pertence ao histórico, não à faixa de recentes.
    .filter(
      (item) => !item.archived && hasWatched(item) && watchedTime(item) > 0,
    )
    .sort(
      (a, b) => watchedTime(b) - watchedTime(a) || a.id.localeCompare(b.id),
    );
  const hasRecent = recent.length > 0;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // A quantidade acompanha a largura real da coleção, preservando uma única linha de capas pequenas.
    const observer = new ResizeObserver(([entry]) => {
      setCapacity(Math.max(1, Math.ceil((entry.contentRect.width + 12) / 144)));
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [hasRecent]);
  if (!recent.length) return null;
  return (
    <section
      className={`recent-watched${expanded ? '' : ' recent-watched-collapsed'}`}
    >
      <header className="collection-toolbar">
        <h2>{t('Últimos assistidos')}</h2>
        <div className="recent-watched-actions">
          <Button type="button" variant="ghost" onClick={more}>
            {t('Ver histórico completo')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown
              className="recent-collapse-chevron"
              aria-hidden="true"
            />
            {t(expanded ? 'Recolher' : 'Expandir')}
          </Button>
        </div>
      </header>
      <div
        className="recent-watched-reveal"
        id={listId}
        inert={!expanded}
        aria-hidden={!expanded}
      >
        <div className="recent-watched-reveal-inner">
          <div
            className="recent-watched-list"
            ref={listRef}
            style={{
              gridTemplateColumns: `repeat(${capacity}, minmax(0, 1fr))`,
            }}
          >
            {recent.slice(0, capacity).map((item) => (
              <button
                key={item.id}
                onClick={() => open(item.id)}
                className="recent-watched-card"
                aria-label={t('Ver detalhes de {0}', item.title)}
                title={item.title}
              >
                <span className="recent-cover-frame">
                  {item.coverUrl && (
                    <img src={item.coverUrl} alt="" loading="lazy" />
                  )}
                  <WatchedWhen item={item} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
