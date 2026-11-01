import { t } from './i18n';
import { request as episodeRequest, resume } from './episode-client';
import { nextEpisode } from './episode-navigation';
import { useRef, useState } from 'react';
import { Plus, CheckCheck, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { libraryRequest, statusNames, type LibraryItem } from './library';
import type { CatalogTitle } from './CatalogSearch';
import { ApiError } from './auth';
import { today } from './CompletionFields';
import { useReview } from './Review';
export function findOwned(items: LibraryItem[], title: CatalogTitle) {
  return items.find(
    (item) =>
      item.catalogId === title.catalogId ||
      (!item.catalogId &&
        title.catalogId.startsWith('local:') &&
        item.kind === title.kind &&
        item.title.trim().toLocaleLowerCase('pt-BR') ===
          title.title.trim().toLocaleLowerCase('pt-BR')),
  );
}
export default function QuickActions({
  title,
  compact = false,
  iconOnly = false,
  disableCompleted = false,
  owned,
  changed,
  edit,
  onExpired,
}: {
  title?: CatalogTitle;
  compact?: boolean;
  iconOnly?: boolean;
  disableCompleted?: boolean;
  owned?: LibraryItem;
  changed: (item: LibraryItem) => void;
  edit: (item: LibraryItem) => void;
  onExpired: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const askReview = useReview();
  const pending = useRef(false);
  const [error, setError] = useState('');
  async function run() {
    if (
      pending.current ||
      (disableCompleted && owned?.status === 'completed') ||
      (owned?.status === 'completed' && owned.kind !== 'movie') ||
      (!title && !owned)
    )
      return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (owned?.kind === 'series') {
        const data = await resume(
          owned.id,
          await episodeRequest(owned.id),
          () => true,
        );
        if (!data.supported)
          throw new Error(
            t('Abra os detalhes para vincular esta série ao catálogo.'),
          );
        const next = nextEpisode(data);
        if (!next || next.episode === null)
          throw new Error(t('Não há episódio pendente para marcar.'));
        const episode = data.seasons
          .find((season) => season.number === next.season)
          ?.episodes.find((episode) => episode.number === next.episode);
        const review = await askReview(
          t(
            '{0} · T{1} E{2} · {3}',
            owned.title,
            next.season,
            next.episode,
            episode?.name || '',
          ),
          episode,
          { itemId: owned.id, season: next.season, episode: next.episode },
          owned,
          false,
          episode,
        );
        if (!review) return;
        await episodeRequest(owned.id, 'PATCH', {
          ...review,
          season: next.season,
          episode: next.episode,
          watched: true,
        });
        const refreshed = await libraryRequest<{ items: LibraryItem[] }>();
        const item = refreshed.items.find((item) => item.id === owned.id);
        if (item) changed(item);
        return;
      }
      const review =
        owned?.kind === 'movie'
          ? await askReview(
              owned.title,
              owned,
              { itemId: owned.id },
              owned,
              owned.status === 'completed',
            )
          : undefined;
      if (review === null) return;
      const result = owned
        ? await libraryRequest<{ item: LibraryItem }>('PATCH', owned.id, {
            title: owned.title,
            kind: owned.kind,
            status: 'completed',
            notes: owned.notes,
            completedOn:
              owned.status === 'completed'
                ? owned.completedOn ||
                  owned.completedAt?.slice(0, 10) ||
                  today()
                : today(),
            ...review,
          })
        : await libraryRequest<{ item: LibraryItem }>('POST', '', {
            title: title!.title,
            kind: title!.kind,
            catalogId: title!.catalogId,
            status: 'planned',
          });
      changed(result.item);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else if (reason instanceof ApiError && reason.status === 409 && title) {
        try {
          const data = await libraryRequest<{ items: LibraryItem[] }>();
          const item = findOwned(data.items, title);
          if (item) changed(item);
          else setError(reason.message);
        } catch {
          setError(t('Não foi possível atualizar a coleção. Tente novamente.'));
        }
      } else
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar. Tente novamente.'),
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (iconOnly && owned) {
    const label =
      owned.status === 'completed'
        ? owned.kind === 'movie'
          ? t(disableCompleted ? 'Assistido' : 'Editar avaliação')
          : t(owned.kind === 'book' ? 'Lido' : 'Já concluído')
        : owned.kind === 'series'
          ? t('Marcar o próximo episódio como assistido')
          : owned.kind === 'movie'
            ? t('Marcar como assistido')
            : owned.kind === 'book'
              ? t('Marcar como lido')
              : t('Marcar como concluído');
    return (
      <>
        <Button
          type="button"
          className="complete-cover-action"
          variant="ghost"
          size="icon"
          disabled={
            busy ||
            (owned.status === 'completed' &&
              (disableCompleted || owned.kind !== 'movie'))
          }
          aria-label={`${busy ? t('Salvando') : label}: ${owned.title}`}
          title={busy ? t('Salvando…') : label}
          onClick={() => void run()}
        >
          {busy ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <CheckCheck aria-hidden="true" />
          )}
        </Button>
        {error && (
          <div className="cover-action-error" role="alert">
            {error}
          </div>
        )}
      </>
    );
  }
  return (
    <div className="quick-actions">
      {owned && !compact && (
        <small className="quick-status">
          {t(' Na coleção · ')}
          {statusNames[owned.kind][owned.status]}
        </small>
      )}
      <Button
        className="home-primary"
        disabled={
          busy ||
          (owned?.status === 'completed' &&
            owned.kind !== 'series' &&
            owned.kind !== 'movie')
        }
        onClick={() => (owned?.kind === 'series' ? edit(owned) : void run())}
      >
        {owned ? (
          <CheckCheck aria-hidden="true" />
        ) : (
          <Plus aria-hidden="true" />
        )}
        {busy
          ? t('Salvando…')
          : !owned
            ? t('Adicionar ao acompanhamento')
            : owned.kind === 'series'
              ? t('Ver episódios')
              : owned.status === 'completed'
                ? owned.kind === 'movie'
                  ? t('Editar avaliação')
                  : statusNames[owned.kind].completed
                : owned.kind === 'movie'
                  ? t('Marcar como assistido')
                  : owned.kind === 'book'
                    ? t('Marcar como lido')
                    : t('Marcar como concluído')}
      </Button>
      {owned && (
        <Button variant="link" onClick={() => edit(owned)} disabled={busy}>
          {t(' Avaliar e ver detalhes ')}
        </Button>
      )}
      {error && (
        <p className="home-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
