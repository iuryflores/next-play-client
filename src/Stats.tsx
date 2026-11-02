import { RefreshCw } from 'lucide-react';
import GameActivity from './GameActivity';
import { gameActivity } from './game-activity';
import IconAction from './IconAction';
import PageLoading from './PageLoading';
import VotedActor from './VotedActor';
import { orderRanking } from './stats-summary';
import RankMovement, { rankingKey, type RankingChanges } from './RankMovement';
import FeelingSources, { type FeelingSource } from './FeelingSources';
import CompanyRankingEntry from './CompanyRankingEntry';
import { summarizeKind, summarizeActors } from './stats-summary';
import VotedCharacter from './VotedCharacter';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Gamepad2, Library, Star, CirclePlay } from 'lucide-react';
import { dateLabel } from './i18n';
import { t } from './i18n';
import { genreLabel, language } from './i18n';
import { useEffect, useEffectEvent, useState } from 'react';
import { Clock3, Tv, CheckCheck, Film, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { libraryRequest, type LibraryItem } from './library';
import { request } from './episode-client';
import { ApiError } from './auth';
type StatsData = {
  rankingPositions?: Record<string, Record<string, number>>;
  rankingChanges?: RankingChanges;
  rankingUpdatedAt?: string | null;
  totalEpisodes: number;
  seriesMissingTotals: number;
  movieMinutes: number;
  moviesMissingRuntime: number;
  preferences: {
    feelingSources?: FeelingSource[];
    watchedMovieCompanies: {
      id: number;
      name: string;
      logoUrl?: string | null;
      count: number;
    }[];
    watchedSeriesCompanies: {
      id: number;
      name: string;
      logoUrl?: string | null;
      count: number;
    }[];
    watchedMoviesMissingCompanies: number;
    watchedSeriesMissingCompanies: number;
    productionCompanies: {
      id: number;
      name: string;
      logoUrl?: string | null;
      count: number;
    }[];
    moviesMissingCompanies: number;
    seriesProductionCompanies: {
      id: number;
      name: string;
      logoUrl?: string | null;
      count: number;
    }[];
    seriesMissingCompanies: number;
    actors: {
      sources?: import('./stats-summary').ActorVoteSource[];
      id: string;
      name: string;
      photo: string;
      kind: string;
      count: number;
    }[];
    unmatchedActorVotes: Record<string, number>;
    characters: {
      name: string;
      itemId: string;
      title: string;
      count: number;
    }[];
    addedGenres: { name: string; count: number }[];
    watchedGenres: { name: string; count: number }[];
    seriesFeelings: {
      itemId: string;
      title: string;
      ratedEpisodes: number;
      feelings: { feeling: string; count: number }[];
    }[];
  };
  episodes: number;
  seriesWatched: number;
  seriesCompleted: number;
  moviesCompleted: number;
  minutes: number;
  missingRuntime: number;
  pendingSeries: number;
  bySeries: {
    id: string;
    title: string;
    episodes: number;
    minutes: number;
    missingRuntime: number;
  }[];
};
function genreColor(name: string) {
  let hash = 0;
  for (const letter of name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase())
    hash = (hash * 31 + letter.charCodeAt(0)) % 95;
  return `hsl(${250 + hash} 70% 72%)`;
}
const duration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
const percentage = (value: number, total: number) =>
  new Intl.NumberFormat(language, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(total > 0 ? value / total : 0);
export default function Stats({
  items,
  onExpired,
}: {
  items: LibraryItem[];
  onExpired: () => void;
}) {
  const [tab, setTab] = useState('general');
  const [visitId] = useState(() => crypto.randomUUID());
  const [rankingLimits, setRankingLimits] = useState<Record<string, number>>(
    {},
  );
  const rankingPageSize = (ranking: string) =>
    tab === 'movie' && ranking === 'actors' ? 10 : 5;
  const rankingLimit = (ranking: string) =>
    rankingLimits[`${tab}:${ranking}`] || rankingPageSize(ranking);
  const rankingControls = (ranking: string, total: number) =>
    total > rankingPageSize(ranking) ? (
      <div className="ranking-controls">
        {rankingLimit(ranking) < total && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setRankingLimits((current) => ({
                ...current,
                [`${tab}:${ranking}`]:
                  (current[`${tab}:${ranking}`] || rankingPageSize(ranking)) +
                  rankingPageSize(ranking),
              }))
            }
          >
            {t('Ver mais')}
          </Button>
        )}
        {rankingLimit(ranking) > rankingPageSize(ranking) && (
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setRankingLimits((current) => ({
                ...current,
                [`${tab}:${ranking}`]: rankingPageSize(ranking),
              }))
            }
          >
            {t('Ver menos')}
          </Button>
        )}
      </div>
    ) : null;
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const pending = items
    .filter(
      (item) =>
        item.kind === 'series' &&
        item.status === 'completed' &&
        !item.episodesCompletedAt &&
        item.catalogId?.startsWith('tmdb:series:'),
    )
    .map((item) => item.id)
    .join(',');
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    let active = true;
    void (async () => {
      for (const id of pending.split(',').filter(Boolean)) {
        if (!active) return;
        try {
          await request(id, 'POST', {}, 'complete');
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 401) throw reason;
        }
      }
      if (!active) return;
      const movies = items.filter(
        (item) =>
          item.kind === 'movie' &&
          item.status === 'completed' &&
          item.runtime === undefined,
      );
      async function loadRuntime() {
        while (active && movies.length) {
          const item = movies.shift()!;
          try {
            await libraryRequest('POST', item.id, {}, 'runtime');
          } catch (reason) {
            if (reason instanceof ApiError && reason.status === 401)
              throw reason;
          }
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(4, movies.length) }, loadRuntime),
      );
      if (!active) return;
      const pendingCompanies = items.filter(
        (item) =>
          ['movie', 'series'].includes(item.kind) &&
          (item.productionCompanies === undefined ||
            item.productionCompanies.some(
              (company) => company.logoUrl === undefined,
            )),
      );
      async function loadCompanies() {
        while (active && pendingCompanies.length) {
          const item = pendingCompanies.shift()!;
          try {
            await libraryRequest('POST', item.id, {}, 'production-companies');
          } catch (reason) {
            if (reason instanceof ApiError && reason.status === 401)
              throw reason;
          }
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(4, pendingCompanies.length) },
          loadCompanies,
        ),
      );
      if (!active) return;
      const result = await libraryRequest<StatsData>(
        'GET',
        'stats',
        undefined,
        undefined,
        visitId,
      );
      if (active) {
        setData(result);
        setError('');
      }
    })().catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) expired();
      else setError(t('Não foi possível carregar suas estatísticas.'));
    });
    return () => {
      active = false;
    };
  }, [items, pending, retry, visitId]);
  if (error)
    return (
      <div role="alert" className="home-error">
        {error}
        <Button
          variant="outline"
          onClick={() => setRetry((value) => value + 1)}
        >
          {t(' Tentar novamente ')}
        </Button>
      </div>
    );
  if (!data)
    return (
      <PageLoading label={t('Preparando seu histórico e suas estatísticas…')} />
    );
  const summary = summarizeKind(items, tab);
  const games = gameActivity(items);
  const order = <T,>(
    rows: T[],
    ranking: string,
    key: (row: T) => string | number,
  ) => orderRanking(rows, data.rankingPositions?.[ranking], key);
  const combinedActors = order(
    summarizeActors(data.preferences?.actors || []),
    'general:actors',
    (actor) => actor.id,
  );
  const unmatchedActors =
    (data.preferences?.unmatchedActorVotes?.movie || 0) +
    (data.preferences?.unmatchedActorVotes?.series || 0);
  const preferences = {
    ...data.preferences,
    watchedCompanies:
      tab === 'series'
        ? data.preferences.watchedSeriesCompanies
        : data.preferences.watchedMovieCompanies,
    watchedMissingCompanies:
      tab === 'series'
        ? data.preferences.watchedSeriesMissingCompanies
        : data.preferences.watchedMoviesMissingCompanies,
    productionCompanies:
      tab === 'series'
        ? data.preferences.seriesProductionCompanies
        : data.preferences.productionCompanies,
    missingCompanies:
      tab === 'series'
        ? data.preferences.seriesMissingCompanies
        : data.preferences.moviesMissingCompanies,
    addedGenres: summary.addedGenres,
    watchedGenres: summary.watchedGenres,
    characters: (data.preferences?.characters || []).filter(
      (entry) => items.find((item) => item.id === entry.itemId)?.kind === tab,
    ),
  };
  preferences.actors = order(
    preferences.actors.filter((actor) => actor.kind === tab),
    `${tab}:actors`,
    (actor) => actor.id,
  );
  preferences.characters = order(
    preferences.characters,
    `${tab}:characters`,
    (entry) => `${entry.itemId}:${entry.name}`,
  );
  preferences.productionCompanies = order(
    preferences.productionCompanies || [],
    `${tab}:companies-added`,
    (company) => company.id,
  );
  preferences.watchedCompanies = order(
    preferences.watchedCompanies || [],
    `${tab}:companies-watched`,
    (company) => company.id,
  );
  preferences.addedGenres = order(
    preferences.addedGenres,
    `${tab}:addedGenres`,
    (entry) => rankingKey(entry.name),
  );
  preferences.watchedGenres = order(
    preferences.watchedGenres,
    `${tab}:watchedGenres`,
    (entry) => rankingKey(entry.name),
  );
  const completed = items
    .filter((item) => item.status === 'completed')
    .sort(
      (a, b) =>
        (Date.parse(b.completedOn || b.completedAt || '') || 0) -
        (Date.parse(a.completedOn || a.completedAt || '') || 0),
    )
    .slice(0, 5);
  const cards =
    tab === 'general'
      ? [
          {
            label: t('Filmes na coleção'),
            value: items.filter((item) => item.kind === 'movie').length,
            Icon: Film,
          },
          {
            label: t('Séries na coleção'),
            value: items.filter((item) => item.kind === 'series').length,
            Icon: Tv,
          },
          {
            label: t('Jogos na coleção'),
            value: items.filter((item) => item.kind === 'game').length,
            Icon: Gamepad2,
          },
          {
            label: t('Livros lidos'),
            value: items.filter(
              (item) => item.kind === 'book' && item.status === 'completed',
            ).length,
            Icon: BookOpen,
          },
          {
            label: t('Títulos concluídos'),
            value: items.filter((item) => item.status === 'completed').length,
            Icon: CheckCheck,
          },
        ]
      : tab !== 'series'
        ? [
            { label: t('Na coleção'), value: summary.total, Icon: Library },
            ...(tab === 'game'
              ? [
                  {
                    label: t('Tempo total jogado'),
                    value: duration(games.totalMinutes),
                    Icon: Clock3,
                  },
                  {
                    label: t('Para começar'),
                    value: games.planned,
                    Icon: Gamepad2,
                  },
                  {
                    label: t('Taxa de conclusão'),
                    value: `${games.completionRate}%`,
                    Icon: CheckCheck,
                  },
                ]
              : []),
            ...(tab === 'movie'
              ? [
                  {
                    label: t('Tempo em filmes'),
                    value: duration(data.movieMinutes || 0),
                    Icon: Clock3,
                  },
                ]
              : []),
            {
              label: t(
                tab === 'movie' ? 'Filmes assistidos' : 'Jogos concluídos',
              ),
              value: summary.completed,
              Icon: CheckCheck,
            },
            {
              label: t(tab === 'movie' ? 'Quero assistir' : 'Em andamento'),
              value:
                tab === 'movie'
                  ? summary.total - summary.completed
                  : summary.active,
              Icon: CirclePlay,
            },
            {
              label: t('Nota média dos títulos'),
              value:
                summary.average === null
                  ? '—'
                  : summary.average.toLocaleString(language, {
                      maximumFractionDigits: 1,
                    }) + ' / 5',
              Icon: Star,
            },
          ]
        : [
            {
              label: t('Episódios assistidos'),
              value: `${data.episodes}/${data.totalEpisodes ?? data.episodes}`,
              Icon: CheckCheck,
            },
            {
              label: t('Tempo em séries'),
              value: duration(data.minutes),
              Icon: Clock3,
            },
            {
              label: t('Séries concluídas'),
              value: data.seriesCompleted,
              Icon: Tv,
            },
            {
              label: t('Séries em dia'),
              value: items.filter(
                (item) =>
                  item.kind === 'series' &&
                  item.caughtUp &&
                  item.status !== 'completed' &&
                  !item.archived,
              ).length,
              Icon: CheckCheck,
            },
          ];
  return (
    <section className="stats-page" aria-label={t('Suas estatísticas')}>
      <p className="stats-note">
        {t(
          'Variação desde sua visita anterior às estatísticas. Em caso de empate, a ordem anterior é mantida.',
        )}
      </p>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          aria-label={t('Estatísticas por tipo')}
          variant="line"
          className="stats-tabs"
        >
          <TabsTrigger value="general">{t('Geral')}</TabsTrigger>
          <TabsTrigger value="movie">{t('Filmes')}</TabsTrigger>
          <TabsTrigger value="series">{t('Séries')}</TabsTrigger>
          <TabsTrigger value="game">{t('Jogos')}</TabsTrigger>
          <TabsTrigger value="book" disabled>
            {t('Livros')} · {t('Em breve')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <h2>{t('Sua atividade')}</h2>
          <p className="stats-note">
            {t('Todo o seu histórico, incluindo títulos arquivados.')}
          </p>
          <div className="stats-grid">
            {cards.map(({ label, value, Icon }) => (
              <article className="stat-card" key={label}>
                <Icon aria-hidden="true" />
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
          {tab === 'game' && <GameActivity items={items} />}
          {tab === 'series' && (
            <>
              <p className="stats-note">
                {t(
                  '{0} episódios restantes de {1} no catálogo.',
                  Math.max(0, (data.totalEpisodes || 0) - data.episodes),
                  data.totalEpisodes || 0,
                )}{' '}
                {t(
                  'O total considera apenas episódios já lançados e os que você marcou como assistidos.',
                )}
                {data.seriesMissingTotals > 0 && (
                  <>
                    {' '}
                    {t(
                      '{0} séries têm dados de episódios ou datas incompletos; o total pode estar incompleto.',
                      data.seriesMissingTotals,
                    )}
                  </>
                )}
              </p>
              <p className="stats-note">
                {t(
                  'Temporadas e séries marcadas por inteiro contam todos os episódios já lançados, uma vez por episódio. O tempo soma suas durações; filmes e jogos não entram nessa duração.',
                )}
              </p>
              {!!data.missingRuntime && (
                <p className="stats-note">
                  {data.missingRuntime}{' '}
                  {t(
                    ' episódios sem duração informada ficaram fora do cálculo de tempo. ',
                  )}
                </p>
              )}
              {!!data.pendingSeries && (
                <div className="home-error">
                  {data.pendingSeries}{' '}
                  {t(
                    ' séries concluídas ainda precisam dos dados dos episódios. Os totais podem estar incompletos. ',
                  )}
                  <IconAction
                    variant="link"
                    onClick={() => setRetry((value) => value + 1)}
                    label={t('Atualizar dados')}
                    icon={RefreshCw}
                  />
                </div>
              )}
            </>
          )}
          {tab === 'movie' && (
            <p className="stats-note">
              {t(
                'Soma da duração dos filmes assistidos, uma vez por título, incluindo arquivados.',
              )}
              {data.moviesMissingRuntime > 0 && (
                <>
                  {' '}
                  {t(
                    '{0} filmes sem duração informada ficaram fora do cálculo.',
                    data.moviesMissingRuntime,
                  )}{' '}
                  <IconAction
                    variant="link"
                    onClick={() => setRetry((value) => value + 1)}
                    label={t('Atualizar dados')}
                    icon={RefreshCw}
                  />
                </>
              )}
            </p>
          )}
          {tab === 'series' && (
            <FeelingSources
              rankingPositions={data.rankingPositions}
              rankingChanges={data.rankingChanges}
              key={tab}
              sources={(data.preferences.feelingSources || [])
                .filter((source) => source.kind === 'series')
                .map((source) => ({
                  ...source,
                  title:
                    items.find((item) => item.id === source.itemId)?.title ||
                    source.title,
                }))}
            />
          )}
          {tab === 'general' && (
            <section className="stats-preferences">
              <div className="preferences-grid">
                <article>
                  <h3>{t('Atores mais votados')}</h3>
                  <p>
                    {t(
                      'Soma dos votos nos personagens de cada ator em filmes e séries.',
                    )}
                  </p>
                  {combinedActors.length ? (
                    <ol>
                      {combinedActors
                        .slice(0, rankingLimit('actors'))
                        .map((actor, index) => (
                          <li key={actor.id} value={index + 1}>
                            <RankMovement
                              changes={data.rankingChanges}
                              ranking="general:actors"
                              id={actor.id}
                            />
                            <VotedActor
                              name={actor.name}
                              photo={actor.photo}
                              count={actor.count}
                              sources={actor.sources?.map((source) => ({
                                ...source,
                                title:
                                  items.find(
                                    (item) => item.id === source.itemId,
                                  )?.title || source.title,
                              }))}
                            />
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p>{t('Nenhum voto associado a um ator ainda.')}</p>
                  )}
                  {rankingControls('actors', combinedActors.length)}
                  {!!unmatchedActors && (
                    <p>
                      {t(
                        '{0} votos sem ator identificado no elenco não entram neste ranking.',
                        unmatchedActors,
                      )}
                    </p>
                  )}
                </article>
              </div>
              <h2>{t('Últimos títulos concluídos')}</h2>
              <div className="stats-series">
                {completed.length ? (
                  completed.map((item) => (
                    <article key={item.id}>
                      <strong>{item.title}</strong>
                      <span>
                        {item.completedOn || item.completedAt
                          ? dateLabel(item.completedOn || item.completedAt!)
                          : '—'}
                      </span>
                    </article>
                  ))
                ) : (
                  <p>{t('Nenhum título concluído ainda.')}</p>
                )}
              </div>
            </section>
          )}
          {tab !== 'general' && (
            <section className="stats-preferences">
              <h2>{t('Suas preferências')}</h2>
              <div className="preferences-grid">
                {(tab === 'series' || tab === 'movie') && (
                  <>
                    <article
                      className={
                        tab === 'movie' ? 'movie-actors-ranking' : undefined
                      }
                    >
                      <h3>{t('Atores mais votados')}</h3>
                      <p>
                        {t(
                          'Soma dos votos nos personagens de cada ator nesta aba.',
                        )}
                      </p>
                      {(preferences.actors || []).some(
                        (actor) => actor.kind === tab,
                      ) ? (
                        <ol>
                          {preferences.actors
                            .filter((actor) => actor.kind === tab)
                            .slice(0, rankingLimit('actors'))
                            .map((actor, index) => (
                              <li
                                key={actor.kind + ':' + actor.id}
                                value={index + 1}
                              >
                                <RankMovement
                                  changes={data.rankingChanges}
                                  ranking={`${tab}:actors`}
                                  id={actor.id}
                                />
                                <VotedActor
                                  name={actor.name}
                                  photo={actor.photo}
                                  count={actor.count}
                                />
                              </li>
                            ))}
                        </ol>
                      ) : (
                        <p>{t('Nenhum voto associado a um ator ainda.')}</p>
                      )}
                      {rankingControls(
                        'actors',
                        (preferences.actors || []).filter(
                          (actor) => actor.kind === tab,
                        ).length,
                      )}
                      {!!preferences.unmatchedActorVotes?.[tab] && (
                        <p>
                          {t(
                            '{0} votos sem ator identificado no elenco não entram neste ranking.',
                            preferences.unmatchedActorVotes[tab],
                          )}
                        </p>
                      )}
                    </article>
                    {tab === 'series' && (
                      <article>
                        <h3>{t('Personagens mais votados')}</h3>
                        <p>
                          {t(
                            'Votos deste tipo de título. Cada avaliação conta um voto.',
                          )}
                        </p>
                        {preferences.characters.length ? (
                          <ol>
                            {preferences.characters
                              .slice(0, rankingLimit('characters'))
                              .map((entry, index) => (
                                <li
                                  key={`${entry.itemId}:${entry.name}`}
                                  value={index + 1}
                                >
                                  <RankMovement
                                    changes={data.rankingChanges}
                                    ranking={`${tab}:characters`}
                                    id={`${entry.itemId}:${entry.name}`}
                                  />
                                  <VotedCharacter
                                    itemId={entry.itemId}
                                    name={entry.name}
                                    title={
                                      items.find(
                                        (item) => item.id === entry.itemId,
                                      )?.title || entry.title
                                    }
                                    count={entry.count}
                                  />
                                </li>
                              ))}
                          </ol>
                        ) : (
                          <p>
                            {t(
                              'Vote em um personagem ao avaliar para começar.',
                            )}
                          </p>
                        )}
                        {rankingControls(
                          'characters',
                          preferences.characters.length,
                        )}
                      </article>
                    )}
                  </>
                )}
                {(tab === 'movie' || tab === 'series') &&
                  (['added', 'watched'] as const).map((mode) => {
                    const companies =
                      (mode === 'added'
                        ? preferences.productionCompanies
                        : preferences.watchedCompanies) || [];
                    const missing =
                      mode === 'added'
                        ? preferences.missingCompanies
                        : preferences.watchedMissingCompanies;
                    const ranking = 'companies-' + mode;
                    return (
                      <article
                        key={mode}
                        className={`stats-comparison-${mode}`}
                      >
                        <h3>
                          {t(
                            mode === 'added'
                              ? 'Produtoras mais adicionadas'
                              : 'Produtoras mais assistidas',
                          )}
                        </h3>
                        <p>
                          {t(
                            mode === 'watched'
                              ? tab === 'series'
                                ? 'Séries com episódios assistidos ou concluídas. Cada série conta uma vez por produtora, incluindo arquivadas.'
                                : 'Filmes assistidos. Cada filme conta uma vez por produtora, incluindo arquivados.'
                              : tab === 'series'
                                ? 'Séries na sua coleção, incluindo arquivadas e não assistidas. Cada série conta uma vez por produtora creditada.'
                                : 'Filmes na sua coleção, incluindo arquivados e não assistidos. Cada filme conta uma vez por produtora creditada.',
                          )}
                        </p>
                        {companies.length ? (
                          <ol>
                            {companies
                              .slice(0, rankingLimit(ranking))
                              .map((company, index) => (
                                <li key={company.id} value={index + 1}>
                                  <RankMovement
                                    changes={data.rankingChanges}
                                    ranking={`${tab}:${ranking}`}
                                    id={company.id}
                                  />
                                  <CompanyRankingEntry company={company} />
                                </li>
                              ))}
                          </ol>
                        ) : (
                          <p>{t('Nenhuma produtora disponível ainda.')}</p>
                        )}
                        {rankingControls(ranking, companies.length)}
                        {!!missing && (
                          <p>
                            {t(
                              tab === 'series'
                                ? '{0} séries sem produtora informada ficaram fora deste ranking.'
                                : '{0} filmes sem produtora informada ficaram fora deste ranking.',
                              missing,
                            )}
                          </p>
                        )}
                      </article>
                    );
                  })}
                {tab === 'game' &&
                  (['addedPlatforms', 'completedPlatforms'] as const).map(
                    (key) => (
                      <article
                        key={key}
                        className={
                          key === 'addedPlatforms'
                            ? 'stats-comparison-added'
                            : 'stats-comparison-watched'
                        }
                      >
                        <h3>
                          {t(
                            key === 'addedPlatforms'
                              ? 'Plataformas dos jogos adicionados'
                              : 'Plataformas dos jogos concluídos',
                          )}
                        </h3>
                        <p>
                          {t(
                            'Cada jogo conta na plataforma informada no seu acompanhamento.',
                          )}
                        </p>
                        {summary[key].length ? (
                          <div className="genre-chart">
                            <ul className="genre-chart-list">
                              {summary[key]
                                .slice(0, rankingLimit(key))
                                .map((entry) => (
                                  <li
                                    className="genre-chart-row"
                                    key={entry.name}
                                  >
                                    <div className="genre-chart-label">
                                      <strong>{entry.name}</strong>
                                      <span>{t('{0} jogos', entry.count)}</span>
                                    </div>
                                    <div
                                      className="genre-chart-track"
                                      aria-hidden="true"
                                    >
                                      <div
                                        className="genre-chart-bar"
                                        style={{
                                          width: `${(entry.count / Math.max(1, ...summary.addedPlatforms.map((platform) => platform.count))) * 100}%`,
                                          backgroundColor: genreColor(
                                            entry.name,
                                          ),
                                        }}
                                      />
                                    </div>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : (
                          <p>
                            {t(
                              'Nenhuma plataforma informada para estes jogos.',
                            )}
                          </p>
                        )}
                        {rankingControls(key, summary[key].length)}
                        {key === 'addedPlatforms' &&
                          summary.missingPlatforms > 0 && (
                            <p>
                              {t(
                                '{0} jogos sem plataforma informada. Edite o jogo para completar.',
                                summary.missingPlatforms,
                              )}
                            </p>
                          )}
                      </article>
                    ),
                  )}
                {(['addedGenres', 'watchedGenres'] as const).map((key) => (
                  <article
                    key={key}
                    className={
                      key === 'addedGenres'
                        ? 'stats-comparison-added'
                        : 'stats-comparison-watched'
                    }
                  >
                    <h3>
                      {t(
                        key === 'watchedGenres'
                          ? tab === 'game'
                            ? 'Gêneros mais concluídos'
                            : 'Gêneros mais assistidos'
                          : 'Gêneros mais adicionados',
                      )}
                    </h3>
                    <p>
                      {t(
                        key === 'watchedGenres'
                          ? 'Títulos assistidos ou concluídos desta aba. Cada título conta uma vez por gênero.'
                          : 'Títulos desta aba na coleção. Cada título conta uma vez por gênero.',
                      )}
                    </p>
                    {preferences[key].length ? (
                      <div className="genre-chart">
                        <ul className="genre-chart-list">
                          {preferences[key]
                            .slice(0, rankingLimit(key))
                            .map((entry) => (
                              <li className="genre-chart-row" key={entry.name}>
                                <RankMovement
                                  changes={data.rankingChanges}
                                  ranking={`${tab}:${key}`}
                                  id={rankingKey(entry.name)}
                                />
                                <div className="genre-chart-label">
                                  <strong>{genreLabel(entry.name)}</strong>
                                  <span>{t('{0} títulos', entry.count)}</span>
                                </div>
                                <div
                                  className="genre-chart-track"
                                  aria-hidden="true"
                                >
                                  <div
                                    className="genre-chart-bar"
                                    style={{
                                      width: `${(entry.count / Math.max(1, ...preferences.addedGenres.map((genre) => genre.count), ...preferences.watchedGenres.map((genre) => genre.count))) * 100}%`,
                                      backgroundColor: genreColor(entry.name),
                                    }}
                                  />
                                </div>
                              </li>
                            ))}
                        </ul>
                        <div className="genre-chart-scale" aria-hidden="true">
                          <span>0</span>
                          <span>
                            {Math.max(
                              1,
                              ...preferences.addedGenres.map(
                                (genre) => genre.count,
                              ),
                              ...preferences.watchedGenres.map(
                                (genre) => genre.count,
                              ),
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p>
                        {t(
                          'Ainda não há gêneros suficientes para mostrar suas preferências.',
                        )}
                      </p>
                    )}
                    {rankingControls(key, preferences[key].length)}
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === 'series' && (
            <>
              <h2>{t(' Seu tempo por série ')}</h2>
              <p className="stats-note">
                {t(
                  'A barra representa a participação da série no seu tempo total, não o progresso para concluí-la.',
                )}
              </p>
              {data.bySeries.length ? (
                <div className="stats-series">
                  {order(
                    data.bySeries,
                    'series:time',
                    (series) => series.id,
                  ).map((series) => (
                    <article key={series.id}>
                      <RankMovement
                        changes={data.rankingChanges}
                        ranking="series:time"
                        id={series.id}
                      />
                      <div>
                        <strong>
                          {items.find((item) => item.id === series.id)?.title ||
                            series.title}
                        </strong>
                        <small>
                          {series.episodes} {t(' episódios assistidos ')}
                          {' · '}
                          {t(
                            '{0} dos episódios assistidos',
                            percentage(series.episodes, data.episodes),
                          )}
                          {series.missingRuntime
                            ? t(' · {0} sem duração', series.missingRuntime)
                            : ''}
                        </small>
                      </div>
                      <span>
                        {duration(series.minutes)}
                        <small>
                          {t(
                            '{0} do tempo assistido',
                            percentage(series.minutes, data.minutes),
                          )}
                        </small>
                      </span>
                      <progress
                        value={series.minutes}
                        max={Math.max(1, data.minutes)}
                        aria-label={t(
                          'Participação de {0} no tempo assistido',
                          items.find((item) => item.id === series.id)?.title ||
                            series.title,
                        )}
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="collection-empty">
                  {t(
                    ' Marque episódios como assistidos ou uma série como concluída para começar seu histórico. ',
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
