import WatchDateField from './WatchDateField';
import BackButton from './BackButton';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import { BookOpen, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CatalogTitle } from './CatalogSearch';
import { ApiError } from './auth';
import { categories, libraryRequest, type LibraryItem } from './library';
import { dateLabel, genreLabel, t } from './i18n';
import { today } from './CompletionFields';
import { ReviewFields } from './Review';
import OriginalTitle from './OriginalTitle';
import PageLoading from './PageLoading';
import { findOwned } from './QuickActions';
import ExploreActions from './ExploreActions';
import RottenTomatoes from './RottenTomatoes';
import Trailer from './Trailer';
import './title-details.css';
import './explore-details.css';

export default function ExploreTitleDetails({
  title,
  initialComplete = false,
  items,
  changed,
  edit,
  close,
  onExpired,
}: {
  title: CatalogTitle;
  initialComplete?: boolean;
  items: LibraryItem[];
  changed: (item: LibraryItem) => void;
  edit: (item: LibraryItem) => void;
  close: () => void;
  onExpired: () => void;
}) {
  const [details, setDetails] = useState(title);
  const [completing, setCompleting] = useState(
    initialComplete && title.kind === 'movie',
  );
  const [loading, setLoading] = useState(/^(tmdb|igdb):/.test(title.catalogId));
  const [detailsError, setDetailsError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [latestOwned, setLatestOwned] = useState<LibraryItem>();
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const expired = useEffectEvent(onExpired);
  const owned = latestOwned || findOwned(items, title);
  useEffect(() => {
    if (!/^(tmdb|igdb):/.test(title.catalogId)) return;
    const controller = new AbortController();
    void fetch(
      `/api/catalog/details?${new URLSearchParams({ catalogId: title.catalogId })}`,
      {
        credentials: 'same-origin',
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(20000),
        ]),
      },
    )
      .then(async (response) => {
        if (response.status === 401) {
          expired();
          return;
        }
        if (!response.ok) throw Error();
        const data = (await response.json()) as { title: CatalogTitle };
        if (
          data.title?.catalogId !== title.catalogId ||
          data.title.kind !== title.kind
        )
          throw Error();
        if (!controller.signal.aborted) {
          setDetails(data.title);
          setDetailsError('');
        }
      })
      .catch(() => {
        // A prévia mantém os dados conhecidos quando o provedor está indisponível.
        if (!controller.signal.aborted)
          setDetailsError(
            t('Não foi possível carregar os detalhes completos.'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [title.catalogId, title.kind, retry]);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || title.kind !== 'movie') return;
    const form = new FormData(event.currentTarget);
    pending.current = true;
    setSaving(true);
    setSaveError('');
    try {
      // Outra aba pode ter adicionado o filme enquanto a prévia estava aberta.
      // Reutilizamos o registro atual e preservamos anotações e votos existentes.
      const current = findOwned(
        (await libraryRequest<{ items: LibraryItem[] }>()).items,
        title,
      );
      if (current?.status === 'completed') {
        setLatestOwned(current);
        setCompleting(false);
        setSaveError(
          t(
            'Este filme já está marcado como assistido. Abra a avaliação para editar.',
          ),
        );
        return;
      }
      const completedOn = form.get('completedOn'),
        feeling = form.get('feeling'),
        favoriteCharacter = form.get('favoriteCharacter'),
        favoriteCastId = form.get('favoriteCastId');
      const completion = {
        title: current?.title || title.title,
        kind: 'movie',
        status: 'completed',
        watchedDateUnknown: form.get('watchedDateUnknown') === 'true',
        completedOn:
          form.get('watchedDateUnknown') === 'true'
            ? undefined
            : typeof completedOn === 'string'
              ? completedOn
              : today(),
        stars: Number(form.get('stars') || 0),
        feeling: typeof feeling === 'string' ? feeling : '',
        // Nome e referência do elenco permitem validar e preservar também o voto do ator.
        favoriteCharacter:
          typeof favoriteCharacter === 'string' ? favoriteCharacter : '',
        favoriteCastId:
          typeof favoriteCastId === 'string' ? favoriteCastId : '',
      };
      const result = current
        ? await libraryRequest<{ item: LibraryItem }>('PATCH', current.id, {
            ...completion,
            notes: current.notes,
          })
        : await libraryRequest<{ item: LibraryItem }>('POST', '', {
            ...completion,
            catalogId: title.catalogId,
          });
      close();
      changed(result.item);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onExpired();
      else
        setSaveError(
          error instanceof Error
            ? error.message
            : t('Não foi possível salvar. Tente novamente.'),
        );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) close();
      }}
    >
      <DialogContent
        className="item-dialog explore-title-dialog"
        showCloseButton={!saving}
        initialFocus={heading}
      >
        <DialogTitle ref={heading} tabIndex={-1}>
          {details.title}
        </DialogTitle>
        <DialogDescription>
          {t(
            completing
              ? 'Avalie antes de confirmar como assistido.'
              : 'Conheça este título antes de adicionar ao acompanhamento.',
          )}
        </DialogDescription>
        <div className="explore-preview-heading">
          <div className="explore-preview-cover">
            {details.coverUrl ? (
              <img
                src={details.coverUrl}
                alt={t('Capa de {0}', details.title)}
                referrerPolicy="no-referrer"
              />
            ) : details.kind === 'book' ? (
              <BookOpen aria-hidden="true" />
            ) : (
              <Film aria-hidden="true" />
            )}
          </div>
          <div>
            <p>
              {[
                categories[details.kind],
                details.year,
                details.runtime ? `${details.runtime} min` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <OriginalTitle
              title={details.title}
              originalTitle={details.originalTitle}
            />
            {!!details.genres?.length && (
              <p>{details.genres.map(genreLabel).join(' · ')}</p>
            )}
            {!!details.authors?.length && <p>{details.authors.join(' · ')}</p>}
            {details.publisher && <p>{details.publisher}</p>}
            {!!details.platforms?.length && (
              <p>{details.platforms.join(' · ')}</p>
            )}
            {details.releaseDate && (
              <p>
                {t('Lançamento')}: {dateLabel(details.releaseDate)}
              </p>
            )}
          </div>
        </div>
        {loading && <PageLoading compact label={t('Carregando detalhes…')} />}
        {detailsError && (
          <div className="home-error" role="alert">
            {detailsError}
            <Button
              variant="link"
              onClick={() => {
                setLoading(true);
                setDetailsError('');
                setRetry((v) => v + 1);
              }}
            >
              {t('Tentar novamente')}
            </Button>
          </div>
        )}
        {saveError && (
          <p className="home-error" role="alert">
            {saveError}
          </p>
        )}
        {completing ? (
          <form className="item-form" onSubmit={(event) => void save(event)}>
            <WatchDateField
              withDate
              initialUnknown={owned?.watchedDateUnknown}
              initialDate={owned?.completedOn}
              disabled={saving}
            />
            <fieldset disabled={saving}>
              <ReviewFields
                initial={owned}
                target={
                  owned
                    ? { itemId: owned.id }
                    : title.catalogId.startsWith('tmdb:movie:')
                      ? { catalogId: title.catalogId }
                      : undefined
                }
              />
            </fieldset>
            <div className="item-form-actions">
              <BackButton
                disabled={saving}
                onClick={() => {
                  setCompleting(false);
                  setSaveError('');
                }}
              />
              <Button className="home-primary" type="submit" disabled={saving}>
                {t(saving ? 'Salvando…' : 'Salvar como assistido')}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <section>
              <h3>{t('Sinopse')}</h3>
              <p className="explore-preview-synopsis">
                {details.overview ||
                  t('Sinopse ainda não disponível para este título.')}
              </p>
            </section>
            {!!details.productionCompanies?.length && (
              <section>
                <h3>{t('Produtoras')}</h3>
                <p>
                  {details.productionCompanies
                    .map((company) => company.name)
                    .join(' · ')}
                </p>
              </section>
            )}
            {(details.kind === 'movie' || details.kind === 'series') && (
              <>
                {details.catalogId.startsWith('tmdb:') && (
                  <Trailer
                    catalogId={details.catalogId}
                    title={details.title}
                    onExpired={onExpired}
                  />
                )}
                <RottenTomatoes
                  title={details.originalTitle || details.title}
                  kind={details.kind}
                  year={details.year}
                  catalogId={details.catalogId}
                  onExpired={onExpired}
                />
              </>
            )}
            <ExploreActions
              showEdit
              title={details}
              owned={owned}
              changed={(item) => {
                close();
                changed(item);
              }}
              edit={(item) => {
                close();
                edit(item);
              }}
              onExpired={onExpired}
              markWatched={() => setCompleting(true)}
            />
            {details.sourceUrl && (
              <a
                className="catalog-source"
                href={details.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('Ver na fonte')} ↗
              </a>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
