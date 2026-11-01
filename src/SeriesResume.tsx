import { t } from './i18n';
import { useEffect, useEffectEvent, useState } from 'react';
import { CirclePlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from './auth';
import type { LibraryItem } from './library';
import { request, resume } from './episode-client';
// Serialize automatic imports so a collection does not flood the catalog on mount.
let queue: Promise<unknown> = Promise.resolve();
export default function SeriesResume({
  item,
  compact = false,
  edit,
  onProgress,
  onExpired,
}: {
  item: LibraryItem;
  compact?: boolean;
  edit: (item: LibraryItem) => void;
  onProgress: () => void;
  onExpired: () => void;
}) {
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const progress = item.episodeProgress;
  const supported = !!item.catalogId?.startsWith('tmdb:series:');
  const needsLoad =
    supported &&
    (!progress?.initialized ||
      progress.next?.episode === null ||
      (item.status === 'completed' && !item.episodesCompletedAt));
  const updated = useEffectEvent(onProgress);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    if (!needsLoad) return;
    let active = true;
    const task = queue
      .then(async () => {
        if (!active) return;
        const data =
          item.status === 'completed' && !item.episodesCompletedAt
            ? await request(item.id, 'POST', {}, 'complete')
            : await request(item.id);
        const result = await resume(item.id, data, () => active);
        if (!active) return;
        if (!result.seasons.some((season) => season.number > 0))
          setError(t('O catálogo ainda não tem episódios para esta série.'));
        else {
          setError('');
          updated();
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(t('Não foi possível carregar o episódio agora.'));
      });
    queue = task;
    return () => {
      active = false;
    };
  }, [item.id, item.status, item.episodesCompletedAt, needsLoad, retry]);
  const next = progress?.next;
  const future =
    !!next?.airDate && next.airDate > new Date().toISOString().slice(0, 10);
  if (compact) return null;
  return (
    <div>
      <button
        className={`series-resume ${compact ? 'compact' : ''}`}
        onClick={() => edit(item)}
        aria-busy={needsLoad && !error}
      >
        <CirclePlay size={17} aria-hidden="true" />
        <span>
          <strong>
            {!supported
              ? t('Série manual · sem lista de episódios')
              : error ||
                (needsLoad
                  ? t('Carregando seu episódio…')
                  : next
                    ? t(
                        '{0}: T{1} · E{2}',
                        future
                          ? t('Aguardando estreia')
                          : t('Continuar assistindo'),
                        next.season,
                        next.episode,
                      )
                    : t('Em dia com os episódios'))}
          </strong>
          {!compact && !needsLoad && next?.name && <small>{next.name}</small>}
          {!compact && progress?.initialized && (
            <small>
              {progress.watched} {t(' de ')}
              {progress.total} {t(' episódios assistidos ')}
            </small>
          )}
        </span>
      </button>
      {error && (
        <Button
          variant="link"
          onClick={() => {
            setError('');
            setRetry((value) => value + 1);
          }}
        >
          {t(' Tentar novamente ')}
        </Button>
      )}
    </div>
  );
}
