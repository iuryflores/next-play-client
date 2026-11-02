import {
  useEffect,
  useEffectEvent,
  useState,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import { BookOpen, ChevronDown, LoaderCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { ApiError } from './auth';
import PageLoading from './PageLoading';
import { categories, type Kind } from './library';
import type { CatalogTitle } from './CatalogSearch';
import { t } from './i18n';
import './book-search.css';
import {
  bookSearchMode,
  type BookSearchField,
  type BookSearchMode,
} from './book-search-state';

export interface BookTitle extends CatalogTitle {
  authors: string[];
  isbn: string;
  publisher: string;
  language: string;
}
export default function BookSearch({
  select,
  actions,
  context = 'collection',
  category,
  onExpired,
}: {
  select: (book: CatalogTitle) => void;
  actions?: (book: BookTitle) => ReactNode;
  context?: 'collection' | 'reading';
  category: (kind: Kind) => void;
  onExpired: () => void;
}) {
  const [field, setField] = useState<BookSearchField>('title');
  const [query, setQuery] = useState('');
  const [request, setRequest] = useState<{
    q: string;
    field: BookSearchField;
    mode: BookSearchMode;
    automatic: boolean;
    page: number;
    revision: number;
  }>({
    q: '',
    field: 'title',
    mode: 'suggestions',
    automatic: false,
    page: 1,
    revision: 0,
  });
  const [results, setResults] = useState<BookTitle[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);
  const [personalized, setPersonalized] = useState(false);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    if (request.mode === 'idle') return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(request.page) });
    if (request.mode === 'suggestions') params.set('context', context);
    if (request.mode === 'search') {
      params.set('q', request.q);
      params.set('field', request.field);
    }
    // A pausa agrupa a digitação; alterar o termo cancela o timer e a resposta antiga.
    const timer = window.setTimeout(
      () => {
        void fetch(
          `/api/catalog/books/${request.mode === 'suggestions' ? 'suggestions' : 'search'}?${params}`,
          {
            credentials: 'same-origin',
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(
                request.mode === 'suggestions' ? 30000 : 20000,
              ),
            ]),
          },
        )
          .then(async (response) => {
            const data = await response.json().catch(() => null);
            if (!response.ok || !Array.isArray(data?.results))
              throw new ApiError(
                response.status,
                typeof data?.message === 'string'
                  ? data.message
                  : t('Não foi possível consultar o Google Books.'),
              );
            if (!controller.signal.aborted) {
              setResults(
                (current) =>
                  [
                    ...new Map(
                      (request.page > 1
                        ? [...current, ...data.results]
                        : data.results
                      ).map((book: BookTitle) => [book.catalogId, book]),
                    ).values(),
                  ] as BookTitle[],
              );
              setNextPage(data.nextPage ?? null);
              setPersonalized(data.personalized === true);
              setSearched(true);
            }
          })
          .catch((reason) => {
            if (controller.signal.aborted) return;
            if (reason instanceof ApiError && reason.status === 401) expired();
            else
              setError(
                reason instanceof ApiError
                  ? reason.message
                  : t(
                      'O Google Books não respondeu. Tente novamente ou cadastre manualmente.',
                    ),
              );
          })
          .finally(() => {
            if (!controller.signal.aborted) setBusy(false);
          });
      },
      request.automatic ? 500 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [request, context]);
  function suggest(value: string, nextField: BookSearchField) {
    const mode = bookSearchMode(value, nextField);
    setQuery(value);
    setField(nextField);
    setBusy(mode !== 'idle');
    setError('');
    setResults([]);
    setNextPage(null);
    setSearched(false);
    setRequest((current) => ({
      q: value.trim(),
      field: nextField,
      mode,
      automatic: mode === 'search',
      page: 1,
      revision: current.revision + 1,
    }));
  }
  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    setError('');
    setResults([]);
    setNextPage(null);
    setSearched(false);
    setRequest((current) => ({
      q: query.trim(),
      field,
      mode: 'search',
      automatic: false,
      page: 1,
      revision: (current?.revision || 0) + 1,
    }));
  }
  return (
    <div className="catalog-search book-search">
      <form onSubmit={search} className="has-platform-filter">
        <div className="catalog-filter-field">
          <label htmlFor="book-kind">{t('O que você quer adicionar?')}</label>
          <NativeSelect
            id="book-kind"
            value="book"
            onChange={(event) => category(event.target.value as Kind)}
          >
            {Object.entries(categories).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="catalog-filter-field">
          <label htmlFor="book-field">{t('Buscar por')}</label>
          <NativeSelect
            id="book-field"
            value={field}
            onChange={(event) =>
              suggest(query, event.target.value as BookSearchField)
            }
          >
            <option value="title">{t('Título')}</option>
            <option value="author">{t('Autor')}</option>
            <option value="isbn">ISBN</option>
          </NativeSelect>
        </div>
        <div className="catalog-filter-field catalog-search-field">
          <label htmlFor="book-query">{t('Buscar livros')}</label>
          <div className="catalog-query">
            <Input
              id="book-query"
              value={query}
              onChange={(event) => suggest(event.target.value, field)}
              minLength={2}
              maxLength={100}
              required
              placeholder={t(
                field === 'isbn'
                  ? 'ISBN de 10 ou 13 caracteres'
                  : field === 'author'
                    ? 'Ex.: Clarice Lispector'
                    : 'Ex.: Dom Casmurro',
              )}
            />
            <Button
              type="submit"
              className="home-primary"
              disabled={query.trim().length < 2}
            >
              <Search aria-hidden="true" />
              {t(busy ? 'Buscando…' : 'Buscar')}
            </Button>
          </div>
        </div>
      </form>
      <p>
        {t(
          'Busque por título, autor ou ISBN para escolher a edição do seu livro.',
        )}
      </p>
      <p aria-live="polite">
        {t(
          request.mode === 'suggestions'
            ? personalized
              ? 'Sugestões por título, autor e editora dos seus livros'
              : 'Sugestões de livros no idioma do seu perfil'
            : request.mode === 'idle'
              ? field === 'isbn'
                ? 'Digite um ISBN completo para buscar automaticamente.'
                : 'Digite pelo menos 2 caracteres para buscar.'
              : 'Resultados da busca de livros',
        )}
      </p>
      {error && (
        <div className="home-error" role="alert">
          {error}
          <Button
            variant="link"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError('');
              setRequest((current) => ({
                ...current,
                automatic: false,
                revision: current.revision + 1,
              }));
            }}
          >
            {t('Tentar novamente')}
          </Button>
        </div>
      )}
      <div className="catalog-results" aria-busy={busy}>
        {results.map((book) => (
          <article className="catalog-result" key={book.catalogId}>
            <div className="catalog-cover-frame">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <BookOpen aria-hidden="true" />
              )}
            </div>
            <div className="catalog-card-info">
              <strong title={book.title}>{book.title}</strong>
              <span title={book.authors.join(' · ')}>
                {book.authors.join(' · ') || t('Autor não informado')}
              </span>
              <small>
                {[t('Livro'), book.year].filter(Boolean).join(' · ')}
              </small>
              {book.publisher && <small>{book.publisher}</small>}
              <footer className="book-card-footer">
                {actions ? (
                  actions(book)
                ) : (
                  <Button className="home-primary" onClick={() => select(book)}>
                    {t('Escolher esta edição')}
                  </Button>
                )}
                <a href={book.sourceUrl} target="_blank" rel="noreferrer">
                  {t('Ver no Google Books')}
                </a>
              </footer>
            </div>
          </article>
        ))}
      </div>
      {/* Ao carregar mais, o indicador compacto preserva os livros já exibidos. */}
      {busy && (
        <PageLoading label={t('Buscando…')} compact={results.length > 0} />
      )}
      {searched && !busy && !error && !results.length && (
        <p>
          {t(
            'Nenhum livro encontrado. Tente outro termo ou cadastre manualmente.',
          )}
        </p>
      )}
      {nextPage !== null && (
        <div className="catalog-more-actions">
          <Button
            variant="outline"
            className="catalog-more-button"
            aria-busy={busy}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError('');
              setRequest((current) => ({
                ...current,
                automatic: false,
                page: nextPage,
              }));
            }}
          >
            {t(busy ? 'Carregando resultados…' : 'Ver mais resultados')}
            {busy ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
