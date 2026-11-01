import { useEffect, useEffectEvent, useState } from 'react';
import { Play, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { libraryRequest } from './library';
import { ApiError } from './auth';
import { t } from './i18n';

type Video = { key: string; name: string; language: string };
export default function Trailer({
  itemId,
  title,
  onExpired,
}: {
  itemId: string;
  title: string;
  onExpired: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [video, setVideo] = useState<Video | null>(null);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    let active = true;
    void libraryRequest<{ trailer: Video | null }>(
      'GET',
      itemId,
      undefined,
      'trailer',
    )
      .then((result) => {
        if (!active) return;
        if (result.trailer && /^[A-Za-z0-9_-]{11}$/.test(result.trailer.key))
          setVideo(result.trailer);
        else setMessage(t('Trailer indisponível para este título.'));
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) expired();
        else {
          setFailed(true);
          setMessage(
            t('Não foi possível carregar o trailer. Tente novamente.'),
          );
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [itemId, retry]);
  return (
    <div className="title-trailer">
      <h2 className="trailer-heading">{t('Trailer')}</h2>
      {busy && (
        <output className="trailer-preview-loading">
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          {t('Carregando trailer…')}
        </output>
      )}
      {video && (
        <button
          type="button"
          className="trailer-preview"
          aria-label={t('Trailer · {0}', title)}
          onClick={() => setOpen(true)}
        >
          {!imageFailed && (
            <img
              src={`https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`}
              alt=""
              onError={() => setImageFailed(true)}
            />
          )}
          <span className="trailer-preview-play">
            <Play aria-hidden="true" />
          </span>
          <span className="trailer-preview-caption">
            <strong>{t('Assistir trailer')}</strong>
            <small>{video.name}</small>
          </span>
        </button>
      )}
      {message && <output>{message}</output>}
      {failed && (
        <Button
          variant="outline"
          onClick={() => {
            setBusy(true);
            setFailed(false);
            setMessage('');
            setRetry((value) => value + 1);
          }}
        >
          {t('Tente novamente.')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="item-dialog trailer-dialog">
          <DialogTitle>{t('Trailer · {0}', title)}</DialogTitle>
          <DialogDescription>{video?.name}</DialogDescription>
          {open && video && (
            <>
              <iframe
                className="trailer-player"
                src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&playsinline=1`}
                title={t('Trailer · {0}', title)}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <a
                href={`https://www.youtube.com/watch?v=${video.key}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('Não reproduziu? Abrir no YouTube')}
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
