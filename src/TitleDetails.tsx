import Rewatch from './Rewatch';
import GameStatusHistory from './GameStatusHistory';
import { Button } from '@/components/ui/button';
import { groupGames } from './game-groups';
import { gameDuration } from './game-session-client';
import GameAddons from './GameAddons';
import GameEstimate from './GameEstimate';
import { genreLabel } from './i18n';
import { dateLabel } from './i18n';
import ReleaseBadge from './ReleaseBadge';
import Trailer from './Trailer';
import RottenTomatoes from './RottenTomatoes';
import MovieDirectors from './MovieDirectors';
import IconAction from './IconAction';
import { t } from './i18n';
import { useEffect, useRef } from 'react';
import { categories, statusNames, type LibraryItem } from './library';
import OriginalTitle from './OriginalTitle';
import Episodes from './Episodes';
import Community from './Community';
import QuickActions from './QuickActions';
import GameTimeAction from './GameTimeAction';

import { feelings } from './Review';
import CollectionActions from './CollectionActions';
import BackButton from './BackButton';
import CastPicker from './CastPicker';
import { Clock3, Pencil, Film, BookOpen, CircleCheck } from 'lucide-react';
import './title-details.css';

export default function TitleDetails({
  item,
  focusCommentId,
  items,
  openTitle,
  back,
  edit,
  changed,
  onProgress,
  onWatched,
  onExpired,
  removed,
}: {
  item: LibraryItem;
  focusCommentId?: string;
  items: LibraryItem[];
  openTitle: (id: string) => void;
  back: () => void;
  edit: (item: LibraryItem) => void;
  changed: (item: LibraryItem) => void;
  onProgress: () => void;
  onWatched: () => void;
  onExpired: () => void;
  removed: (id: string) => void;
}) {
  const parentGame = item.parentGameCatalogId
    ? items.find((part) => part.catalogId === item.parentGameCatalogId)
    : undefined;
  const family = groupGames(items).find((group) => group.id === item.id);
  const gameParts = family?.gameParts;
  const followingSeries =
    item.kind === 'series' &&
    !item.archived &&
    item.status !== 'completed' &&
    !item.caughtUp &&
    (item.status === 'active' ||
      item.inProgress ||
      (item.episodeProgress?.watched || 0) > 0);
  const episodeFocus = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Em andamento, o episódio é o ponto de entrada; não rola o celular até os metadados.
    if (followingSeries) episodeFocus.current?.focus({ preventScroll: true });
    else heading.current?.focus();
  }, [item.id, followingSeries]);
  const scores = (item.kind === 'movie' || item.kind === 'series') && (
    <RottenTomatoes
      kind={item.kind}
      key={`rotten-tomatoes-${item.id}`}
      title={item.originalTitle || item.title}
      year={item.year}
      catalogId={item.catalogId}
      onExpired={onExpired}
    />
  );
  const episodePanel = item.kind === 'series' && (
    <Episodes
      item={item}
      key={`episodes-${item.id}-${item.rewatchActiveId || 'original'}`}
      itemId={item.id}
      onExpired={onExpired}
      onProgress={onProgress}
      onWatched={onWatched}
    />
  );
  const information = (
    <>
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
          {item.overview || t('Sinopse ainda não disponível para este título.')}
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
    </>
  );
  const trailerCast = (item.kind === 'movie' || item.kind === 'series') && (
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
  );
  return (
    <section className="title-details" aria-labelledby="title-details-heading">
      <div className="details-topbar">
        <BackButton onClick={back} />
        {parentGame && (
          <Button variant="link" onClick={() => openTitle(parentGame.id)}>
            {t('Ver jogo principal')}: {parentGame.title}
          </Button>
        )}
      </div>
      {!followingSeries && scores}
      <div
        className={
          followingSeries
            ? 'details-layout series-follow-layout'
            : 'details-layout'
        }
      >
        {followingSeries && (
          <div
            className="series-episode-focus"
            ref={episodeFocus}
            tabIndex={-1}
          >
            {episodePanel}
          </div>
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
                  {item.watchedDateUnknown && <>{t('Data desconhecida')} · </>}
                  {item.kind === 'movie' || item.kind === 'series'
                    ? t(
                        item.completedOn ||
                          (item.watchedDateUnknown
                            ? undefined
                            : item.completedAt)
                          ? 'Assistido em'
                          : 'Assistido',
                      )
                    : item.completedOn ||
                        (item.watchedDateUnknown ? undefined : item.completedAt)
                      ? item.kind === 'book'
                        ? t('Lido em')
                        : t(' Concluído em ')
                      : item.rewatching
                        ? t('Reassistindo')
                        : statusNames[item.kind][item.status]}
                  {(item.completedOn ||
                    (item.watchedDateUnknown
                      ? undefined
                      : item.completedAt)) && (
                    <>
                      {' '}
                      {dateLabel(
                        item.completedOn ||
                          (item.watchedDateUnknown
                            ? undefined
                            : item.completedAt)!.slice(0, 10),
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
            {(item.kind === 'movie' || item.kind === 'series') && (
              <Rewatch item={item} changed={changed} onExpired={onExpired} />
            )}
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
                {item.authors?.length ? (
                  <p>{item.authors.join(' · ')}</p>
                ) : null}
                {item.publisher && <p>{item.publisher}</p>}
              </div>
            )}
            <div className="details-genre-tags">
              {item.kind === 'game' && item.lastPlayedOn && (
                <span>
                  {t('Última vez jogado')}: {dateLabel(item.lastPlayedOn)}
                </span>
              )}
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
            {item.kind === 'game' && (
              <GameTimeAction
                item={item}
                parts={gameParts}
                changed={changed}
                onExpired={onExpired}
              />
            )}
            {item.kind === 'movie' && (
              <MovieDirectors
                key={`directors-${item.id}`}
                itemId={item.id}
                onExpired={onExpired}
              />
            )}
            {followingSeries ? (
              <details className="series-information">
                <summary>{t('Sobre a série')}</summary>
                {information}
                {scores}
              </details>
            ) : (
              information
            )}
          </div>
          {followingSeries && trailerCast}
        </div>
        <div className="details-content-grid">
          <div className="details-main">
            {item.kind === 'game' && gameParts && (
              <section className="game-family-time">
                <h2>{t('Tempo por conteúdo')}</h2>
                {gameParts.map((part, index) => (
                  <div key={part.id}>
                    <button type="button" onClick={() => openTitle(part.id)}>
                      {part.title}
                      {index === 0 ? ` · ${t('Jogo principal')}` : ''}
                    </button>
                    <strong>{gameDuration(part.playtimeMinutes || 0)}</strong>
                  </div>
                ))}
                <div className="game-family-total">
                  <span>{t('Total com DLCs e expansões')}</span>
                  <strong>{gameDuration(family.playtimeMinutes || 0)}</strong>
                </div>
              </section>
            )}
            {item.kind === 'game' && (
              <GameEstimate key={item.id} item={item} onExpired={onExpired} />
            )}
            {item.kind === 'game' && (
              <GameAddons
                key={`addons-${item.id}`}
                item={item}
                items={items}
                changed={changed}
                open={openTitle}
                onExpired={onExpired}
              />
            )}
            {item.kind === 'game' && (
              <GameStatusHistory
                key={`status-${item.id}-${item.updatedAt}`}
                itemId={item.id}
                onExpired={onExpired}
              />
            )}
            {!followingSeries && trailerCast}
            {!followingSeries && episodePanel}
            <Community
              key={`community-${item.id}-${focusCommentId || 'list'}`}
              itemId={item.id}
              focusCommentId={focusCommentId}
              onExpired={onExpired}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
