import { RefreshCw } from 'lucide-react';
import IconAction from './IconAction';
import PageLoading from './PageLoading';
import { useEffect, useEffectEvent, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { ApiError } from './auth';
import { libraryRequest, type LibraryItem } from './library';
import { dateLabel, t } from './i18n';
type Release = {
  episode: {
    season: number;
    number: number;
    name: string;
    airDate: string;
  } | null;
  ended: boolean;
  stale: boolean;
  unsupported: boolean;
};
export default function Incoming({
  items,
  open,
  onExpired,
}: {
  items: LibraryItem[];
  open: (id: string) => void;
  onExpired: () => void;
}) {
  const [releases, setReleases] = useState<Record<string, Release | 'error'>>(
    {},
  );
  const [retry, setRetry] = useState(0);
  const expired = useEffectEvent(onExpired);
  const tracked = items.filter(
    (item) =>
      item.kind === 'series' &&
      !item.archived &&
      (item.caughtUp ||
        item.inProgress ||
        (item.episodeProgress?.watched || 0) > 0),
  );
  const ids = tracked
    .map((item) => item.id)
    .sort()
    .join(',');
  useEffect(() => {
    let active = true;
    const queue = ids.split(',').filter(Boolean);
    async function worker() {
      while (active && queue.length) {
        const id = queue.shift()!;
        try {
          const release = await libraryRequest<Release>(
            'GET',
            id,
            undefined,
            'upcoming',
          );
          if (active) setReleases((current) => ({ ...current, [id]: release }));
        } catch (reason) {
          if (!active) return;
          if (reason instanceof ApiError && reason.status === 401) {
            active = false;
            expired();
            return;
          }
          setReleases((current) => ({ ...current, [id]: 'error' }));
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
    return () => {
      active = false;
    };
  }, [ids, retry]);
  const date = (id: string) => {
    const row = releases[id];
    return row && row !== 'error' ? row.episode?.airDate || '9999' : '9999';
  };
  const loading = tracked.some((item) => !releases[item.id]);
  const visible = tracked.filter((item) => {
    const release = releases[item.id];
    return release && (release === 'error' || !release.ended);
  });
  return (
    <section className="incoming-page">
      <header className="collection-toolbar">
        <h2>{t('Episódios')}</h2>
        <IconAction
          variant="outline"
          onClick={() => {
            setReleases({});
            setRetry((value) => value + 1);
          }}
          label={t('Atualizar dados')}
          icon={RefreshCw}
        />
      </header>
      <p className="stats-note">
        {t(
          'Próximos lançamentos das séries com episódios assistidos. Datas do TMDB, atualizadas a cada 6 horas; podem mudar e variar por região.',
        )}
      </p>
      {loading && (
        <PageLoading
          label={t('Consultando lançamento…')}
          compact={visible.length > 0}
        />
      )}
      {!loading && !visible.length ? (
        <div className="collection-empty">
          <CalendarDays aria-hidden="true" />
          <p>
            {t(
              tracked.length
                ? 'Nenhuma série em acompanhamento com novos episódios previstos.'
                : 'Assista ao primeiro episódio de uma série para acompanhar os próximos lançamentos aqui.',
            )}
          </p>
        </div>
      ) : (
        <div className="incoming-list">
          {[...visible]
            .sort(
              (a, b) =>
                date(a.id).localeCompare(date(b.id)) ||
                a.title.localeCompare(b.title),
            )
            .map((item) => {
              const release = releases[item.id];
              const episode =
                release && release !== 'error' ? release.episode : null;
              return (
                <article className="incoming-card" key={item.id}>
                  <button
                    className="incoming-cover"
                    onClick={() => open(item.id)}
                    aria-label={t('Ver detalhes de {0}', item.title)}
                  >
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt="" />
                    ) : (
                      <CalendarDays aria-hidden="true" />
                    )}
                  </button>
                  <div>
                    <button
                      className="incoming-title"
                      onClick={() => open(item.id)}
                    >
                      {item.title}
                    </button>
                    <small>
                      {t(item.caughtUp ? 'Em dia' : 'Em andamento')}
                    </small>
                    {episode ? (
                      <>
                        <p>
                          {t(
                            'T{0} E{1} · {2}',
                            episode.season,
                            episode.number,
                            episode.name,
                          )}
                        </p>
                        <time dateTime={episode.airDate}>
                          {dateLabel(episode.airDate)}
                        </time>
                      </>
                    ) : (
                      <p>
                        {t(
                          !release
                            ? 'Consultando lançamento…'
                            : release === 'error'
                              ? 'Não foi possível consultar este lançamento.'
                              : release.unsupported
                                ? 'Calendário indisponível para este título.'
                                : 'O TMDB ainda não informa a data do próximo episódio.',
                        )}
                      </p>
                    )}
                    {release && release !== 'error' && release.stale && (
                      <small>
                        {t(
                          'Exibindo a última informação salva. Tente atualizar mais tarde.',
                        )}
                      </small>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      )}
    </section>
  );
}
