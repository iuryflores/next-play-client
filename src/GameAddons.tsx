import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ImageOff } from 'lucide-react';
import { ApiError } from './auth';
import { libraryRequest, statusNames, type LibraryItem } from './library';
import type { CatalogTitle } from './CatalogSearch';
import { dateLabel, t } from './i18n';
import { gameDuration } from './game-session-client';
import ReleaseBadge from './ReleaseBadge';
import './game-addons.css';

type Addon = CatalogTitle & {
  contentType: 'dlc' | 'expansion' | 'standalone-expansion';
};
type Data = {
  trackedParts?: LibraryItem[];
  supported: boolean;
  results: Addon[];
  nextPage: number | null;
  total: number;
};
export default function GameAddons({
  item,
  items,
  changed,
  open,
  onExpired,
}: {
  item: LibraryItem;
  items: LibraryItem[];
  changed: (item: LibraryItem) => void;
  open: (id: string) => void;
  onExpired: () => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef(false);
  const loadingMore = useRef(false);
  const [pageError, setPageError] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const expired = useEffectEvent(onExpired);
  async function fetchPage(page: number, signal?: AbortSignal): Promise<Data> {
    const response = await fetch(
      `/api/library/${encodeURIComponent(item.id)}/game-addons?page=${page}`,
      {
        credentials: 'same-origin',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
          : AbortSignal.timeout(20000),
      },
    );
    const result = await response.json().catch(() => null);
    if (!response.ok || !result)
      throw new ApiError(
        response.status,
        t('Não foi possível carregar expansões e DLCs.'),
      );
    return result;
  }
  const read = useEffectEvent(fetchPage);
  const adopt = useEffectEvent((value: Data) => {
    for (const part of value.trackedParts || []) {
      if (
        items.find((owned) => owned.id === part.id)?.parentGameCatalogId !==
        part.parentGameCatalogId
      )
        changed(part);
    }
    for (const title of value.results) {
      const owned = items.find((part) => part.catalogId === title.catalogId);
      if (
        owned &&
        title.contentType !== 'standalone-expansion' &&
        owned.parentGameCatalogId !== item.catalogId
      )
        changed({ ...owned, parentGameCatalogId: item.catalogId });
    }
  });
  useEffect(() => {
    const controller = new AbortController();
    void read(1, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setData(value);
        adopt(value);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(t('Não foi possível carregar expansões e DLCs.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [item.id, retry]);
  async function more() {
    if (!data?.nextPage || loadingMore.current) return;
    loadingMore.current = true;
    setMoreBusy(true);
    setPageError(false);
    try {
      const next = await fetchPage(data.nextPage);
      setData((current) =>
        current
          ? {
              ...next,
              results: [
                ...new Map(
                  [...current.results, ...next.results].map((title) => [
                    title.catalogId,
                    title,
                  ]),
                ).values(),
              ],
            }
          : next,
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setPageError(true);
    } finally {
      loadingMore.current = false;
      setMoreBusy(false);
    }
  }
  async function add(title: Addon) {
    if (pending.current) return;
    pending.current = true;
    setBusy(title.catalogId);
    setError('');
    try {
      // Cada conteúdo possui identidade própria: adicionar não conclui nem muda o jogo principal.
      const result = await libraryRequest<{ item: LibraryItem }>('POST', '', {
        title: title.title,
        kind: 'game',
        catalogId: title.catalogId,
        status: 'planned',
      });
      changed({
        ...result.item,
        ...(title.contentType !== 'standalone-expansion'
          ? { parentGameCatalogId: item.catalogId }
          : {}),
      });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else if (reason instanceof ApiError && reason.status === 409) {
        try {
          const result = await libraryRequest<{ items: LibraryItem[] }>();
          const existing = result.items.find(
            (item) => item.catalogId === title.catalogId,
          );
          if (existing)
            changed({
              ...existing,
              ...(title.contentType !== 'standalone-expansion'
                ? { parentGameCatalogId: item.catalogId }
                : {}),
            });
          else
            setError(
              t('Não foi possível adicionar o conteúdo. Tente novamente.'),
            );
        } catch {
          setError(
            t('Não foi possível adicionar o conteúdo. Tente novamente.'),
          );
        }
      } else
        setError(t('Não foi possível adicionar o conteúdo. Tente novamente.'));
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  return (
    <section className="game-addons" aria-label={t('Expansões e DLCs')}>
      <h2>{t('Expansões e DLCs')}</h2>
      <p className="game-addons-note">
        {t('Acompanhe cada conteúdo separadamente do jogo principal.')}
      </p>
      {loading ? (
        <output>{t('Carregando conteúdos adicionais…')}</output>
      ) : !data ? (
        <Button
          variant="outline"
          onClick={() => {
            setError('');
            setLoading(true);
            setRetry((value) => value + 1);
          }}
        >
          {t('Tentar novamente')}
        </Button>
      ) : (
        <>
          {!data.results.length && !data.nextPage && (
            <p>
              {t(
                data.supported
                  ? 'Nenhuma expansão ou DLC informada pela IGDB para este jogo.'
                  : 'Conteúdos adicionais indisponíveis para jogos sem vínculo com a IGDB.',
              )}
            </p>
          )}
          <div className="game-addons-grid">
            {data.results.map((title) => {
              const owned = items.find(
                (item) => item.catalogId === title.catalogId,
              );
              return (
                <article key={title.catalogId} className="game-addon-card">
                  <div className="game-addon-cover">
                    {title.coverUrl ? (
                      <img
                        src={title.coverUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageOff aria-hidden="true" />
                    )}
                    <ReleaseBadge item={title} />
                  </div>
                  <div className="game-addon-info">
                    <span className="game-addon-type">
                      {t(
                        title.contentType === 'dlc'
                          ? 'DLC'
                          : title.contentType === 'expansion'
                            ? 'Expansão'
                            : 'Expansão independente',
                      )}
                    </span>
                    <h3>{title.title}</h3>
                    <small>
                      {title.releaseDate
                        ? dateLabel(title.releaseDate)
                        : title.year || t('Data não informada')}
                    </small>
                    {owned ? (
                      <>
                        <small>
                          {gameDuration(owned.playtimeMinutes || 0)}
                        </small>
                        <small>
                          {owned.archived
                            ? t('Arquivado')
                            : statusNames.game[owned.status]}
                        </small>
                        <Button
                          variant="outline"
                          onClick={() => open(owned.id)}
                        >
                          {t('Ver acompanhamento')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void add(title)}
                      >
                        <Plus aria-hidden="true" />
                        {t(
                          busy === title.catalogId
                            ? 'Salvando…'
                            : 'Adicionar a Para depois',
                        )}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {pageError && (
            <p role="alert">
              {t('Não foi possível carregar mais conteúdos. Tente novamente.')}
            </p>
          )}
          {data.nextPage && (
            <Button
              variant="outline"
              disabled={moreBusy}
              onClick={() => void more()}
            >
              {t(
                moreBusy
                  ? 'Carregando…'
                  : pageError
                    ? 'Tentar novamente'
                    : 'Ver mais conteúdos',
              )}
            </Button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="game-addons-source">
        <a href="https://www.igdb.com" target="_blank" rel="noreferrer">
          {t('Fonte: IGDB')}
        </a>
      </p>
    </section>
  );
}
