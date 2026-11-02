import { useEffect, useEffectEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { ApiError } from './auth';
import { categories, type Kind, type LibraryItem } from './library';
import { language, t } from './i18n';
import './insights.css';
import './lists.css';
type Ranked = { id: string; title: string; kind: Kind; stars: number };
type Year = {
  year: string;
  movies: number;
  books: number;
  games: number;
  episodes: number;
  rewatches: number;
  minutes: number;
  gameMinutes: number;
  missingRuntime: number;
  average: number | null;
  activeDays: number;
  genres: { name: string; count: number }[];
  ranking: Ranked[];
};
type Summary = {
  annotations: {
    itemId: string;
    actors: string[];
    directors: string[];
    authors: string[];
    franchise: string;
  }[];
  creators: { role: string; name: string; count: number }[];
  missingCredits: number;
  franchises: { name: string; count: number; average: number | null }[];
  pendingMetadataIds: string[];
  criticComparison: {
    title: string;
    personal: number;
    critics: number;
    difference: number;
    url: string;
    queriedAt: string;
  }[];
  unknownDates: number;
  years: Year[];
  allTimeFavorites: Ranked[];
};
type Event = {
  id: string;
  title: string;
  kind: Kind;
  type: string;
  date: string | null;
  minutes: number | null;
  season?: number;
  episode?: number;
};
type History = { events: Event[]; nextBefore: string | null };
type ActivityPage = {
  events: {
    id: string;
    title: string;
    kind: Kind;
    type: string;
    recordedAt: string;
  }[];
  nextBefore: string | null;
};
async function read<T>(path = ''): Promise<T> {
  const response = await fetch('/api/insights' + path, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new ApiError(response.status, t('Não foi possível carregar.'));
  return response.json();
}
const hours = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
function activityLabel(type: string) {
  const [action, reference] = type.split(':');
  const labels: Record<string, string> = {
    added: 'Adicionado',
    started: 'Iniciado',
    completed: 'Concluído',
    edited: 'Editado',
    planned: 'Para depois',
    archived: 'Arquivado',
    restored: 'Restaurado',
    deleted: 'Excluído',
    'game-session-added': 'Sessão de jogo adicionada',
    'game-session-edited': 'Sessão de jogo editada',
    'game-session-deleted': 'Sessão de jogo excluída',
    'rewatch-planned': 'Revisita planejada',
    'rewatch-unplanned': 'Revisita desmarcada',
    'episode-updated': 'Episódio atualizado',
    'season-watched': 'Temporada marcada como assistida',
    'episodes-watched': 'Episódios marcados como assistidos',
    'episodes-unwatched': 'Marcação de episódios removida',
  };
  return (
    t(labels[action] || 'Atividade registrada') +
    (reference ? ' · ' + reference : '')
  );
}
export default function Insights({
  onExpired,
  items,
}: {
  onExpired: () => void;
  items: LibraryItem[];
}) {
  const [annotationId, setAnnotationId] = useState('');
  const [activity, setActivity] = useState<ActivityPage | null>(null);
  const [annotation, setAnnotation] = useState({
    actors: '',
    directors: '',
    authors: '',
    franchise: '',
  });
  const [open, setOpen] = useState(false),
    [summary, setSummary] = useState<Summary | null>(null),
    [history, setHistory] = useState<History | null>(null),
    [year, setYear] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [limit, setLimit] = useState(10);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void Promise.all([
      read<Summary>(),
      read<History>('/history'),
      read<ActivityPage>('/activity'),
    ])
      .then(([data, events, activities]) => {
        if (active) {
          setSummary(data);
          setHistory(events);
          setActivity(activities);
          setYear(data.years[0]?.year || '');
          setError('');
        }
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(t('Não foi possível carregar.'));
      });
    return () => {
      active = false;
    };
  }, [open]);
  const selected = summary?.years.find((row) => row.year === year);
  return (
    <details
      className="insights"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {t('Histórico, retrospectivas e comparação entre anos')}
      </summary>
      {error && <p role="alert">{error}</p>}
      {open && !summary && !error && <p>{t('Carregando…')}</p>}
      {summary && (
        <div className="insights-body">
          <p className="stats-note">
            {t(
              'As datas são de consumo, não de cadastro. Registros sem data ficam separados. Notas refletem a avaliação atual; tempos sem duração conhecida são parciais.',
            )}
          </p>
          <p>{t('{0} registros sem data conhecida', summary.unknownDates)}</p>
          <label>
            {t('Retrospectiva anual')}
            <NativeSelect
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {summary.years.map((row) => (
                <option key={row.year} value={row.year}>
                  {row.year}
                </option>
              ))}
            </NativeSelect>
          </label>
          {selected && (
            <section className="insights-year">
              <h2>{t('Seu ano em {0}', selected.year)}</h2>
              <div className="insights-counters">
                {[
                  [t('Filmes'), selected.movies],
                  [t('Livros'), selected.books],
                  [t('Jogos'), selected.games],
                  [t('Episódios'), selected.episodes],
                  [t('Revisitas'), selected.rewatches],
                  [t('Dias ativos'), selected.activeDays],
                  [t('Tempo registrado'), hours(selected.minutes)],
                  [t('Tempo em jogos'), hours(selected.gameMinutes)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <h3>{t('Gêneros do ano')}</h3>
              <p>
                {selected.genres
                  .slice(0, 10)
                  .map((row) => `${row.name} (${row.count})`)
                  .join(' · ') || '—'}
              </p>
              <h3>{t('Ranking pessoal do ano')}</h3>
              <ol>
                {selected.ranking.slice(0, limit).map((row) => (
                  <li key={row.id}>
                    {row.title} · {row.stars}/5
                  </li>
                ))}
              </ol>
              {selected.ranking.length > limit && (
                <Button
                  variant="outline"
                  onClick={() => setLimit((value) => value + 20)}
                >
                  {t('Ver mais')}
                </Button>
              )}
            </section>
          )}
          <h2>{t('Comparação entre anos')}</h2>
          <div className="insights-table">
            <table>
              <thead>
                <tr>
                  {[
                    'Ano',
                    'Filmes',
                    'Livros',
                    'Jogos',
                    'Episódios',
                    'Tempo registrado',
                    'Nota média',
                  ].map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.years.map((row) => (
                  <tr key={row.year}>
                    <th>{row.year}</th>
                    <td>{row.movies}</td>
                    <td>{row.books}</td>
                    <td>{row.games}</td>
                    <td>{row.episodes}</td>
                    <td>{hours(row.minutes)}</td>
                    <td>
                      {row.average?.toLocaleString(language, {
                        maximumFractionDigits: 2,
                      }) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>{t('Evolução dos gêneros')}</h2>
          <ul>
            {summary.years.map((row) => (
              <li key={row.year}>
                <strong>{row.year}:</strong>{' '}
                {row.genres
                  .slice(0, 3)
                  .map((genre) => `${genre.name} (${genre.count})`)
                  .join(' · ') || '—'}
              </li>
            ))}
          </ul>
          <h2>{t('Favoritos de todos os tempos')}</h2>
          <ol>
            {summary.allTimeFavorites.slice(0, limit).map((row) => (
              <li key={row.id}>
                {row.title} · {categories[row.kind]} · {row.stars}/5
              </li>
            ))}
          </ol>
          {summary.allTimeFavorites.length > limit && (
            <Button
              variant="outline"
              onClick={() => setLimit((value) => value + 20)}
            >
              {t('Ver mais')}
            </Button>
          )}
          <h2>{t('Criadores mais consumidos')}</h2>
          <details>
            <summary>{t('Completar créditos e franquia de um título')}</summary>
            <form
              className="list-editor"
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                const names = (value: string) => [
                  ...new Set(
                    value
                      .split('\n')
                      .map((name) => name.trim())
                      .filter(Boolean),
                  ),
                ];
                void fetch('/api/insights/annotations/' + annotationId, {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    actors: names(annotation.actors),
                    directors: names(annotation.directors),
                    authors: names(annotation.authors),
                    franchise: annotation.franchise,
                  }),
                  signal: AbortSignal.timeout(30000),
                })
                  .then(async (response) => {
                    if (!response.ok)
                      throw new ApiError(
                        response.status,
                        t('Não foi possível salvar.'),
                      );
                    setSummary(await read<Summary>());
                  })
                  .catch((reason) => {
                    if (reason instanceof ApiError && reason.status === 401)
                      onExpired();
                    else setError(t('Não foi possível salvar.'));
                  })
                  .finally(() => setBusy(false));
              }}
            >
              <label>
                {t('Título')}
                <NativeSelect
                  required
                  value={annotationId}
                  onChange={(event) => {
                    setAnnotationId(event.target.value);
                    const row = summary.annotations.find(
                      (row) => row.itemId === event.target.value,
                    );
                    setAnnotation({
                      actors: row?.actors.join('\n') || '',
                      directors: row?.directors.join('\n') || '',
                      authors: row?.authors.join('\n') || '',
                      franchise: row?.franchise || '',
                    });
                  }}
                >
                  <option value="">{t('Selecione um título')}</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              {(['actors', 'directors', 'authors'] as const).map((field) => (
                <label key={field}>
                  {t(
                    field === 'actors'
                      ? 'Atores'
                      : field === 'directors'
                        ? 'Diretores'
                        : 'Autores',
                  )}
                  <textarea
                    maxLength={2019}
                    rows={3}
                    value={annotation[field]}
                    onChange={(event) =>
                      setAnnotation({
                        ...annotation,
                        [field]: event.target.value,
                      })
                    }
                  />
                </label>
              ))}
              <label>
                {t('Franquia')}
                <Input
                  maxLength={160}
                  value={annotation.franchise}
                  onChange={(event) =>
                    setAnnotation({
                      ...annotation,
                      franchise: event.target.value,
                    })
                  }
                />
              </label>
              <p>
                {t(
                  'Créditos manuais são privados e declarados por você; até vinte nomes por categoria. Não comprovam identidade de homônimos. Franquias manuais podem reunir qualquer mídia.',
                )}
              </p>
              <Button type="submit" disabled={busy || !annotationId}>
                {t('Salvar')}
              </Button>
            </form>
          </details>
          <p>
            {t(
              '{0} títulos com créditos ausentes ou parciais',
              summary.missingCredits,
            )}
          </p>
          {summary.pendingMetadataIds.length > 0 && (
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => {
                setBusy(true);
                void fetch('/api/insights/metadata', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids: summary.pendingMetadataIds }),
                  signal: AbortSignal.timeout(120000),
                })
                  .then(async (response) => {
                    if (!response.ok)
                      throw new ApiError(
                        response.status,
                        t('Não foi possível carregar.'),
                      );
                    setSummary(await read<Summary>());
                  })
                  .catch((reason) => {
                    if (reason instanceof ApiError && reason.status === 401)
                      onExpired();
                    else setError(t('Não foi possível carregar.'));
                  })
                  .finally(() => setBusy(false));
              }}
            >
              {t('Atualizar créditos e franquias (até dez títulos)')}
            </Button>
          )}
          {['actor', 'director', 'author'].map((role) => (
            <section key={role}>
              <h3>
                {t(
                  role === 'actor'
                    ? 'Atores'
                    : role === 'director'
                      ? 'Diretores'
                      : 'Autores',
                )}
              </h3>
              <ol>
                {summary.creators
                  .filter((row) => row.role === role)
                  .slice(0, limit)
                  .map((row, index) => (
                    <li key={role + ':' + index}>
                      {row.name} · {row.count}
                    </li>
                  ))}
              </ol>
            </section>
          ))}
          <h2>{t('Ranking de franquias')}</h2>
          <p>
            {t(
              'Coleções de filmes identificadas pelo TMDB e franquias declaradas por você. Cobertura parcial até atualizar ou completar os dados; agrupamentos manuais e do catálogo permanecem separados.',
            )}
          </p>
          <ol>
            {summary.franchises.map((row, index) => (
              <li key={index}>
                {row.name} · {row.count} · {row.average?.toFixed(2) ?? '—'}/5
              </li>
            ))}
          </ol>
          <h2>{t('Sua nota e a crítica')}</h2>
          <p>
            {t(
              'Notas pessoais convertidas para 0–100. Tomatometer mede aprovação da crítica, não qualidade equivalente à sua nota. As consultas inequívocas feitas nos detalhes alimentam este quadro.',
            )}
          </p>
          <div className="insights-table">
            <table>
              <thead>
                <tr>
                  {['Título', 'Sua nota', 'Crítica', 'Diferença'].map(
                    (label) => (
                      <th key={label}>{t(label)}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {summary.criticComparison.map((row, index) => (
                  <tr key={row.url + ':' + index}>
                    <th>{row.title}</th>
                    <td>{row.personal}%</td>
                    <td>{row.critics}%</td>
                    <td>{row.difference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>{t('Linha do tempo de consumo')}</h2>
          <details>
            <summary>{t('Ações registradas no app')}</summary>
            <p>
              {t(
                'Histórico iniciado nesta atualização. As datas abaixo são de registro, não de consumo. Mudanças antigas que nunca foram gravadas não são reconstruídas.',
              )}
            </p>
            <ol className="insights-history">
              {activity?.events.map((event) => (
                <li key={event.id}>
                  <time>
                    {new Date(event.recordedAt).toLocaleString(language)}
                  </time>
                  <strong>{event.title}</strong>
                  <span>{activityLabel(event.type)}</span>
                </li>
              ))}
            </ol>
            {activity?.nextBefore && (
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void read<ActivityPage>(
                    '/activity?before=' + activity.nextBefore,
                  )
                    .then((next) =>
                      setActivity({
                        ...next,
                        events: [...activity.events, ...next.events],
                      }),
                    )
                    .catch(() => setError(t('Não foi possível carregar.')))
                    .finally(() => setBusy(false));
                }}
              >
                {t('Ver mais eventos')}
              </Button>
            )}
          </details>
          <ol className="insights-history">
            {history?.events.map((event) => (
              <li key={event.id}>
                <time>{event.date || t('Data desconhecida')}</time>
                <strong>{event.title}</strong>
                <span>
                  {event.season !== undefined
                    ? `S${event.season}E${event.episode}`
                    : categories[event.kind]}{' '}
                  ·{' '}
                  {t(
                    event.type === 'session'
                      ? 'Sessão de jogo'
                      : event.type.includes('rewatch')
                        ? 'Revisita'
                        : 'Consumido',
                  )}
                  {event.minutes !== null ? ' · ' + hours(event.minutes) : ''}
                </span>
              </li>
            ))}
          </ol>
          {history?.nextBefore && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void read<History>('/history?before=' + history.nextBefore)
                  .then((next) =>
                    setHistory((current) => ({
                      ...next,
                      events: [...current!.events, ...next.events],
                    })),
                  )
                  .catch((reason) => {
                    if (reason instanceof ApiError && reason.status === 401)
                      onExpired();
                    else setError(t('Não foi possível carregar.'));
                  })
                  .finally(() => setBusy(false));
              }}
            >
              {t('Ver mais eventos')}
            </Button>
          )}
        </div>
      )}
    </details>
  );
}
