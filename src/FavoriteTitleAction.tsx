import { useEffect, useEffectEvent, useState } from 'react';
import { Heart } from 'lucide-react';
import IconAction from './IconAction';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { t } from './i18n';
import { notifySaved } from './notifications';
import type { LibraryItem } from './library';
export default function FavoriteTitleAction({
  item,
  onExpired,
}: {
  item: LibraryItem;
  onExpired: () => void;
}) {
  const [favorite, setFavorite] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/social/settings', {
      credentials: 'same-origin',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        if (response.status === 401) {
          if (!controller.signal.aborted) expired();
          return;
        }
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!controller.signal.aborted)
          setFavorite(data.favoriteIds.includes(item.id));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            t(
              'Não foi possível carregar seus favoritos. Reabra os detalhes para tentar novamente.',
            ),
          );
      });
    return () => controller.abort();
  }, [item.id]);
  const eligible = !item.archived;
  const label = t(
    favorite
      ? 'Remover dos favoritos do perfil'
      : eligible
        ? 'Adicionar aos favoritos do perfil'
        : 'Restaure o título para favoritar',
  );
  return (
    <>
      <IconAction
        icon={Heart}
        label={label}
        variant={favorite ? 'secondary' : 'ghost'}
        aria-pressed={favorite === true}
        disabled={favorite === null || busy || (!favorite && !eligible)}
        className="details-favorite-toggle"
        onClick={() => {
          if (favorite === null || busy) return;
          setBusy(true);
          void fetch('/api/social/favorites/' + item.id, {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorite: !favorite }),
            signal: AbortSignal.timeout(15000),
          })
            .then(async (response) => {
              if (response.status === 401) {
                onExpired();
                return;
              }
              const data = await response.json();
              if (!response.ok)
                throw Error(
                  typeof data.message === 'string'
                    ? data.message
                    : t('Não foi possível salvar.'),
                );
              setFavorite(data.favorite);
              notifySaved(
                t(
                  data.favorite
                    ? 'Adicionado aos favoritos do perfil.'
                    : 'Removido dos favoritos do perfil.',
                ),
              );
            })
            .catch((reason) =>
              setError(
                reason instanceof Error
                  ? reason.message
                  : t('Não foi possível salvar.'),
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
      <Dialog
        open={!!error}
        onOpenChange={(open) => {
          if (!open) setError('');
        }}
      >
        <DialogContent>
          <DialogTitle>{t('Favoritos do perfil')}</DialogTitle>
          <DialogDescription>{error}</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
