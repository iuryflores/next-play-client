import WatchDateField from './WatchDateField';
import { RefreshCw } from 'lucide-react';
import IconAction from './IconAction';
import PageLoading from './PageLoading';
import { dateLabel } from './i18n';
import CastPicker from './CastPicker';
import { Undo2, RotateCcw } from 'lucide-react';
import { ListChecks, CheckCheck } from 'lucide-react';
import { t } from './i18n';
import type { LibraryItem } from './library';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { request, resume } from './episode-client';
import { useReview, feelings } from './Review';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ApiError } from './auth';
import {
  nextEpisode,
  hasEarlierUnwatched,
  type EpisodeData,
  type EpisodeSelection,
} from './episode-navigation';
export default function Episodes({
  itemId,
  item,
  onExpired,
  onProgress,
  onWatched,
}: {
  itemId: string;
  item?: LibraryItem;
  onExpired: () => void;
  onProgress: () => void;
  onWatched?: () => void;
}) {
  const [unwatch, setUnwatch] = useState<
    | { scope: 'season'; season: number; name: string }
    | { scope: 'series' }
    | null
  >(null);
  const [unwatchError, setUnwatchError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState<EpisodeData | null>(null);
  const askReview = useReview();
  const [selection, setSelection] = useState<EpisodeSelection | null>(null);
  const [busy, setBusy] = useState(true);
  const pending = useRef(false);
  const seasonVoteForm = useRef<HTMLFormElement>(null);
  const mounted = useRef(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<
    'through' | 'season' | 'series' | null
  >(null);
  const batchDateForm = useRef<HTMLFormElement>(null);
  const [retry, setRetry] = useState(0);
  const expired = useEffectEvent(onExpired);
  const progressUpdated = useEffectEvent(onProgress);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void request(itemId, 'GET', undefined, false, item?.rewatchActiveId)
      .then((result) =>
        resume(itemId, result, () => active, item?.rewatchActiveId),
      )
      .then((result) => {
        if (active) {
          setData(result);
          setSelection(nextEpisode(result));
          progressUpdated();
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
              : t('Não foi possível carregar.'),
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [itemId, retry, item?.rewatchActiveId]);
  async function run(
    method: string,
    body: object,
    importing: boolean | 'watch-many' | 'unwatch-many' = false,
    target?: number,
  ) {
    if (pending.current || busy) return;
    pending.current = true;
    setBusy(true);
    setError('');
    let saved = false;
    let refreshNeeded = false;
    let returnAfterSave = false;
    try {
      const watch = body as {
        watched?: boolean;
        watchedDateUnknown?: boolean;
        scope?: string;
        season?: number;
        episode?: number;
      };
      if (
        (method === 'PATCH' && watch.watched) ||
        (importing === 'watch-many' && watch.scope === 'through')
      ) {
        const reviewed = data?.seasons
          .find((s) => s.number === watch.season)
          ?.episodes.find((e) => e.number === watch.episode);
        const review = await askReview(
          t(
            'T{0} E{1} · {2}',
            watch.season,
            watch.episode,
            reviewed?.name || 'Episódio',
          ),
          reviewed,
          { itemId, season: watch.season, episode: watch.episode },
          item,
          Boolean(reviewed?.watched || reviewed?.watchedAt),
          reviewed && watch.watchedDateUnknown !== undefined
            ? { ...reviewed, watchedDateUnknown: watch.watchedDateUnknown }
            : reviewed,
        );
        if (!review || !mounted.current) return;
        body = { ...body, ...review };
      }
      let result = await request(
        itemId,
        method,
        body,
        importing,
        item?.rewatchActiveId,
      );
      refreshNeeded = true;
      saved =
        method === 'PATCH' ||
        importing === 'watch-many' ||
        importing === 'unwatch-many';
      if (!mounted.current) return;
      setData(result);
      // O salvamento já está confirmado. A volta ao acompanhamento não depende
      // de importar a próxima temporada; os cards carregam esse detalhe depois.
      returnAfterSave =
        (method === 'PATCH' && watch.watched === true) ||
        importing === 'watch-many';
      if (returnAfterSave && onWatched) {
        setSelection(nextEpisode(result));
        return;
      }
      if (target !== undefined) {
        const season = result.seasons.find((value) => value.number === target);
        setSelection({
          season: target,
          episode: season?.episodes[0]?.number ?? null,
        });
      } else {
        result = await resume(
          itemId,
          result,
          () => mounted.current,
          item?.rewatchActiveId,
        );
        if (mounted.current) {
          setData(result);
          setSelection(nextEpisode(result));
        }
      }
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          (saved
            ? t('Progresso salvo. Não foi possível abrir o próximo episódio: ')
            : '') +
            (reason instanceof Error ? reason.message : t('Tente novamente.')),
        );
    } finally {
      // Uma única atualização após salvar/retomar evita disputar duas leituras da coleção.
      if (refreshNeeded && mounted.current) onProgress();
      pending.current = false;
      if (mounted.current) setBusy(false);
      if (returnAfterSave && mounted.current) onWatched?.();
    }
  }
  const current = selection || (data ? nextEpisode(data) : null);
  const season = data?.seasons.find(
    (value) => value.number === current?.season,
  );
  const episode = season?.episodes.find(
    (value) => value.number === current?.episode,
  );
  const today = new Date().toISOString().slice(0, 10);
  const future = !!episode?.airDate && episode.airDate > today;
  const watched =
    season?.episodes.filter((value) => value.watched || value.watchedAt)
      .length || 0;
  async function confirmUnwatch() {
    if (!unwatch || busy || pending.current) return;
    const target = unwatch;
    pending.current = true;
    setBusy(true);
    setUnwatchError('');
    setNotice('');
    try {
      const result = await request(
        itemId,
        'POST',
        target.scope === 'season'
          ? { scope: target.scope, season: target.season }
          : { scope: target.scope },
        'unwatch-many',
      );
      if (!mounted.current) return;
      setData(result);
      const selected =
        target.scope === 'season'
          ? result.seasons.find((value) => value.number === target.season)
          : result.seasons.find((value) => value.number > 0 && value.loaded);
      setSelection(
        selected
          ? {
              season: selected.number,
              episode: selected.episodes[0]?.number ?? null,
            }
          : nextEpisode(result),
      );
      setUnwatch(null);
      setError('');
      setNotice(
        t(
          target.scope === 'season'
            ? 'Temporada marcada como não assistida.'
            : 'Série marcada como não assistida.',
        ),
      );
      onProgress();
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setUnwatchError(
          reason instanceof Error ? reason.message : t('Tente novamente.'),
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      className="episodes-panel"
      aria-label={t('Próximo episódio da série')}
    >
      <h3>{t(' Continuar assistindo ')}</h3>
      {busy && (
        <PageLoading
          compact
          label={
            data
              ? t('Atualizando episódio…')
              : t('Abrindo seu próximo episódio…')
          }
        />
      )}
      {error && (
        <div className="home-error" role="alert">
          {error}
          <Button
            type="button"
            variant="link"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setRetry((value) => value + 1);
            }}
          >
            {t(' Tentar novamente ')}
          </Button>
        </div>
      )}
      {data && !data.supported && (
        <p>
          {t(
            ' Esta série foi cadastrada manualmente. Adicione a versão do catálogo TMDB para acompanhar os episódios. ',
          )}
        </p>
      )}
      {data?.supported && !episode && !busy && !error && (
        <p>
          {season?.loaded && season.episodes.length === 0
            ? t(
                'Esta temporada ainda não tem episódios cadastrados no catálogo. Ela não está marcada como assistida.',
              )
            : data.seasons.length
              ? t(
                  'Você está em dia com os episódios carregados! Atualize as temporadas para conferir novidades.',
                )
              : t(
                  'O catálogo ainda não disponibilizou temporadas para esta série.',
                )}
        </p>
      )}
      {episode && season && (
        <article
          className="episode-detail"
          aria-label={t(
            'Temporada {0}, episódio {1}',
            season.number,
            episode.number,
          )}
        >
          {episode.stillUrl && (
            <img
              src={episode.stillUrl}
              alt={t('Cena de {0}', episode.name)}
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span className="episode-number">
            {t(' Temporada ')}
            {season.number} {t(' · Episódio ')}
            {episode.number}
          </span>
          <h4>{episode.name}</h4>
          <small>
            {episode.airDate
              ? dateLabel(episode.airDate)
              : t('Data de estreia não informada')}
            {episode.runtime ? ` · ${episode.runtime} min` : ''}
          </small>
          <p>{episode.overview || t('Sinopse não disponível no catálogo.')}</p>
          {(episode.watched || episode.watchedAt) && (
            <p>
              {episode.watchedDateUnknown ? (
                t('Assistido · data desconhecida')
              ) : (
                <>
                  {t(' Assistido em ')} {dateLabel(episode.watchedAt!)}
                </>
              )}
            </p>
          )}
          {(episode.watched || episode.watchedAt) && (
            <div>
              <p>
                {episode.stars ? `${episode.stars}/5 ★` : t('Sem nota')}
                {episode.feeling
                  ? ` · ${feelings[episode.feeling] || episode.feeling}`
                  : ''}
              </p>
              {episode.favoriteCharacter && (
                <p>
                  {t(' Personagem favorito: ')}
                  {episode.favoriteCharacter}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run('PATCH', {
                    season: season.number,
                    episode: episode.number,
                    watched: true,
                  })
                }
              >
                {t(
                  episode.favoriteCharacter
                    ? 'Editar avaliação'
                    : 'Avaliar e votar',
                )}
              </Button>
            </div>
          )}
          <Button
            type="button"
            className="home-primary"
            disabled={
              busy || (future && !(episode.watched || episode.watchedAt))
            }
            onClick={() => {
              if (
                !(episode.watched || episode.watchedAt) &&
                data &&
                hasEarlierUnwatched(data, {
                  season: season.number,
                  episode: episode.number,
                })
              )
                setConfirmation('through');
              else
                void run('PATCH', {
                  season: season.number,
                  episode: episode.number,
                  watched: !(episode.watched || episode.watchedAt),
                });
            }}
          >
            {episode.watched || episode.watchedAt
              ? t('Marcar como não assistido')
              : future
                ? t('Aguardando estreia')
                : t('Já assisti · Próximo episódio')}
          </Button>
          <div className="episode-summary">
            {!!episode.votes?.length && (
              <div>
                <strong>{t(' Personagens favoritos neste episódio ')}</strong>
                <ul>
                  {episode.votes.map((vote) => (
                    <li key={vote.name}>
                      {vote.name} · {vote.count}{' '}
                      {vote.count === 1 ? t('voto') : t('votos')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <strong>
              {watched} {t(' de ')}
              {season.episodes.length} {t(' assistidos nesta temporada ')}
            </strong>
            <progress
              value={watched}
              max={Math.max(1, season.episodes.length)}
              aria-label={t('Progresso da temporada')}
            />
          </div>
        </article>
      )}
      {data?.supported && (
        <details className="episode-picker">
          <summary>{t(' Ver temporadas e escolher outro episódio ')}</summary>
          <label htmlFor="episode-season">{t(' Temporada ')}</label>
          <NativeSelect
            id="episode-season"
            value={season?.number ?? ''}
            disabled={busy}
            onChange={(event) => {
              const number = Number(event.target.value);
              const selected = data.seasons.find(
                (value) => value.number === number,
              );
              if (selected?.loaded)
                setSelection({
                  season: number,
                  episode: selected.episodes[0]?.number ?? null,
                });
              else void run('POST', { season: number }, true, number);
            }}
          >
            <option value="" disabled>
              {t(' Escolha uma temporada ')}
            </option>
            {data.seasons.map((value) => (
              <option key={value.number} value={value.number}>
                {value.name}
              </option>
            ))}
          </NativeSelect>
          <div className="episode-list">
            {season?.episodes.map((value) => (
              <button
                aria-label={t(
                  'Abrir episódio {0}: {1}',
                  value.number,
                  value.name,
                )}
                type="button"
                className={`episode-row ${value.watched || value.watchedAt ? 'watched' : ''}`}
                key={value.number}
                disabled={busy}
                aria-pressed={value.number === episode?.number}
                onClick={() =>
                  setSelection({ season: season.number, episode: value.number })
                }
              >
                <span>
                  <strong>
                    E{String(value.number).padStart(2, '0')} · {value.name}
                  </strong>
                  <small>
                    {value.watched || value.watchedAt
                      ? t('Assistido ✓')
                      : t('Pendente')}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </details>
      )}
      {data?.supported && (
        <div className="episode-refresh">
          <Button
            type="button"
            variant="link"
            disabled={busy}
            onClick={() => void run('POST', { refresh: true }, true)}
          >
            {t(' Atualizar temporadas ')}
          </Button>
          {season && (
            <IconAction
              type="button"
              variant="link"
              disabled={busy}
              onClick={() =>
                void run('POST', { season: season.number, refresh: true }, true)
              }
              label={t('Atualizar dados dos episódios')}
              icon={RefreshCw}
            />
          )}
        </div>
      )}
      {data?.supported && (
        <div className="episode-bulk-actions">
          {season && (
            <Button
              variant="outline"
              disabled={busy || watched === 0}
              onClick={() => {
                setUnwatchError('');
                setNotice('');
                setUnwatch({
                  scope: 'season',
                  season: season.number,
                  name: season.name,
                });
              }}
              title={
                !watched
                  ? t(
                      'Nenhum episódio assistido nesta temporada para desmarcar.',
                    )
                  : undefined
              }
            >
              <Undo2 aria-hidden="true" />
              <span>{t('Desmarcar temporada')}</span>
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setUnwatchError('');
              setNotice('');
              setUnwatch({ scope: 'series' });
            }}
          >
            <RotateCcw aria-hidden="true" />
            <span>{t('Desmarcar série')}</span>
          </Button>
          {season && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || season.episodes.length === 0}
              onClick={() => setConfirmation('season')}
              aria-label={t(' Marcar temporada como assistida ')}
              title={t(' Marcar temporada como assistida ')}
            >
              <ListChecks aria-hidden="true" />
              <span>{t('Concluir temporada')}</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmation('series')}
            aria-label={t(' Marcar série inteira como assistida ')}
            title={t(' Marcar série inteira como assistida ')}
          >
            <CheckCheck aria-hidden="true" />
            <span>{t('Concluir série')}</span>
          </Button>
        </div>
      )}
      {notice && <output>{notice}</output>}
      <Dialog
        open={unwatch !== null}
        onOpenChange={(open) => {
          if (!open && !pending.current) setUnwatch(null);
        }}
      >
        <DialogContent
          className="item-dialog episode-confirm-dialog"
          showCloseButton={false}
        >
          <DialogTitle>
            {t(
              unwatch?.scope === 'season'
                ? 'Desmarcar esta temporada?'
                : 'Desmarcar a série inteira?',
            )}
          </DialogTitle>
          {unwatch?.scope === 'season' && <strong>{unwatch.name}</strong>}
          <DialogDescription>
            {t(
              'Os episódios desta seleção voltarão a não assistidos. Suas datas, notas, sentimentos e votos desses episódios serão apagados, e a conclusão da série será desfeita. Anotações e comentários serão mantidos.',
            )}
          </DialogDescription>
          {unwatchError && (
            <p role="alert" className="form-error">
              {unwatchError}
            </p>
          )}
          <div className="episode-confirm-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setUnwatch(null)}
            >
              {t('Cancelar')}
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void confirmUnwatch()}
            >
              {t(busy ? 'Desmarcando…' : 'Confirmar desmarcação')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent
          className={`item-dialog episode-confirm-dialog${confirmation === 'season' ? ' season-complete-dialog' : ''}`}
          showCloseButton={false}
        >
          <DialogTitle>
            {confirmation === 'through'
              ? t('Também marcar os episódios anteriores?')
              : confirmation === 'season'
                ? t('Concluir esta temporada?')
                : t('Concluir a série inteira?')}
          </DialogTitle>
          <DialogDescription>
            {confirmation === 'through'
              ? t(
                  'Há episódios anteriores ainda não assistidos. Você pode marcar só este ou incluir todos os anteriores, também de outras temporadas regulares.',
                )
              : t(
                  'Todos os episódios já lançados desta seleção serão marcados como assistidos e somados às estatísticas. Marcações existentes serão preservadas.',
                )}
          </DialogDescription>
          <form
            ref={batchDateForm}
            onSubmit={(event) => event.preventDefault()}
          >
            <WatchDateField key={String(confirmation)} />
          </form>
          {confirmation === 'season' && (
            <form
              ref={seasonVoteForm}
              className="season-character-vote"
              onSubmit={(event) => event.preventDefault()}
            >
              <p>
                {t(
                  'Opcional: escolha um personagem para receber um voto por episódio já lançado desta temporada. Isso substitui os votos anteriores desses episódios; notas, sentimentos e datas serão mantidos.',
                )}
              </p>
              <CastPicker
                key={`${itemId}:${season?.number}`}
                target={{ itemId }}
              />
            </form>
          )}
          <div className="episode-confirm-actions">
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              {t(' Cancelar ')}
            </Button>
            {confirmation === 'through' && (
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmation(null);
                  if (season && episode)
                    void run('PATCH', {
                      season: season.number,
                      episode: episode.number,
                      watched: true,
                    });
                }}
              >
                {t(' Só este episódio ')}
              </Button>
            )}
            <Button
              className="home-primary"
              onClick={() => {
                const scope = confirmation;
                const character =
                  scope === 'season' && seasonVoteForm.current
                    ? new FormData(seasonVoteForm.current).get(
                        'favoriteCharacter',
                      )
                    : '';
                const castId =
                  scope === 'season' && seasonVoteForm.current
                    ? new FormData(seasonVoteForm.current).get('favoriteCastId')
                    : '';
                const favoriteCharacter =
                  typeof character === 'string' ? character.trim() : '';
                setConfirmation(null);
                if (scope)
                  void run(
                    'POST',
                    {
                      scope,
                      watchedDateUnknown: batchDateForm.current
                        ? new FormData(batchDateForm.current).get(
                            'watchedDateUnknown',
                          ) === 'true'
                        : false,
                      ...(favoriteCharacter
                        ? {
                            favoriteCharacter,
                            favoriteCastId:
                              typeof castId === 'string' ? castId : '',
                          }
                        : {}),
                      ...(scope !== 'series' && season
                        ? { season: season.number }
                        : {}),
                      ...(scope === 'through' && episode
                        ? { episode: episode.number }
                        : {}),
                    },
                    'watch-many',
                  );
              }}
            >
              {confirmation === 'through'
                ? t('Este e todos os anteriores')
                : t('Marcar todos')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
