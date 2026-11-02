import { genreLabel } from './i18n';
import { dateLabel } from './i18n';
import ReleaseBadge from './ReleaseBadge';
import Trailer from './Trailer';
import RottenTomatoes from './RottenTomatoes';
import MovieDirectors from './MovieDirectors';
import IconAction from './IconAction';
import { t } from './i18n';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { categories, statusNames, type LibraryItem } from './library';
import OriginalTitle from './OriginalTitle';
import Episodes from './Episodes';
import Community from './Community';
import QuickActions from './QuickActions';

import { feelings } from './Review';
import CollectionActions from './CollectionActions';
import BackButton from './BackButton';
import CastPicker from './CastPicker';
import { Clock3, Pencil, Film, BookOpen, CircleCheck } from 'lucide-react';
import './title-details.css';

export default function TitleDetails({
  item,
  back,
  edit,
  changed,
  onProgress,
  onWatched,
  onExpired,
  removed,
}: {
  item: LibraryItem;
  back: () => void;
  edit: (item: LibraryItem) => void;
  changed: (item: LibraryItem) => void;
  onProgress: () => void;
  onWatched: () => void;
  onExpired: () => void;
  removed: (id: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [item.id]);
  return (
    <section className="title-details" aria-labelledby="title-details-heading">
      <div className="details-topbar">
        <BackButton onClick={back} />
      </div>
      {(item.kind === 'movie' || item.kind === 'series') && (
        <RottenTomatoes
          kind={item.kind}
          key={`rotten-tomatoes-${item.id}`}
          title={item.originalTitle || item.title}
          year={item.year}
          catalogId={item.catalogId}
          onExpired={onExpired}
        />
      )}
      <div className="title-details-hero">
        <div className="details-artwork">
          {item.coverUrl ? (
            <img
              className="title-details-poster"
              src={item.coverUrl}
              alt={t('Capa de {0}', item.title)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="details-poster-placeholder">
              {item.kind === 'book' ? (
                <BookOpen aria-hidden="true" />
              ) : (
                <Film aria-hidden="true" />
              )}
            </div>
          )}
          {item.status === 'completed' && (
            <section
              className="title-details-experience"
              aria-label={t('Sua experiência')}
            >
              <h2>{t(' Sua experiência ')}</h2>
              <p
                className={
                  item.stars ? 'details-personal-rating' : 'details-no-rating'
                }
              >
                {item.stars
                  ? `${'★'.repeat(item.stars)} · ${item.stars}/5`
                  : t('Ainda sem nota')}
              </p>
              <p className="details-watched-date">
                {item.kind === 'movie' || item.kind === 'series'
                  ? t(
                      item.completedOn || item.completedAt
                        ? 'Assistido em'
                        : 'Assistido',
                    )
                  : item.completedOn || item.completedAt
                    ? item.kind === 'book'
                      ? t('Lido em')
                      : t(' Concluído em ')
                    : statusNames[item.kind][item.status]}
                {(item.completedOn || item.completedAt) && (
                  <>
                    {' '}
                    {dateLabel(
                      item.completedOn || item.completedAt!.slice(0, 10),
                    )}
                  </>
                )}
              </p>
              {item.feeling && feelings[item.feeling] && (
                <p>{feelings[item.feeling]}</p>
              )}
              {item.notes && (
                <>
                  <h3>{t(' Anotações privadas ')}</h3>
                  <p className="title-details-notes">{item.notes}</p>
                </>
              )}
            </section>
          )}
        </div>
        <div className="details-intro">
          <div className="details-status-actions">
            {item.kind === 'movie' && item.status === 'completed' && (
              <div className="details-watched-banner">
                <CircleCheck aria-hidden="true" />
                <strong>{t('Assistido')}</strong>
              </div>
            )}
            <div className="details-top-actions">
              <div className="details-title-icons">
                {item.kind !== 'series' && (
                  <QuickActions
                    iconOnly
                    disableCompleted
                    owned={item}
                    changed={changed}
                    edit={edit}
                    onExpired={onExpired}
                  />
                )}
                <IconAction
                  variant="ghost"
                  label={t(' Editar ')}
                  icon={Pencil}
                  onClick={() => edit(item)}
                />
              </div>
              <CollectionActions
                item={item}
                changed={changed}
                removed={removed}
                back={back}
                onExpired={onExpired}
              />
            </div>
          </div>
          <div className="details-meta">
            <small>
              {categories[item.kind]}
              {item.year ? ` · ${item.year}` : ''}
            </small>
            {item.runtime && item.runtime > 0 ? (
              <span>
                <Clock3 aria-hidden="true" />
                {item.runtime} min
              </span>
            ) : null}
          </div>
          <div className="details-title-row">
            <h1 id="title-details-heading" ref={heading} tabIndex={-1}>
              {item.title}
            </h1>
          </div>
          <ReleaseBadge item={item} />
          <OriginalTitle
            title={item.title}
            originalTitle={item.originalTitle}
          />
          {item.kind === 'book' && (
            <div className="details-book-metadata">
              {item.authors?.length ? <p>{item.authors.join(' · ')}</p> : null}
              {item.publisher && <p>{item.publisher}</p>}
            </div>
          )}
          <div className="details-genre-tags">
            {item.kind === 'game' && (
              <span>
                {t('Plataforma')}: {item.platform || t('Não informada')}
              </span>
            )}
            {item.kind === 'game' && (
              <span>
                {t('Tempo jogado')}:{' '}
                {Math.floor((item.playtimeMinutes || 0) / 60)}h{' '}
                {(item.playtimeMinutes || 0) % 60}min
              </span>
            )}
            {item.genres?.map((genre) => (
              <span key={genre}>{genreLabel(genre)}</span>
            ))}
          </div>
          {item.kind === 'movie' && (
            <MovieDirectors
              key={`directors-${item.id}`}
              itemId={item.id}
              onExpired={onExpired}
            />
          )}
          {!!item.productionCompanies?.length && (
            <section className="details-synopsis-companies">
              <h2>{t('Produtoras')}</h2>
              <p>
                {item.productionCompanies
                  .map((company) => company.name)
                  .join(' · ')}
              </p>
            </section>
          )}
          <div className="details-synopsis">
            <h2>{t('Sinopse')}</h2>
            <p>
              {item.overview ||
                t('Sinopse ainda não disponível para este título.')}
            </p>
          </div>

          {item.sourceUrl && (
            <a
              className="catalog-source"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t(' Ver no ')}
              {item.kind === 'book'
                ? 'Google Books'
                : item.catalogId?.startsWith('tmdb:')
                  ? 'TMDB'
                  : 'IGDB'}{' '}
              ↗
            </a>
          )}
        </div>
      </div>
      <div className="details-content-grid">
        <div className="details-main">
          {(item.kind === 'movie' || item.kind === 'series') && (
            <div className="details-trailer-cast">
              {item.catalogId?.startsWith('tmdb:') && (
                <Trailer
                  key={`trailer-${item.id}`}
                  itemId={item.id}
                  title={item.title}
                  onExpired={onExpired}
                />
              )}
              <CastPicker
                key={`cast-${item.id}`}
                target={{ itemId: item.id }}
                initial={item.favoriteCharacter}
                initialCastId={item.favoriteCastId}
                readOnly
              />
            </div>
          )}
          {item.kind === 'series' && (
            <Episodes
              item={item}
              key={`episodes-${item.id}`}
              itemId={item.id}
              onExpired={onExpired}
              onProgress={onProgress}
              onWatched={onWatched}
            />
          )}
          <Community
            key={`community-${item.id}`}
            itemId={item.id}
            onExpired={onExpired}
          />
        </div>
      </div>
    </section>
  );
}
