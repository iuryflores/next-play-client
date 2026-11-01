import { t, genreLabel, dateLabel } from './i18n';
import type { Episode } from './episode-navigation';
import type { LibraryItem } from './library';
import OriginalTitle from './OriginalTitle';
import { Film } from 'lucide-react';
import {
  createContext,
  useContext,
  useRef,
  useState,
  useId,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import CastPicker, { type CastTarget } from './CastPicker';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export const feelings: Record<string, string> = {
  scared: t('😱 Assustado'),
  happy: t('😊 Feliz'),
  amused: t('😂 Divertido'),
  sad: t('😢 Triste'),
  surprised: t('😮 Surpreso'),
  excited: t('🤩 Empolgado'),
  moved: t('🥹 Emocionado'),
  bored: t('🥱 Entediado'),
  loved: t('😍 Amei'),
  liked: t('🙂 Gostei'),
  neutral: t('😐 Indiferente'),
  disliked: t('🙁 Não gostei'),
};
export type ReviewValue = {
  stars: number;
  feeling: string;
  favoriteCharacter: string;
  favoriteCastId?: string;
};
export function ReviewFields({
  initial,
  target,
  showCharacter = true,
}: {
  initial?: Partial<ReviewValue>;
  target?: CastTarget;
  showCharacter?: boolean;
}) {
  const id = useId();
  const [stars, setStars] = useState(initial?.stars || 0);
  const [feeling, setFeeling] = useState(initial?.feeling || '');
  const labels = [
    t('Ruim'),
    t('Regular'),
    t('Bom'),
    t('Muito bom'),
    t('Excelente'),
  ];
  return (
    <fieldset className="completion-review">
      <legend>{t(' Sua experiência ')}</legend>
      <fieldset className="star-rating">
        <legend>{t(' De ruim a excelente ')}</legend>
        {[1, 2, 3, 4, 5].map((value) => (
          <label key={value} title={labels[value - 1]}>
            <input
              type="radio"
              name="stars"
              value={value}
              checked={stars === value}
              onChange={() => setStars(value)}
              aria-label={t('{0} estrelas: {1}', value, labels[value - 1])}
            />
            <span className={stars >= value ? 'filled' : ''} aria-hidden="true">
              ★
            </span>
          </label>
        ))}
        <Button type="button" variant="ghost" onClick={() => setStars(0)}>
          {t(' Sem nota ')}
        </Button>
        <p aria-live="polite">
          {stars ? labels[stars - 1] : t('Avaliação opcional')}
        </p>
      </fieldset>
      <fieldset className="feeling-picker" aria-labelledby={`${id}-feeling`}>
        <legend id={`${id}-feeling`}>{t('Como você se sentiu?')}</legend>
        <input type="hidden" name="feeling" value={feeling} />
        <div className="feeling-grid">
          {Object.entries(feelings).map(([value, label]) => {
            const space = label.indexOf(' ');
            return (
              <button
                type="button"
                key={value}
                aria-pressed={feeling === value}
                aria-label={label}
                onClick={() => setFeeling(feeling === value ? '' : value)}
              >
                <span aria-hidden="true">{label.slice(0, space)}</span>
                <small>{label.slice(space + 1)}</small>
              </button>
            );
          })}
        </div>
      </fieldset>
      {showCharacter && (
        <CastPicker
          target={target}
          initial={initial?.favoriteCharacter}
          initialCastId={initial?.favoriteCastId}
        />
      )}
    </fieldset>
  );
}
type AskReview = (
  title: string,
  initial?: Partial<ReviewValue>,
  castTarget?: CastTarget,
  item?: LibraryItem,
  editing?: boolean,
  episode?: Episode,
) => Promise<ReviewValue | null>;
const ReviewContext = createContext<AskReview | null>(null);
export function useReview() {
  const ask = useContext(ReviewContext);
  if (!ask) throw new Error('ReviewProvider ausente');
  return ask;
}
export function ReviewProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{
    title: string;
    initial?: Partial<ReviewValue>;
    castTarget?: CastTarget;
    item?: LibraryItem;
    editing?: boolean;
    episode?: Episode;
  } | null>(null);
  const resolve = useRef<((value: ReviewValue | null) => void) | null>(null);
  function finish(value: ReviewValue | null) {
    resolve.current?.(value);
    resolve.current = null;
    setTarget(null);
  }
  const ask: AskReview = (title, initial, castTarget, item, editing, episode) =>
    new Promise((done) => {
      resolve.current?.(null);
      resolve.current = done;
      setTarget({ title, initial, castTarget, item, editing, episode });
    });
  return (
    <ReviewContext value={ask}>
      {children}
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) finish(null);
        }}
      >
        <DialogContent
          className="item-dialog review-dialog"
          showCloseButton={false}
        >
          <DialogTitle>{t(' O que você achou? ')}</DialogTitle>
          <DialogDescription>
            {!target?.item && !target?.episode && target?.title}
            {target?.editing
              ? t(
                  'Atualize sua avaliação. A data em que você assistiu será mantida.',
                )
              : target?.item || target?.episode
                ? t('Avalie antes de confirmar como assistido.')
                : t(' · Avalie antes de confirmar como assistido. ')}
          </DialogDescription>
          {target?.episode ? (
            <ReviewEpisodeSummary
              key={`${target.castTarget?.itemId}:${target.castTarget?.season}:${target.episode.number}`}
              episode={target.episode}
              season={target.castTarget?.season}
              seriesTitle={target.item?.title}
            />
          ) : (
            target?.item && (
              <ReviewMovieSummary key={target.item.id} item={target.item} />
            )
          )}
          {target && (
            <form
              className="item-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const feeling = data.get('feeling');
                const character = data.get('favoriteCharacter');
                const castId = data.get('favoriteCastId');
                finish({
                  stars: Number(data.get('stars') || 0),
                  feeling: typeof feeling === 'string' ? feeling : '',
                  favoriteCastId: typeof castId === 'string' ? castId : '',
                  favoriteCharacter:
                    typeof character === 'string' ? character.trim() : '',
                });
              }}
            >
              <ReviewFields
                initial={target.initial}
                target={target.castTarget}
              />
              <div className="item-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => finish(null)}
                >
                  {t(' Cancelar ')}
                </Button>
                <Button type="submit" className="home-primary">
                  {t(
                    target.editing
                      ? 'Salvar avaliação'
                      : 'Salvar como assistido',
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </ReviewContext>
  );
}

function ReviewEpisodeSummary({
  episode,
  season,
  seriesTitle,
}: {
  episode: Episode;
  season?: number;
  seriesTitle?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <section
      className="review-movie-summary review-episode-summary"
      aria-label={episode.name}
    >
      <div className="review-movie-poster review-episode-still">
        {episode.stillUrl && !imageFailed ? (
          <img
            src={episode.stillUrl}
            alt={episode.name}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Film aria-hidden="true" />
        )}
      </div>
      <div className="review-movie-info">
        {seriesTitle && <p className="review-movie-genres">{seriesTitle}</p>}
        <h3>
          {t('T{0} E{1} · {2}', season ?? '—', episode.number, episode.name)}
        </h3>
        <p className="review-movie-meta">
          {episode.airDate && (
            <time dateTime={episode.airDate}>{dateLabel(episode.airDate)}</time>
          )}
          {episode.airDate && episode.runtime && episode.runtime > 0
            ? ' · '
            : null}
          {episode.runtime && episode.runtime > 0
            ? `${episode.runtime} min`
            : null}
        </p>
        {episode.overview && (
          <details className="review-movie-synopsis">
            <summary>{t('Sinopse')}</summary>
            <p>{episode.overview}</p>
          </details>
        )}
      </div>
    </section>
  );
}

function ReviewMovieSummary({ item }: { item: LibraryItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <section className="review-movie-summary" aria-label={item.title}>
      <div className="review-movie-poster">
        {item.coverUrl && !imageFailed ? (
          <img
            src={item.coverUrl}
            alt={t('Capa de {0}', item.title)}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Film aria-hidden="true" />
        )}
      </div>
      <div className="review-movie-info">
        <h3>{item.title}</h3>
        <OriginalTitle title={item.title} originalTitle={item.originalTitle} />
        <p className="review-movie-meta">
          {[
            item.year,
            item.runtime && item.runtime > 0 ? `${item.runtime} min` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {!!item.genres?.length && (
          <p className="review-movie-genres">
            {item.genres.map(genreLabel).join(' · ')}
          </p>
        )}
        {item.overview && (
          <details className="review-movie-synopsis">
            <summary>{t('Sinopse')}</summary>
            <p>{item.overview}</p>
          </details>
        )}
      </div>
    </section>
  );
}
