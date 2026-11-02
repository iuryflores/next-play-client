import PageLoading from './PageLoading';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { t } from './i18n';
export type CastTarget =
  | { itemId: string; catalogId?: never; season?: number; episode?: number }
  | { catalogId: string; itemId?: never; season?: never; episode?: never };
type Character = {
  id: string;
  actor: string;
  character: string;
  photo: string;
};
export default function CastPicker({
  target,
  initial = '',
  initialCastId = '',
  readOnly = false,
}: {
  target?: CastTarget;
  initial?: string;
  initialCastId?: string;
  readOnly?: boolean;
}) {
  const [selected, setSelected] = useState(initial);
  const [selectedId, setSelectedId] = useState(initialCastId);
  function choose(character: string, id = '') {
    setSelected(character);
    setSelectedId(id);
  }
  const [cast, setCast] = useState<Character[]>([]);
  const [busy, setBusy] = useState(Boolean(target));
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const itemId = target?.itemId,
    catalogId = target?.catalogId,
    season = target?.season,
    episode = target?.episode;
  useEffect(() => {
    if (!itemId && !catalogId) return;
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (season !== undefined && episode !== undefined) {
      query.set('season', String(season));
      query.set('episode', String(episode));
    }
    // Na prévia, o elenco vem da referência pública, sem criar um acompanhamento provisório.
    if (!itemId && catalogId) query.set('catalogId', catalogId);
    const path = itemId
      ? `/api/library/${encodeURIComponent(itemId)}/cast`
      : '/api/catalog/cast';
    void fetch(`${path}?${query}`, {
      credentials: 'same-origin',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const result = (await response.json()) as { cast: Character[] };
        if (!Array.isArray(result.cast)) throw Error();
        if (!controller.signal.aborted) setCast(result.cast);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [itemId, catalogId, season, episode, retry]);
  return (
    <fieldset className="cast-picker">
      <legend>
        {t(readOnly ? 'Elenco' : 'Seu voto de personagem favorito')}
      </legend>
      {!readOnly && (
        <>
          <input type="hidden" name="favoriteCharacter" value={selected} />
          <input type="hidden" name="favoriteCastId" value={selectedId} />
        </>
      )}
      {busy && <PageLoading compact label={t('Carregando elenco…')} />}
      {error && (
        <p role="alert">
          {t('Não foi possível carregar o elenco.')}{' '}
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setBusy(true);
              setError(false);
              setRetry((value) => value + 1);
            }}
          >
            {t('Tentar novamente')}
          </Button>
        </p>
      )}
      {!busy && !error && !cast.length && (
        <p>
          {t(
            'O catálogo ainda não disponibiliza personagens para este título.',
          )}
        </p>
      )}
      {!!cast.length && (
        <Carousel
          className="cast-carousel"
          opts={{ align: 'start', slidesToScroll: 'auto', loop: false }}
          aria-label={t('Elenco')}
          aria-roledescription={t('Carrossel')}
        >
          <CarouselContent>
            {cast.map((person) => {
              const favoriteId = readOnly ? initialCastId : selectedId;
              const favoriteName = readOnly ? initial : selected;
              const isFavorite = favoriteId
                ? favoriteId === person.id
                : favoriteName === person.character &&
                  cast.filter((member) => member.character === favoriteName)
                    .length === 1;
              const content = (
                <>
                  {person.photo ? (
                    <img
                      src={person.photo}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="cast-photo-placeholder" aria-hidden="true">
                      {person.actor.charAt(0)}
                    </span>
                  )}
                  <strong>{person.character}</strong>
                  <small>{person.actor}</small>
                  {readOnly && isFavorite && (
                    <span className="cast-favorite-label">
                      ★ {t('Personagem favorito:')}
                    </span>
                  )}
                </>
              );
              return (
                <CarouselItem
                  key={person.id}
                  className="cast-carousel-slide"
                  aria-roledescription={t('Personagem')}
                  aria-label={`${person.character} · ${person.actor}`}
                >
                  {readOnly ? (
                    <div
                      className={`cast-card${isFavorite ? ' cast-card-favorite' : ''}`}
                    >
                      {content}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="cast-card"
                      aria-pressed={isFavorite}
                      onClick={() =>
                        choose(
                          selectedId === person.id ? '' : person.character,
                          selectedId === person.id ? '' : person.id,
                        )
                      }
                    >
                      {content}
                    </button>
                  )}
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <div className="cast-carousel-controls">
            <CarouselPrevious
              type="button"
              className="cast-carousel-arrow"
              aria-label={t('Elenco anterior')}
            />
            <CarouselNext
              type="button"
              className="cast-carousel-arrow"
              aria-label={t('Próximo elenco')}
            />
          </div>
        </Carousel>
      )}
      {!readOnly && selected && (
        <p>
          {t('Personagem favorito:')} {selected}{' '}
          <Button type="button" variant="link" onClick={() => choose('')}>
            {t('Limpar voto')}
          </Button>
        </p>
      )}
    </fieldset>
  );
}
