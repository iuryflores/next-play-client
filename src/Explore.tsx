import PageLoading from './PageLoading';
import { genreLabel } from './i18n';
import { t, language } from './i18n';
import OriginalTitle from './OriginalTitle';
import ReleaseBadge from './ReleaseBadge';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { exploreSelection, shuffleSuggestions } from './suggestions';
import { suggestionBatch } from './suggestion-batch';
import { explorePageSize, missingExploreSlots } from './explore-grid';
import {
  explorePagePlan,
  readExplorePages,
  rememberExplorePages,
} from './explore-pages';
import {
  Compass,
  BookOpen,
  Film,
  Tv,
  Gamepad2,
  ChevronDown,
  Shuffle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { categories, type Kind, type LibraryItem } from './library';
import { ApiError } from './auth';
import { findOwned } from './QuickActions';
import ExploreActions from './ExploreActions';
import type { CatalogTitle } from './CatalogSearch';
import ExploreTitleDetails from './ExploreTitleDetails';

type Suggestion = CatalogTitle & { matches: string[]; relevance?: number };
interface Section {
  nextPage?: number | null;
  totalPages?: number;
  pageOrder?: number[];
  pageSignature?: string;
  source?: string;
  unavailable?: boolean;
  kind: Kind;
  personalized: boolean;
  genres: string[];
  results: Suggestion[];
  pending?: Suggestion[];
}
const icons = { movie: Film, series: Tv, game: Gamepad2, book: BookOpen };
// Só guarda IDs públicos da última seleção desta janela; não persiste o perfil de leitura.
const recentSelections = new Map<Kind, string[]>();

async function explorePage(kind: Kind, page: number, signal: AbortSignal) {
  const response = await fetch(
    `/api/library/explore?${new URLSearchParams({ kind, page: String(page) })}`,
    {
      credentials: 'same-origin',
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    },
  );
  if (!response.ok)
    throw new ApiError(
      response.status,
      t('Não foi possível carregar as sugestões.'),
    );
  const data = (await response.json()) as { sections: Section[] };
  signal.throwIfAborted();
  const section = data.sections.find((value) => value.kind === kind);
  if (!section || section.unavailable)
    throw Error(t('Não foi possível carregar as sugestões.'));
  return section;
}

async function prepareExplore(
  section: Section,
  signal: AbortSignal,
): Promise<Section> {
  let pool = section.results,
    nextPage = section.nextPage;
  let pageOrder: number[] | undefined, pageSignature: string | undefined;
  if (
    section.source === 'tmdb' &&
    section.totalPages &&
    section.totalPages > 1
  ) {
    pageSignature = JSON.stringify([language, [...section.genres].sort()]);
    const plan = explorePagePlan(
      section.totalPages,
      readExplorePages(section.kind, pageSignature),
    );
    pageOrder = plan.pages;
    // Uma página já oferece até 20 títulos para a primeira grade. O restante
    // chega pela rolagem, sem esperar outra consulta apenas para criar reserva.
    const seed = pageOrder.slice(0, 1);
    const pages = await Promise.allSettled(
      seed.map((page) =>
        page === 1
          ? Promise.resolve(section)
          : explorePage(section.kind, page, signal),
      ),
    );
    signal.throwIfAborted();
    const denied = pages.find(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof ApiError &&
        result.reason.status === 401,
    );
    if (denied?.status === 'rejected') throw denied.reason;
    const loaded = pages.flatMap((result, index) =>
      result.status === 'fulfilled'
        ? [{ page: seed[index], section: result.value }]
        : [],
    );
    if (loaded.length) {
      pool = loaded.flatMap((value) => value.section.results);
      // O cursor percorre índices da ordem sorteada: a próxima página real pode
      // ser menor que a anterior, sem encerrar prematuramente a paginação.
      nextPage = seed.length < pageOrder.length ? seed.length + 1 : null;
      rememberExplorePages(
        section.kind,
        pageSignature,
        loaded.map((value) => value.page),
        plan.reset,
      );
    } else {
      // Não reapresentamos silenciosamente a página 1 como se fosse um sorteio
      // novo. A falha permite tentar novamente sem consumir essas páginas.
      const failure = pages.find((result) => result.status === 'rejected');
      throw failure?.status === 'rejected'
        ? failure.reason
        : Error(t('Não foi possível carregar as sugestões.'));
    }
  } else if (section.source === 'tmdb' && nextPage) {
    // Compatibilidade com respostas sem contagem de páginas: não inventamos um teto.
    try {
      const extra = await explorePage(section.kind, nextPage, signal);
      pool = [...pool, ...extra.results];
      nextPage = extra.nextPage;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) throw error;
    }
  }
  if (section.kind === 'book')
    return { ...section, nextPage, pending: [], results: pool };
  return {
    ...section,
    nextPage,
    pageOrder,
    pageSignature,
    ...exploreSelection(
      pool,
      recentSelections.get(section.kind),
      12,
      section.source === 'tmdb',
    ),
  };
}

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
  // Uma categoria por vez mantém a descoberta e a rolagem automática no mesmo catálogo.
  const [filter, setFilter] = useState<Kind>('movie');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState<Kind | null>(null);
  const [moreError, setMoreError] = useState<Kind | null>(null);
  const [preview, setPreview] = useState<{
    title: CatalogTitle;
    complete: boolean;
  } | null>(null);
  const moreRequest = useRef<AbortController | null>(null);
  const sectionEnds = useRef(new Map<Kind, HTMLDivElement>());
  const grid = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [autoPaused, setAutoPaused] = useState<Partial<Record<Kind, boolean>>>(
    {},
  );
  const expired = useEffectEvent(onExpired);
  const hasVisibleGrid = sections.some(
    (section) => section.kind === filter && section.results.length > 0,
  );
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => {
      // A grade CSS determina as colunas reais, inclusive quando a lateral ou
      // a largura do celular muda. Não fixamos cinco colunas para todas as telas.
      const tracks = getComputedStyle(element).gridTemplateColumns;
      const count = tracks === 'none' ? 1 : tracks.trim().split(/\s+/).length;
      setColumns((current) =>
        current === count ? current : Math.max(1, count),
      );
      // Reutiliza o observador da grade: a sinopse revela as linhas que cabem
      // no próprio espaço, sem criar outra consulta nem aumentar os cards.
      element
        .querySelectorAll<HTMLElement>('.explore-overview')
        .forEach((synopsis) => {
          const lineHeight = Number.parseFloat(
            getComputedStyle(synopsis).lineHeight,
          );
          if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
          const lines = String(
            Math.max(
              3,
              Math.floor(
                (synopsis.getBoundingClientRect().height + 0.5) / lineHeight,
              ),
            ),
          );
          if (synopsis.style.getPropertyValue('--overview-lines') !== lines)
            synopsis.style.setProperty('--overview-lines', lines);
        });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [filter, loading, hasVisibleGrid]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    // Busca somente a categoria ativa. A primeira página informa o tamanho do
    // catálogo; os candidatos exibidos vêm das páginas sorteadas, não sempre dela.
    void explorePage(filter, 1, controller.signal)
      .then((section) => prepareExplore(section, controller.signal))
      .then((section) => ({ sections: [section] }))
      .then((data) => {
        if (active) {
          data.sections.forEach((section) =>
            recentSelections.set(
              section.kind,
              section.results.map((item) => item.catalogId),
            ),
          );
          setSections(data.sections);
          setAutoPaused({});
          setMoreError(null);
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
      controller.abort();
      moreRequest.current?.abort();
    };
  }, [retry, filter]);
  async function loadMore(
    section: Section,
    automatic = false,
    fillSlots?: number,
  ) {
    if (moreRequest.current || (!section.pending?.length && !section.nextPage))
      return;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(section.kind);
    setMoreError(null);
    if (!automatic)
      setAutoPaused((current) => ({ ...current, [section.kind]: false }));
    try {
      const buffer = {
        pending: [...(section.pending || [])],
        next: section.nextPage ?? null,
      };
      const shown = new Set(section.results.map((item) => item.catalogId));
      const batch = await suggestionBatch(
        buffer,
        async (page) => {
          const actualPage = section.pageOrder
            ? section.pageOrder[page - 1]
            : page;
          if (actualPage === undefined) return { results: [], nextPage: null };
          const incoming = await explorePage(
            section.kind,
            actualPage,
            controller.signal,
          );
          if (section.pageOrder && section.pageSignature)
            rememberExplorePages(section.kind, section.pageSignature, [
              actualPage,
            ]);
          return {
            ...incoming,
            nextPage: section.pageOrder
              ? page < section.pageOrder.length
                ? page + 1
                : null
              : (incoming.nextPage ?? null),
            results:
              section.kind === 'book' || section.source === 'tmdb'
                ? incoming.results
                : shuffleSuggestions(incoming.results),
          };
        },
        (item) => shown.has(item.catalogId) || Boolean(findOwned(items, item)),
        controller.signal,
        fillSlots ??
          explorePageSize(
            section.results.length,
            columns,
            section.kind === 'book' ? 20 : 12,
          ),
        3,
      );
      // Páginas repetidas ou filtradas não podem disparar uma cadeia de consultas
      // automáticas. O botão permite continuar explicitamente a partir do cursor salvo.
      if (!controller.signal.aborted && !batch.results.length && batch.hasMore)
        setAutoPaused((current) => ({ ...current, [section.kind]: true }));
      if (!controller.signal.aborted)
        setSections((current) =>
          current.map((value) =>
            value.kind !== section.kind
              ? value
              : {
                  ...value,
                  pending: buffer.pending,
                  nextPage: buffer.next,
                  results: [...value.results, ...batch.results],
                },
          ),
        );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onExpired();
        return;
      }
      if (!controller.signal.aborted) {
        setMoreError(section.kind);
        setAutoPaused((current) => ({ ...current, [section.kind]: true }));
      }
    } finally {
      if (moreRequest.current === controller) {
        moreRequest.current = null;
        setLoadingMore(null);
      }
    }
  }
  const fillVisibleRow = useEffectEvent(() => {
    if (
      loading ||
      moreRequest.current ||
      preview ||
      moreError === filter ||
      autoPaused[filter]
    )
      return;
    const section = sections.find((value) => value.kind === filter);
    if (!section || (!section.pending?.length && !section.nextPage)) return;
    const missing = missingExploreSlots(section.results.length, columns);
    if (missing) void loadMore(section, true, missing);
  });
  useEffect(() => {
    // Completa também a primeira carga e mudanças de tamanho, sem esperar que
    // a última fileira apareça no fim da rolagem.
    const frame = requestAnimationFrame(() => fillVisibleRow());
    return () => cancelAnimationFrame(frame);
  }, [
    sections,
    filter,
    columns,
    loading,
    loadingMore,
    moreError,
    autoPaused,
    preview,
  ]);
  const loadVisibleEnd = useEffectEvent((kind: Kind) => {
    if (
      loading ||
      moreRequest.current ||
      preview ||
      moreError === kind ||
      autoPaused[kind]
    )
      return;
    const section = sections.find((value) => value.kind === kind);
    if (section) void loadMore(section, true);
  });
  useEffect(() => {
    if (
      loading ||
      loadingMore !== null ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    // O observador acompanha o fim da lista, incluindo a rolagem do mobile, sem
    // listeners contínuos de scroll ou recarregamento dos cards já exibidos.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            loadVisibleEnd((entry.target as HTMLElement).dataset.kind as Kind);
        }
      },
      { rootMargin: '0px 0px 120px 0px' },
    );
    for (const section of sections) {
      if (
        section.kind !== filter ||
        moreError === section.kind ||
        autoPaused[section.kind]
      )
        continue;
      const end = sectionEnds.current.get(section.kind);
      if (end && (section.pending?.length || section.nextPage != null))
        observer.observe(end);
    }
    return () => observer.disconnect();
  }, [sections, filter, loading, loadingMore, moreError, autoPaused]);
  return (
    <section className="explore" aria-label={t('Explorar títulos')}>
      <div
        className="explore-filters"
        aria-label={t('Categorias de sugestões')}
      >
        {(['movie', 'series', 'game', 'book'] as const).map((kind) => (
          <Button
            key={kind}
            variant={filter === kind ? 'default' : 'outline'}
            aria-pressed={filter === kind}
            onClick={() => {
              if (kind === filter) return;
              setLoading(true);
              setError('');
              setFilter(kind);
            }}
          >
            {categories[kind]}
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={loading || loadingMore !== null}
          onClick={() => {
            setLoading(true);
            setError('');
            setRetry((value) => value + 1);
          }}
        >
          <Shuffle aria-hidden="true" />
          {t('Novas sugestões')}
        </Button>
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
          .filter((section) => section.kind === filter)
          .map((section) => {
            const Icon = icons[section.kind];
            // Salvar altera o estado das ações, sem remover ou reordenar os cards visíveis.
            const available = section.results;
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
                      {section.source === 'googlebooks'
                        ? t(
                            section.personalized
                              ? 'Sugestões por título, autor e editora dos seus livros'
                              : 'Sugestões de livros no idioma do seu perfil',
                          )
                        : section.personalized
                          ? t(
                              section.source === 'tmdb'
                                ? 'Populares nos seus gêneros: {0}'
                                : 'Prioridade para {0}',
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
                      {section.source === 'googlebooks' && ' · Google Books'}
                    </p>
                  </div>
                </div>
                {available.length ? (
                  <div className="item-grid" ref={grid}>
                    {available.map((item) => (
                      <article
                        className={`library-card ${item.kind}`}
                        key={item.catalogId}
                      >
                        <button
                          type="button"
                          className={`item-cover explore-cover-action ${item.coverUrl ? 'has-poster' : ''}`}
                          aria-label={t('Ver detalhes de {0}', item.title)}
                          onClick={() =>
                            setPreview({ title: item, complete: false })
                          }
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
                        </button>
                        <div className="item-info">
                          <h3>
                            <button
                              type="button"
                              className="explore-title-action"
                              onClick={() =>
                                setPreview({ title: item, complete: false })
                              }
                            >
                              {item.title}
                            </button>
                          </h3>
                          <OriginalTitle
                            title={item.title}
                            originalTitle={item.originalTitle}
                          />
                          {item.year && (
                            <small className="catalog-year">{item.year}</small>
                          )}
                          {item.kind === 'book' && item.authors?.length ? (
                            <small className="explore-book-meta">
                              {item.authors.join(' · ')}
                            </small>
                          ) : null}
                          {item.kind === 'book' && item.publisher && (
                            <small className="explore-book-meta">
                              {item.publisher}
                            </small>
                          )}
                          {item.overview && (
                            <p className="explore-overview">{item.overview}</p>
                          )}
                          <footer className="explore-card-actions">
                            {/* A quantidade de gêneros não desloca a sinopse; a justificativa acompanha as ações. */}
                            {!!item.matches.length && (
                              <p className="explore-reason">
                                {t(' Combina com seu gosto por ')}{' '}
                                {item.matches.map(genreLabel).join(', ')}
                              </p>
                            )}
                            <ExploreActions
                              title={item}
                              owned={findOwned(items, item)}
                              changed={changed}
                              edit={edit}
                              onExpired={onExpired}
                              markWatched={() =>
                                setPreview({ title: item, complete: true })
                              }
                            />
                          </footer>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="explore-empty">
                    <Compass aria-hidden="true" />
                    <p>
                      {t(
                        section.source === 'googlebooks'
                          ? section.unavailable
                            ? 'Não foi possível consultar o Google Books. Tente novamente em instantes.'
                            : 'Nenhuma sugestão nova de livros para suas preferências no momento.'
                          : section.unavailable
                            ? 'Não foi possível consultar o TMDB. Tente novamente em instantes.'
                            : section.source === 'tmdb'
                              ? 'Nenhuma sugestão nova do TMDB para estas preferências no momento.'
                              : section.personalized
                                ? 'Ainda não há outros títulos no NextPlay com os gêneros da sua coleção. Use Adicionar título para descobrir novas opções.'
                                : ' Ainda não há novos títulos desta categoria fora da sua coleção. Use Adicionar título para buscar e salvar suas primeiras opções. ',
                      )}
                    </p>
                    {section.unavailable && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setLoading(true);
                          setRetry((value) => value + 1);
                        }}
                      >
                        {t('Tentar novamente')}
                      </Button>
                    )}
                  </div>
                )}
                {moreError === section.kind && (
                  <p className="home-error" role="alert">
                    {t('Não foi possível carregar as sugestões.')}
                  </p>
                )}
                {(Boolean(section.pending?.length) ||
                  section.nextPage != null) && (
                  <div
                    className="catalog-more-actions explore-load-more"
                    data-kind={section.kind}
                    ref={(node) => {
                      if (node) sectionEnds.current.set(section.kind, node);
                      else sectionEnds.current.delete(section.kind);
                    }}
                    aria-busy={loadingMore === section.kind}
                  >
                    {loadingMore === section.kind && (
                      <PageLoading compact label={t('Carregando sugestões…')} />
                    )}
                    {loadingMore !== section.kind && (
                      <Button
                        type="button"
                        variant="outline"
                        className="catalog-more-button"
                        disabled={loadingMore !== null}
                        onClick={() => void loadMore(section)}
                      >
                        {t(
                          moreError === section.kind
                            ? 'Tentar novamente'
                            : 'Ver mais sugestões',
                        )}
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                )}
              </section>
            );
          })
      )}
      {preview && (
        <ExploreTitleDetails
          key={`${preview.title.catalogId}:${preview.complete}`}
          title={preview.title}
          initialComplete={preview.complete}
          items={items}
          changed={changed}
          edit={edit}
          onExpired={onExpired}
          close={() => setPreview(null)}
        />
      )}
    </section>
  );
}
