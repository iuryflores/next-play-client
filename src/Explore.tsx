import PageLoading from './PageLoading';
import { genreLabel } from './i18n';
import { t } from './i18n';
import OriginalTitle from './OriginalTitle';
import ReleaseBadge from './ReleaseBadge';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { rankSuggestions } from './suggestions';
import {
  Compass,
  BookOpen,
  Film,
  Tv,
  Gamepad2,
  ChevronDown,
  LoaderCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  categories,
  libraryRequest,
  type Kind,
  type LibraryItem,
} from './library';
import { ApiError } from './auth';
import QuickActions, { findOwned } from './QuickActions';
import type { CatalogTitle } from './CatalogSearch';

interface Section {
  nextPage?: number | null;
  source?: string;
  unavailable?: boolean;
  kind: Kind;
  personalized: boolean;
  genres: string[];
  results: (CatalogTitle & { matches: string[]; relevance?: number })[];
}
const icons = { movie: Film, series: Tv, game: Gamepad2, book: BookOpen };

export default function Explore({
  items,
  changed,
  edit,
  onExpired,
}: {
  items: LibraryItem[];
  changed: (item: LibraryItem) => void;
  edit: (item: LibraryItem) => void;
  onExpired: () => void;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState<Kind | null>(null);
  const [moreError, setMoreError] = useState<Kind | null>(null);
  const moreRequest = useRef<AbortController | null>(null);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    let active = true;
    void libraryRequest<{ sections: Section[] }>('GET', 'explore')
      .then((data) => {
        if (active) {
          setSections(
            data.sections.map((section) => ({
              ...section,
              results: rankSuggestions(section.results),
            })),
          );
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else
          setError(
            reason instanceof Error
              ? reason.message
              : t('Não foi possível carregar as sugestões.'),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      moreRequest.current?.abort();
    };
  }, [retry]);
  async function loadMore(section: Section) {
    if (moreRequest.current || !section.nextPage) return;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(section.kind);
    setMoreError(null);
    try {
      const params = new URLSearchParams({
        kind: section.kind,
        page: String(section.nextPage),
      });
      const response = await fetch(`/api/library/explore?${params}`, {
        credentials: 'same-origin',
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30000),
        ]),
      });
      if (response.status === 401) {
        onExpired();
        return;
      }
      if (!response.ok) throw Error();
      const data = (await response.json()) as { sections: Section[] };
      const incoming = data.sections.find(
        (value) => value.kind === section.kind,
      );
      if (!incoming || incoming.unavailable) throw Error();
      if (!controller.signal.aborted)
        setSections((current) =>
          current.map((value) =>
            value.kind !== section.kind
              ? value
              : {
                  ...incoming,
                  results: [
                    ...value.results,
                    ...rankSuggestions(incoming.results).filter(
                      (item) =>
                        !value.results.some(
                          (existing) => existing.catalogId === item.catalogId,
                        ),
                    ),
                  ],
                },
          ),
        );
    } catch {
      if (!controller.signal.aborted) setMoreError(section.kind);
    } finally {
      moreRequest.current = null;
      if (!controller.signal.aborted) setLoadingMore(null);
    }
  }
  return (
    <section className="explore" aria-label={t('Explorar títulos')}>
      <div
        className="explore-filters"
        aria-label={t('Categorias de sugestões')}
      >
        {(['all', 'movie', 'series', 'game', 'book'] as const).map((kind) => (
          <Button
            key={kind}
            disabled={kind === 'book'}
            variant={filter === kind ? 'default' : 'outline'}
            aria-pressed={filter === kind}
            onClick={() => setFilter(kind)}
          >
            {kind === 'all' ? t('Todos') : categories[kind]}
            {kind === 'book' && t(' — Em breve')}
          </Button>
        ))}
      </div>
      {loading ? (
        <PageLoading label={t('Carregando sugestões…')} />
      ) : error ? (
        <div role="alert" className="home-error">
          {error}
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            {t(' Tentar novamente ')}
          </Button>
        </div>
      ) : (
        sections
          .filter(
            (section) =>
              section.kind !== 'book' &&
              (filter === 'all' || section.kind === filter),
          )
          .map((section) => {
            const Icon = icons[section.kind];
            const available = section.results.filter(
              (item) => !findOwned(items, item),
            );
            return (
              <section
                className="explore-section"
                key={section.kind}
                aria-labelledby={`explore-${section.kind}`}
              >
                <div className="explore-section-heading">
                  <Icon aria-hidden="true" />
                  <div>
                    <h2 id={`explore-${section.kind}`}>
                      {categories[section.kind]}
                    </h2>
                    <p>
                      {section.personalized
                        ? t(
                            'Prioridade para {0}',
                            section.genres.map(genreLabel).join(', '),
                          )
                        : t(
                            section.source === 'tmdb'
                              ? 'Populares do TMDB. Adicione títulos para personalizar as sugestões.'
                              : 'Do catálogo do NextPlay. Adicione gêneros à sua coleção para personalizar.',
                          )}
                      {section.source === 'tmdb' &&
                        section.personalized &&
                        ' · TMDB'}
                    </p>
                  </div>
                </div>
                {available.length ? (
                  <div className="item-grid">
                    {available.map((item) => (
                      <article
                        className={`library-card ${item.kind}`}
                        key={item.catalogId}
                      >
                        <div
                          className={`item-cover ${item.coverUrl ? 'has-poster' : ''}`}
                        >
                          <ReleaseBadge item={item} />
                          <Icon aria-hidden="true" />
                          {item.coverUrl && (
                            <img
                              className="library-poster"
                              src={item.coverUrl}
                              alt={t('Capa de {0}', item.title)}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <span>{categories[item.kind]}</span>
                        </div>
                        <div className="item-info">
                          <h3>{item.title}</h3>
                          <OriginalTitle
                            title={item.title}
                            originalTitle={item.originalTitle}
                          />
                          {item.year && (
                            <small className="catalog-year">{item.year}</small>
                          )}
                          {!!item.matches.length && (
                            <p className="explore-reason">
                              {t(' Combina com seu gosto por ')}{' '}
                              {item.matches.map(genreLabel).join(', ')}
                            </p>
                          )}
                          {item.overview && (
                            <p className="explore-overview">{item.overview}</p>
                          )}
                          <QuickActions
                            title={item}
                            owned={findOwned(items, item)}
                            changed={changed}
                            edit={edit}
                            onExpired={onExpired}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="explore-empty">
                    <Compass aria-hidden="true" />
                    <p>
                      {t(
                        section.unavailable
                          ? 'Não foi possível consultar o TMDB. Tente novamente em instantes.'
                          : section.source === 'tmdb'
                            ? 'Nenhuma sugestão nova do TMDB para estas preferências no momento.'
                            : section.personalized
                              ? 'Ainda não há outros títulos no NextPlay com os gêneros da sua coleção. Use Adicionar título para descobrir novas opções.'
                              : ' Ainda não há novos títulos desta categoria fora da sua coleção. Use Adicionar título para buscar e salvar suas primeiras opções. ',
                      )}
                    </p>
                  </div>
                )}
                {moreError === section.kind && (
                  <p className="home-error" role="alert">
                    {t('Não foi possível carregar as sugestões.')}
                  </p>
                )}
                {section.nextPage != null && (
                  <div className="catalog-more-actions">
                    <Button
                      type="button"
                      variant="outline"
                      className="catalog-more-button"
                      disabled={loadingMore !== null}
                      onClick={() => void loadMore(section)}
                    >
                      {t(
                        loadingMore === section.kind
                          ? 'Carregando sugestões…'
                          : 'Ver mais sugestões',
                      )}
                      {loadingMore === section.kind ? (
                        <LoaderCircle
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                )}
              </section>
            );
          })
      )}
    </section>
  );
}
