import { useEffect, useEffectEvent, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from './i18n';
import { notifySaved } from './notifications';
import { categories, type Kind } from './library';
import './social.css';
export function ShareTitleAction({
  itemId,
  onExpired,
}: {
  itemId: string;
  onExpired: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError('');
          void fetch('/api/social/share/' + itemId, {
            method: 'POST',
            credentials: 'same-origin',
            signal: AbortSignal.timeout(30000),
          })
            .then(async (response) => {
              if (response.status === 401) {
                onExpired();
                return;
              }
              if (!response.ok) throw Error();
              const data = await response.json();
              await navigator.clipboard.writeText(
                window.location.origin + data.path,
              );
              notifySaved(
                t('Link da obra copiado. Exige login e amizade aceita.'),
              );
            })
            .catch(() => setError(t('Não foi possível compartilhar.')))
            .finally(() => setBusy(false));
        }}
      >
        <Share2 aria-hidden="true" />
        {t('Compartilhar com amigos')}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export default function SharedTitle({
  id,
  onExpired,
  onOpen,
}: {
  id?: string;
  onExpired: () => void;
  onOpen: (id: string) => void;
}) {
  const [data, setData] = useState<{
      ownerName: string;
      title: {
        title: string;
        coverUrl: string;
        year: string;
        kind: Kind;
        viewerItemId: string | null;
      };
    } | null>(null),
    [error, setError] = useState('');
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    let active = true;
    if (!id) return;
    void fetch('/api/social/shared/' + id, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(30000),
    })
      .then(async (response) => {
        if (response.status === 401) {
          expired();
          return;
        }
        if (!response.ok) throw Error();
        const result = await response.json();
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError(t('Compartilhamento privado ou não encontrado.'));
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <section className="social-page">
      <h1>{t('Obra compartilhada')}</h1>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>{t('Compartilhado por {0}', data.ownerName)}</p>
          <h2>{data.title.title}</h2>
          <p>
            {categories[data.title.kind]} · {data.title.year}
          </p>
          {data.title.coverUrl && (
            <img
              style={{ maxWidth: 240, borderRadius: 12 }}
              src={data.title.coverUrl}
              alt=""
            />
          )}
          {data.title.viewerItemId && (
            <Button onClick={() => onOpen(data.title.viewerItemId!)}>
              {t('Abrir na minha biblioteca')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
