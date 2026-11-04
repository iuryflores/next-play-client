import ExploreActions from './ExploreActions';
import ExploreTitleDetails from './ExploreTitleDetails';
import './catalog-preview.css';
import PageLoading from './PageLoading';
import useSuggestionScroll from './useSuggestionScroll';
import { t, genreLabel } from './i18n';
import ReleaseBadge from './ReleaseBadge';
import OriginalTitle from './OriginalTitle';
import { useEffect, useEffectEvent, useState, type SubmitEvent } from 'react';
import { Search, ImageOff, ChevronDown, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  categories,
  statusNames,
  type Kind,
  type LibraryItem,
} from './library';
import QuickActions, { findOwned } from './QuickActions';
import { ApiError } from './auth';
import {
  suggestionBatch,
  suggestionCount,
  type SuggestionBuffer,
} from './suggestion-batch';
import { useRef } from 'react';
import { appendSuggestionPage, shuffleSuggestions } from './suggestions';
import BookSearch from './BookSearch';
export interface CatalogTitle {
  platforms?: string[];
  genres?: string[];
  catalogId: string;
  kind: Kind;
  title: string;
  originalTitle?: string;
  coverUrl: string;
  year: string;
  releaseDate?: string;
  unreleased?: boolean;
  overview: string;
  sourceUrl: string;
  authors?: string[];
  isbn?: string;
  publisher?: string;
  language?: string;
  runtime?: number | null;
  productionCompanies?: { id: number; name: string; logoUrl?: string | null }[];
}
function releaseTime(item: CatalogTitle) {
  const date = item.releaseDate ? Date.parse(item.releaseDate) : NaN;
  if (Number.isFinite(date)) return date;
  return /^\d{4}$/.test(item.year) ? Date.parse(`${item.year}-01-01`) : 0;
}
type CatalogSearchProps = {
  initialKind: Kind;
  items: LibraryItem[];
  changed: (item: LibraryItem) => void;
  edit: (item: LibraryItem) => void;
  manual: (kind?: Kind) => void;
  onExpired: () => void;
  select?: (title: CatalogTitle) => void;
  choose?: (title: CatalogTitle) => void;
  onKindChange?: (kind: Kind) => void;
};
export default function CatalogSearch(props: CatalogSearchProps) {
  const [kind, setKind] = useState(props.initialKind);
  const [preview, setPreview] = useState<CatalogTitle | null>(null);
  const [previewComplete, setPreviewComplete] = useState(false);
  // O atalho abre a confirmação antes de criar o acompanhamento, evitando um registro intermediário.
  function openPreview(title: CatalogTitle, complete = false) {
    setPreviewComplete(complete);
    setPreview(title);
  }
  // A prévia não substitui a busca, preservando resultados, filtros e posição ao fechar.
  const detailsModal = preview && (
    <ExploreTitleDetails
      key={preview.catalogId}
      title={preview}
      initialComplete={previewComplete}
      items={props.items}
      changed={props.changed}
      edit={props.edit}
      onExpired={props.onExpired}
      select={props.select}
      close={() => setPreview(null)}
    />
  );
  // A mesma busca serve à posse e à leitura; cada fluxo usa suas próprias ações e sugestões.
  if (kind === 'book')
    return (
      <>
        {detailsModal}
        <BookSearch
          preview={openPreview}
          select={props.select || props.choose || (() => {})}
          context={props.select ? 'collection' : 'reading'}
          actions={
            props.select
              ? undefined
              : (book) => {
                  const item = findOwned(props.items, book);
                  if (item)
                    return (
                      <>
                        <small>{statusNames.book[item.status]}</small>
                        <Button
                          className="home-primary"
                          onClick={() => props.edit(item)}
                        >
                          {t('Editar acompanhamento')}
                        </Button>
                      </>
                    );
                  if (props.choose)
                    return (
                      <Button
                        className="home-primary"
                        onClick={() => props.choose!(book)}
                      >
                        {t('Acompanhar livro')}
                      </Button>
                    );
                  return (
                    <QuickActions
                      title={book}
                      changed={props.changed}
                      edit={props.edit}
                      onExpired={props.onExpired}
                    />
                  );
                }
          }
          category={(kind) => {
            setKind(kind);
            props.onKindChange?.(kind);
          }}
          onExpired={props.onExpired}
        />
        {!props.select && (
          <Button variant="outline" onClick={() => props.manual('book')}>
            {t('Cadastrar manualmente')}
          </Button>
        )}
      </>
    );
  return (
    <>
      {detailsModal}
      <MediaCatalogSearch
        preview={openPreview}
        key={kind}
        {...props}
        initialKind={kind}
        onBook={() => {
          setKind('book');
          props.onKindChange?.('book');
        }}
      />
    </>
  );
}
function MediaCatalogSearch({
  initialKind,
  items,
  changed,
  edit,
  manual,
  onExpired,
  select,
  onBook,
  preview,
  onKindChange,
}: CatalogSearchProps & {
  onBook: () => void;
  preview: (title: CatalogTitle, complete?: boolean) => void;
}) {
  const [kind, setKind] = useState(
    initialKind === 'book' ? 'movie' : initialKind,
  );
  const [mixed, setMixed] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreDirectory, setGenreDirectory] = useState<
    { kind: string; id: number; name: string }[]
  >([]);
  const [genreError, setGenreError] = useState('');
  const [genreRevision, setGenreRevision] = useState(0);
  const [company, setCompany] = useState('');
  const providerNext = useRef<Record<string, number | null>>({});
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(
      (mixed ? ['movie', 'series'] : [kind]).map(async (category) => {
        const response = await fetch(`/api/catalog/genres?kind=${category}`, {
          credentials: 'same-origin',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        });
        if (!response.ok)
          throw new ApiError(
            response.status,
            t('Não foi possível carregar os gêneros.'),
          );
        const data = (await response.json()) as {
          genres: { id: number; name: string }[];
        };
        if (!Array.isArray(data.genres)) throw Error();
        return data.genres.map((genre) => ({ ...genre, kind: category }));
      }),
    )
      .then((rows) => {
        if (!controller.signal.aborted) {
          setGenreDirectory(rows.flat());
          setGenreError('');
        }
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setGenreError(t('Não foi possível carregar os gêneros.'));
      });
    return () => controller.abort();
  }, [kind, mixed, genreRevision]);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [results, setResults] = useState<CatalogTitle[]>([]);
  const [busy, setBusy] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState({
    term: '',
    company: '',
    revision: 0,
    page: 1,
  });
  const [nextPage, setNextPage] = useState<number | null>(null);
  function more() {
    if (busy || nextPage === null) return;
    setBusy(true);
    setError('');
    setRequest((current) => ({
      ...current,
      page: nextPage,
      revision: current.revision + 1,
    }));
  }
  const suggestionEnd = useSuggestionScroll({
    enabled: nextPage !== null,
    loading: busy,
    blocked: Boolean(error),
    resetKey: JSON.stringify([
      kind,
      mixed,
      platform,
      selectedGenres,
      request.term,
      request.company,
    ]),
    loadMore: more,
  });
  const genreIdsFor = useEffectEvent((category: string) =>
    genreDirectory
      .filter(
        (genre) =>
          genre.kind === category && selectedGenres.includes(genre.name),
      )
      .map((genre) => genre.id),
  );
  const buffer = useRef<SuggestionBuffer<CatalogTitle>>({
    pending: [],
    next: 1,
  });
  const exclude = useEffectEvent(
    (candidate: CatalogTitle) =>
      Boolean(findOwned(items, candidate)) ||
      results.some((item) => item.catalogId === candidate.catalogId),
  );
  const batchSize = useEffectEvent((page: number) =>
    suggestionCount(page, results.length),
  );
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ kind });
    if (kind === 'game' && platform) params.set('platform', platform);
    const page = request.page;
    params.set('page', String(page));
    if (request.term) params.set('q', request.term);
    void (async () => {
      setBusy(true);
      setError('');
      try {
        async function fetchPage(apiPage: number) {
          const categoriesToFetch = mixed ? ['movie', 'series'] : [kind];
          const pages = await Promise.all(
            categoriesToFetch.map(async (category) => {
              if (apiPage > 1 && providerNext.current[category] === null)
                return { category, results: [], nextPage: null };
              const genreIds = genreIdsFor(category);
              // Um gênero inexistente na categoria não pode remover silenciosamente o filtro escolhido.
              if (selectedGenres.length && !genreIds.length)
                return { category, results: [], nextPage: null };
              const categoryParams = new URLSearchParams(params);
              categoryParams.set('kind', category);
              categoryParams.set('page', String(apiPage));
              if (genreIds.length)
                categoryParams.set('genres', genreIds.join(','));
              if (request.company)
                categoryParams.set('company', request.company);
              const endpoint =
                selectedGenres.length || request.company
                  ? 'browse'
                  : request.term
                    ? 'search'
                    : 'suggestions';
              const response = await fetch(
                `/api/catalog/${endpoint}?${categoryParams}`,
                {
                  credentials: 'same-origin',
                  signal: AbortSignal.any([
                    controller.signal,
                    AbortSignal.timeout(20000),
                  ]),
                },
              );
              const data = (await response.json().catch(() => null)) as {
                results?: CatalogTitle[];
                message?: string;
                nextPage?: number | null;
              } | null;
              if (!response.ok || !Array.isArray(data?.results))
                throw new ApiError(
                  response.status,
                  data?.message || t('Não foi possível consultar o catálogo.'),
                );
              return {
                category,
                results: data.results,
                nextPage: data.nextPage ?? null,
              };
            }),
          );
          // Só avança os cursores depois que todas as categorias responderem; uma falha pode ser repetida sem perder títulos.
          if (!controller.signal.aborted)
            for (const data of pages)
              providerNext.current[data.category] = data.nextPage;
          const titles = pages.flatMap((data) => data.results);
          // Intercala as categorias para que a primeira página não esconda todas as séries após os filmes.
          const combined = mixed
            ? Array.from(
                {
                  length: Math.max(
                    ...pages.map((data) => data.results.length),
                    0,
                  ),
                },
                (_, index) =>
                  pages.flatMap((data) =>
                    data.results[index] ? [data.results[index]] : [],
                  ),
              ).flat()
            : titles;
          return {
            results: request.term
              ? combined.sort((a, b) => releaseTime(b) - releaseTime(a))
              : kind === 'game'
                ? shuffleSuggestions(combined)
                : combined,
            nextPage: pages.some((data) => data.nextPage !== null)
              ? apiPage + 1
              : null,
          };
        }
        const searchPage = request.term ? await fetchPage(page) : null;
        const batch = searchPage
          ? { ...searchPage, hasMore: searchPage.nextPage !== null }
          : await suggestionBatch(
              buffer.current,
              fetchPage,
              exclude,
              controller.signal,
              batchSize(page),
              4,
            );
        if (active) {
          setResults((current) =>
            appendSuggestionPage(page > 1 ? current : [], batch.results),
          );
          setNextPage(
            searchPage ? searchPage.nextPage : batch.hasMore ? page + 1 : null,
          );
          setSearched(true);
        }
      } catch (reason) {
        if (active) {
          if (reason instanceof ApiError && reason.status === 401) expired();
          else
            setError(
              reason instanceof ApiError
                ? reason.message
                : t('O catálogo não respondeu. Tente novamente.'),
            );
        }
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [kind, mixed, platform, selectedGenres, request]);
  function load(term: string, companyTerm = request.company) {
    providerNext.current = {};
    buffer.current = { pending: [], next: 1 };
    setBusy(true);
    setError('');
    setResults([]);
    setSearched(false);
    setNextPage(null);
    setRequest((current) => ({
      term,
      company: companyTerm,
      revision: current.revision + 1,
      page: 1,
    }));
  }
  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length === 1 || company.trim().length === 1) return;
    load(query.trim(), company.trim());
  }
  return (
    <div className="catalog-search">
      <form
        onSubmit={search}
        className={kind === 'game' ? 'has-platform-filter' : undefined}
      >
        <div className="catalog-filter-field">
          <label htmlFor="catalog-kind">
            {t(' O que você quer adicionar? ')}
          </label>
          <NativeSelect
            id="catalog-kind"
            value={mixed ? 'screen' : kind}
            onChange={(event) => {
              // Livros usam Google Books; não enviamos essa categoria ao TMDB/IGDB.
              if (event.target.value === 'book') {
                onBook();
                return;
              }
              setQuery('');
              setGenreDirectory([]);
              setGenreError('');
              setCompany('');
              setSelectedGenres([]);
              setMixed(event.target.value === 'screen');
              load('', '');
              setKind(
                event.target.value === 'screen'
                  ? 'movie'
                  : (event.target.value as 'movie' | 'series' | 'game'),
              );
              if (event.target.value !== 'screen')
                onKindChange?.(event.target.value as Kind);
            }}
          >
            {(['movie', 'series', 'game'] as const).map((key) => (
              <option key={key} value={key}>
                {categories[key]}
              </option>
            ))}
            <option value="screen">{t('Filmes e séries')}</option>
            <option value="book">{categories.book}</option>
          </NativeSelect>
        </div>
        {kind === 'game' && (
          <div className="catalog-filter-field">
            <label htmlFor="catalog-platform">{t('Plataforma')}</label>
            <NativeSelect
              id="catalog-platform"
              value={platform}
              onChange={(event) => {
                setPlatform(event.target.value);
                load(request.term);
              }}
            >
              <option value="">{t('Todas as plataformas')}</option>
              {[
                [6, 'PC'],
                [167, 'PS5'],
                [48, 'PS4'],
                [9, 'PS3'],
                [8, 'PS2'],
                [7, 'PS1'],
                [38, 'PSP'],
                [46, 'PS Vita'],
                [169, 'Xbox Series X/S'],
                [49, 'Xbox One'],
                [12, 'Xbox 360'],
                [11, 'Xbox'],
                [130, 'Nintendo Switch'],
                [41, 'Wii U'],
                [5, 'Wii'],
                [21, 'GameCube'],
                [4, 'Nintendo 64'],
                [19, 'SNES'],
                [18, 'NES'],
                [37, 'Nintendo 3DS'],
                [20, 'Nintendo DS'],
                [24, 'Game Boy Advance'],
                [33, 'Game Boy'],
                [29, 'Mega Drive'],
                [23, 'Dreamcast'],
                [34, 'Android'],
                [39, 'iOS'],
              ].map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        {kind !== 'game' && (
          <div className="catalog-filter-field">
            <label htmlFor="catalog-company">{t('Produtora')}</label>
            <Input
              id="catalog-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              maxLength={100}
              placeholder={t('Ex.: Marvel, Pixar…')}
            />
          </div>
        )}
        <div className="catalog-filter-field catalog-search-field">
          <label htmlFor="catalog-query">{t(' Buscar no catálogo ')}</label>
          <div className="catalog-query">
            <Input
              id="catalog-query"
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                if (!value.trim() && request.term) load('');
              }}
              placeholder={
                kind === 'game'
                  ? t('Ex.: The Legend of Zelda')
                  : t('Título ou produtora. Ex.: Interestelar, Marvel')
              }
              minLength={2}
              maxLength={100}
            />
            <Button
              type="submit"
              className="home-primary"
              disabled={
                busy || query.trim().length === 1 || company.trim().length === 1
              }
            >
              <Search aria-hidden="true" />
              {busy ? t('Buscando…') : t('Buscar')}
            </Button>
          </div>
        </div>
      </form>
      <details className="catalog-genre-filter">
        <summary>
          {t('Gêneros')}
          {selectedGenres.length ? ` (${selectedGenres.length})` : ''}
        </summary>
        <p>
          {t(
            'Selecione até 8 gêneros. Os resultados podem pertencer a qualquer um deles.',
          )}
        </p>
        {genreError ? (
          <p role="alert">
            {genreError}{' '}
            <Button
              variant="link"
              onClick={() => {
                setGenreError('');
                setGenreRevision((value) => value + 1);
              }}
            >
              {t('Tentar novamente')}
            </Button>
          </p>
        ) : !genreDirectory.length ? (
          <p>{t('Carregando gêneros…')}</p>
        ) : null}
        <div className="catalog-genre-options">
          {[...new Set(genreDirectory.map((genre) => genre.name))]
            .sort((a, b) => genreLabel(a).localeCompare(genreLabel(b)))
            .map((name) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={selectedGenres.includes(name)}
                  disabled={
                    !selectedGenres.includes(name) && selectedGenres.length >= 8
                  }
                  onChange={() => {
                    setSelectedGenres((current) =>
                      current.includes(name)
                        ? current.filter((value) => value !== name)
                        : [...current, name],
                    );
                    load(request.term);
                  }}
                />
                {genreLabel(name)}
              </label>
            ))}
        </div>
        {selectedGenres.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedGenres([]);
              load(request.term);
            }}
          >
            {t('Limpar gêneros')}
          </Button>
        )}
      </details>
      <p>
        {request.term
          ? t('Resultados para “{0}”', request.term)
          : selectedGenres.length || request.company
            ? t('Títulos que combinam com seus filtros')
            : items.some((item) => item.kind === kind && item.genres?.length)
              ? t('Sugestões inspiradas nos gêneros da sua coleção')
              : kind === 'game'
                ? t('Jogos para conhecer')
                : t('Populares no catálogo')}
      </p>
      {busy && !results.length && (
        <PageLoading label={t('Carregando títulos…')} />
      )}
      <output className="home-error" aria-live="polite">
        {error}
      </output>
      {error && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setRequest((current) => ({
              ...current,
              revision: current.revision + 1,
            }));
          }}
        >
          {t(' Tentar novamente ')}
        </Button>
      )}
      <div className="catalog-results" aria-busy={busy}>
        {/* Salvar mantém o card e sua posição; apenas as ações e o selo mudam. */}
        {results.map((item) => (
          <article key={item.catalogId} className="catalog-result">
            <button
              type="button"
              className="catalog-cover-frame catalog-preview-cover"
              onClick={() => preview(item)}
              aria-label={t('Ver detalhes de {0}', item.title)}
            >
              {findOwned(items, item) && (
                <span className="catalog-owned-badge">{t('Na coleção')}</span>
              )}
              <ReleaseBadge item={item} />
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="catalog-no-cover">
                  <ImageOff aria-hidden="true" />
                </span>
              )}
            </button>
            <div className="catalog-card-info">
              <strong>
                <button
                  type="button"
                  className="catalog-preview-title"
                  onClick={() => preview(item)}
                  aria-label={t('Ver detalhes de {0}', item.title)}
                >
                  {item.title}
                </button>
              </strong>
              <OriginalTitle
                title={item.title}
                originalTitle={item.originalTitle}
              />
              <small>
                {item.year || t('Ano não informado')} · {categories[item.kind]}{' '}
                · {item.kind === 'game' ? 'IGDB' : 'TMDB'}
              </small>
              <span className="catalog-overview">
                {item.overview || t('Sem sinopse disponível.')}
              </span>
              {item.kind === 'game' && (
                <small className="catalog-platforms">
                  {t('Plataformas')}:{' '}
                  {item.platforms?.length
                    ? item.platforms.join(' · ')
                    : t('Não informadas pelo catálogo')}
                </small>
              )}
              {select ? (
                <Button
                  type="button"
                  className="home-primary"
                  onClick={() => select(item)}
                >
                  {t('Escolher esta obra')}
                </Button>
              ) : (
                <div className="catalog-card-actions">
                  <ExploreActions
                    title={item}
                    owned={findOwned(items, item)}
                    changed={changed}
                    edit={edit}
                    onExpired={onExpired}
                    markWatched={() => preview(item, true)}
                  />
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {searched && !busy && !results.length && !error && (
        <p>
          {t('Nenhum resultado. Tente outro nome ou cadastre manualmente.')}
        </p>
      )}
      {nextPage !== null && (
        <div className="catalog-more-actions" ref={suggestionEnd}>
          <Button
            type="button"
            variant="outline"
            className="catalog-more-button"
            aria-busy={busy}
            disabled={busy}
            onClick={more}
          >
            {busy
              ? t(
                  request.term
                    ? 'Carregando resultados…'
                    : 'Carregando sugestões…',
                )
              : t(request.term ? 'Ver mais resultados' : 'Ver mais sugestões')}
            {busy ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
          </Button>
        </div>
      )}
      {/* No acervo, o cadastro manual já está ao lado de Voltar; mantemos só uma entrada. */}
      {!select && (
        <Button type="button" variant="link" onClick={() => manual()}>
          {t(' Não encontrou? Adicionar manualmente ')}
        </Button>
      )}
    </div>
  );
}
