import { useEffect, useEffectEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from './auth';
import { libraryRequest } from './library';
import { t } from './i18n';

export default function MovieDirectors({
  itemId,
  onExpired,
}: {
  itemId: string;
  onExpired: () => void;
}) {
  const [data, setData] = useState<{
    directors: { id: number; name: string }[];
    supported: boolean;
  } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    let active = true;
    void libraryRequest<{
      directors: { id: number; name: string }[];
      supported: boolean;
    }>('GET', itemId, undefined, 'directors')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(true);
      });
    return () => {
      active = false;
    };
  }, [itemId, retry]);
  return (
    <section className="details-synopsis-companies" aria-label={t('Direção')}>
      <h2>{t('Direção')}</h2>
      <div aria-live="polite">
        {error ? (
          <>
            <p>{t('Não foi possível carregar a direção do filme.')}</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setError(false);
                setData(null);
                setRetry((value) => value + 1);
              }}
            >
              {t('Tentar novamente')}
            </Button>
          </>
        ) : !data ? (
          <p>{t('Carregando direção…')}</p>
        ) : data.directors.length ? (
          <p>{data.directors.map((director) => director.name).join(' · ')}</p>
        ) : (
          <p>
            {t(
              data.supported
                ? 'Direção não informada pelo TMDB.'
                : 'Direção indisponível para filmes sem vínculo com o TMDB.',
            )}
          </p>
        )}
      </div>
    </section>
  );
}
