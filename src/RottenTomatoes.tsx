import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import { matchRottenTomatoesMovie } from './rotten-tomatoes-match';
import { Search, LoaderCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { t, language } from './i18n';

type Result = {
  directors?: string[];
  title: string;
  year: number | null;
  url: string;
  tomatometer: number | null;
  popcornmeter: number | null;
};
type SearchResult = {
  results: Result[];
  queriedAt: string;
  searchedTitle?: string;
  searchedDirectors?: string[];
};
export default function RottenTomatoes({
  title,
  year,
  catalogId,
  kind = 'movie',
  onExpired,
  personalStars,
  communityRating,
}: {
  title: string;
  year?: string;
  catalogId?: string;
  kind?: 'movie' | 'series';
  onExpired: () => void;
  personalStars?: number;
  communityRating?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(title.slice(0, 100));
  const [filterYear, setFilterYear] = useState(year || '');
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [data, setData] = useState<SearchResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  function close(value: boolean) {
    setOpen(value);
    if (!value) {
      controller.current?.abort();
      setBusy(false);
    }
  }
  async function search(event?: SubmitEvent<HTMLFormElement>, term = query) {
    event?.preventDefault();
    if (term.trim().length < 2) {
      setBusy(false);
      setError(t('Digite entre 2 e 100 caracteres para buscar.'));
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError('');
    setData(null);
    setSelected(null);
    try {
      const response = await fetch(
        `/api/rotten-tomatoes/search?${new URLSearchParams({ q: term.trim(), kind, ...(filterYear ? { year: filterYear } : {}), ...(!event && catalogId?.startsWith(`tmdb:${kind}:`) ? { catalogId } : {}) })}`,
        {
          credentials: 'same-origin',
          signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)]),
        },
      );
      if (response.status === 401) {
        onExpired();
        return;
      }
      if (!response.ok)
        throw new Error(
          t(
            response.status === 503
              ? 'A consulta ao Rotten Tomatoes ainda não está configurada.'
              : response.status === 429
                ? 'Muitas tentativas. Aguarde um minuto e tente novamente.'
                : 'Não foi possível consultar o Rotten Tomatoes. Tente novamente mais tarde.',
          ),
        );
      const result = (await response.json()) as SearchResult;
      if (!Array.isArray(result.results))
        throw new Error(
          t(
            'Não foi possível consultar o Rotten Tomatoes. Tente novamente mais tarde.',
          ),
        );
      if (!current.signal.aborted) {
        setData(result);
        setSelected(
          matchRottenTomatoesMovie(
            result.results,
            result.searchedTitle || title,
            year,
            kind === 'movie' ? (result.searchedDirectors ?? []) : undefined,
          ),
        );
        if (!event && result.searchedTitle)
          setQuery(result.searchedTitle.slice(0, 100));
      }
    } catch (reason) {
      if (!current.signal.aborted)
        setError(
          reason instanceof Error && reason.name !== 'TimeoutError'
            ? reason.message
            : t(
                'Não foi possível consultar o Rotten Tomatoes. Tente novamente mais tarde.',
              ),
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  const automaticSearch = useEffectEvent(() => {
    void search(undefined, title.slice(0, 100));
  });
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) automaticSearch();
    });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [title, year, catalogId, kind]);
  return (
    <>
      <section className="rt-inline" aria-label={t('Notas no Rotten Tomatoes')}>
        <div aria-live="polite" aria-busy={busy}>
          {busy && <p>{t('Consultando notas…')}</p>}
          {!busy && error && (
            <>
              <p className="home-error">{error}</p>
              <Button
                variant="outline"
                onClick={() => void search(undefined, title.slice(0, 100))}
              >
                {t('Tentar novamente')}
              </Button>
            </>
          )}
          {!busy && selected && (
            <>
              <dl className="rt-scores">
                <div>
                  <dt>{t('Sua nota')}</dt>
                  <dd>{personalStars ? personalStars + '/5' : '—'}</dd>
                </div>
                <div>
                  <dt>{t('Comunidade')}</dt>
                  <dd>{communityRating?.toFixed(2) ?? '—'} /5</dd>
                </div>
                <div>
                  <dt>
                    <span className="rt-score-icon" aria-hidden="true">
                      🍅
                    </span>{' '}
                    Tomatometer
                  </dt>
                  <dd>
                    {selected.tomatometer === null
                      ? t('Sem nota')
                      : `${selected.tomatometer}%`}
                  </dd>
                </div>
                <div>
                  <dt>
                    <span className="rt-score-icon" aria-hidden="true">
                      🍿
                    </span>{' '}
                    Popcornmeter
                  </dt>
                  <dd>
                    {selected.popcornmeter === null
                      ? t('Sem nota')
                      : `${selected.popcornmeter}%`}
                  </dd>
                </div>
              </dl>
              {personalStars && selected.tomatometer !== null ? (
                <p>
                  {t(
                    'Sua nota em escala percentual: {0}%. Diferença para a crítica: {1} pontos percentuais.',
                    personalStars * 20,
                    personalStars * 20 - selected.tomatometer,
                  )}
                </p>
              ) : null}
              <div className="rt-footer">
                {/^https:\/\/www\.rottentomatoes\.com\/(m|tv)\/[a-z0-9_-]+$/.test(
                  selected.url,
                ) && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('Ver no Rotten Tomatoes')}{' '}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
                {data && (
                  <p className="rt-timestamp rt-query-date">
                    {t(
                      'Consulta realizada em {0}',
                      new Date(data.queriedAt).toLocaleString(language),
                    )}
                  </p>
                )}
                <Button
                  variant="ghost"
                  className="rt-correct-match"
                  type="button"
                  onClick={() => setOpen(true)}
                >
                  <Search aria-hidden="true" />
                  {t('Corrigir correspondência')}
                </Button>
              </div>
            </>
          )}
          {!busy && !error && data && !selected && (
            <p>
              {t(
                'Não foi possível identificar o título com segurança. Escolha o resultado correspondente.',
              )}
            </p>
          )}
        </div>
        {!busy && !selected && (
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            <Search aria-hidden="true" />
            {t('Escolher título')}
          </Button>
        )}
      </section>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="rt-dialog">
          <DialogTitle>{t('Notas no Rotten Tomatoes')}</DialogTitle>
          <DialogDescription>
            {t(
              'Confira o título e o ano para identificar o resultado correto.',
            )}
          </DialogDescription>
          <form onSubmit={(event) => void search(event)} className="rt-search">
            <label htmlFor="rt-year">{t('Ano de lançamento')}</label>
            <Input
              id="rt-year"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={filterYear}
              placeholder={t('Todos os anos')}
              onChange={(event) =>
                setFilterYear(event.target.value.replace(/\D/g, '').slice(0, 4))
              }
            />
            <label htmlFor="rt-title">
              {t(kind === 'series' ? 'Título da série' : 'Título do filme')}
            </label>
            <div>
              <Input
                id="rt-title"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                minLength={2}
                maxLength={100}
                required
              />
              <Button type="submit" disabled={busy || query.trim().length < 2}>
                {busy ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Search aria-hidden="true" />
                )}
                {t('Buscar')}
              </Button>
            </div>
          </form>
          <div aria-live="polite" aria-busy={busy}>
            {busy && <p>{t('Consultando notas…')}</p>}
            {error && (
              <p className="home-error" role="alert">
                {error}
              </p>
            )}
            {data && (
              <>
                {!data.results.length && (
                  <p>
                    {t('Nenhum título encontrado. Tente o título original.')}
                  </p>
                )}
                <div className="rt-results">
                  {data.results.map((result) => (
                    <article key={result.url}>
                      <h3>
                        {result.title}{' '}
                        {result.year ? <span>({result.year})</span> : null}
                      </h3>
                      {!!result.directors?.length && (
                        <p className="rt-timestamp">
                          {t('Direção')}: {result.directors.join(', ')}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelected(result);
                          close(false);
                        }}
                      >
                        {t('Usar este título')}
                      </Button>
                      <dl className="rt-scores">
                        <div>
                          <dt>Tomatometer</dt>
                          <dd>
                            {result.tomatometer === null
                              ? t('Sem nota')
                              : `${result.tomatometer}%`}
                          </dd>
                        </div>
                        <div>
                          <dt>Popcornmeter</dt>
                          <dd>
                            {result.popcornmeter === null
                              ? t('Sem nota')
                              : `${result.popcornmeter}%`}
                          </dd>
                        </div>
                      </dl>
                      {/^https:\/\/www\.rottentomatoes\.com\/(m|tv)\/[a-z0-9_-]+$/.test(
                        result.url,
                      ) && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('Ver no Rotten Tomatoes')}{' '}
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      )}
                    </article>
                  ))}
                </div>
                <p className="rt-timestamp rt-query-date">
                  {t(
                    'Consulta realizada em {0}',
                    new Date(data.queriedAt).toLocaleString(language),
                  )}
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
