import PageLoading from './PageLoading';
import useSuggestionScroll from './useSuggestionScroll';
import { t } from './i18n';
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
  // A mesma busca serve à posse e à leitura; cada fluxo usa suas próprias ações e sugestões.
  if (kind === 'book')
    return (
      <>
        <BookSearch
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
    <MediaCatalogSearch
      key={kind}
      {...props}
      initialKind={kind}
      onBook={() => {
        setKind('book');
        props.onKindChange?.('book');
      }}
    />
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
  onKindChange,
}: CatalogSearchProps & { onBook: () => void }) {
  const [kind, setKind] = useState(
    initialKind === 'book' ? 'movie' : initialKind,
  );
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [results, setResults] = useState<CatalogTitle[]>([]);
  const [busy, setBusy] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState({
    term: '',
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
    resetKey: JSON.stringify([kind, platform, request.term]),
    loadMore: more,
  });
  const expired = useEffectEvent(onExpired);
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
          params.set('page', String(apiPage));
          const response = await fetch(
            `/api/catalog/${request.term ? 'search' : 'suggestions'}?${params}`,
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
            results: request.term
              ? [...data.results].sort(
                  (a, b) => releaseTime(b) - releaseTime(a),
                )
              : // Filmes/séries já vêm por afinidade e popularidade do TMDB.
                kind === 'movie' || kind === 'series'
                ? data.results
                : shuffleSuggestions(data.results),
            nextPage: data.nextPage ?? null,
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
  }, [kind, platform, request]);
  function load(term: string) {
    buffer.current = { pending: [], next: 1 };
    setBusy(true);
    setError('');
    setResults([]);
    setSearched(false);
    setNextPage(null);
    setRequest((current) => ({
      term,
      revision: current.revision + 1,
      page: 1,
    }));
  }
  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length === 1) return;
    load(query.trim());
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
            value={kind}
            onChange={(event) => {
              // Livros usam Google Books; não enviamos essa categoria ao TMDB/IGDB.
              if (event.target.value === 'book') {
                onBook();
                return;
              }
              setQuery('');
              load('');
              setKind(event.target.value as 'movie' | 'series' | 'game');
              onKindChange?.(event.target.value as Kind);
            }}
          >
            {(['movie', 'series', 'game'] as const).map((key) => (
              <option key={key} value={key}>
                {categories[key]}
              </option>
            ))}
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
              disabled={busy || query.trim().length === 1}
            >
              <Search aria-hidden="true" />
              {busy ? t('Buscando…') : t('Buscar')}
            </Button>
          </div>
        </div>
      </form>
      <p>
        {request.term
          ? t('Resultados para “{0}”', request.term)
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
            <div className="catalog-cover-frame">
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
            </div>
            <div className="catalog-card-info">
              <strong>{item.title}</strong>
              <OriginalTitle
                title={item.title}
                originalTitle={item.originalTitle}
              />
              <small>
                {item.year || t('Ano não informado')} ·{' '}
                {kind === 'game' ? 'IGDB' : 'TMDB'}
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
                <QuickActions
                  title={item}
                  owned={findOwned(items, item)}
                  changed={changed}
                  edit={edit}
                  onExpired={onExpired}
                />
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
