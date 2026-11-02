import { useEffect, useEffectEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from './auth';
import { libraryRequest, type LibraryItem } from './library';
import {
  estimateTime,
  remainingEstimate,
  type EstimateMode,
  type GameEstimateData,
} from './game-estimate';
import { t } from './i18n';
import './game-estimate.css';

export default function GameEstimate({
  item,
  onExpired,
}: {
  item: LibraryItem;
  onExpired: () => void;
}) {
  const [data, setData] = useState<GameEstimateData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<EstimateMode>('mainMinutes');
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const controller = new AbortController();
    void libraryRequest<GameEstimateData>(
      'GET',
      item.id,
      undefined,
      'game-estimate',
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(true);
      });
    return () => controller.abort();
  }, [item.id, retry]);
  const modes: { key: EstimateMode; label: string }[] = [
    { key: 'mainMinutes', label: t('História principal') },
    { key: 'extrasMinutes', label: t('História + extras') },
    { key: 'completionistMinutes', label: t('100% completo') },
  ];
  const hasData = data && modes.some((option) => data[option.key] !== null);
  const remaining = remainingEstimate(
    data?.[mode] ?? null,
    item.playtimeMinutes || 0,
    item.status === 'completed',
  );
  return (
    <section className="game-estimate" aria-label={t('Tempo para terminar')}>
      <h2>{t('Tempo para terminar')}</h2>
      <div aria-live="polite">
        {error ? (
          <>
            <p>{t('Não foi possível consultar a estimativa da IGDB.')}</p>
            <Button
              variant="outline"
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
          <p>{t('Consultando estimativa…')}</p>
        ) : !hasData ? (
          <p>
            {t(
              data.supported
                ? 'A IGDB ainda não tem estimativa para este jogo.'
                : 'Estimativa indisponível para jogos sem vínculo com a IGDB.',
            )}
          </p>
        ) : (
          <>
            <fieldset className="game-estimate-modes">
              <legend className="sr-only">{t('Objetivo no jogo')}</legend>
              {modes.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={mode === option.key}
                  onClick={() => setMode(option.key)}
                >
                  <span>{option.label}</span>
                  <strong>
                    {data[option.key] === null
                      ? '—'
                      : estimateTime(data[option.key]!)}
                  </strong>
                </button>
              ))}
            </fieldset>
            {item.status !== 'completed' && (
              <p className="game-estimate-remaining">
                {remaining === null
                  ? t('Estimativa indisponível para este objetivo.')
                  : remaining === 0
                    ? t('Seu tempo jogado já atingiu a média deste objetivo.')
                    : t(
                        'Restante estimado: cerca de {0}',
                        estimateTime(remaining),
                      )}
              </p>
            )}
            <p className="game-estimate-note">
              {t(
                'Média da comunidade; seu ritmo pode variar. Horas jogadas não representam progresso da história.',
              )}
            </p>
            <p className="game-estimate-source">
              <a href="https://www.igdb.com" target="_blank" rel="noreferrer">
                {t('Fonte: IGDB')}
              </a>
              {data.sampleCount !== null && (
                <> · {t('{0} contribuições', data.sampleCount)}</>
              )}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
