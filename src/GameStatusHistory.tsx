import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from './auth';
import { dateLabel, language, t } from './i18n';
import { statusNames } from './library';
import {
  gameStatusEventLabel,
  type GameStatusHistoryData,
} from './game-status-history';
import './game-status-history.css';

export default function GameStatusHistory({
  itemId,
  onExpired,
}: {
  itemId: string;
  onExpired: () => void;
}) {
  const [data, setData] = useState<GameStatusHistoryData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const pending = useRef(false);
  const expired = useEffectEvent(onExpired);
  async function request(
    before?: string,
    signal?: AbortSignal,
  ): Promise<GameStatusHistoryData> {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    const response = await fetch(
      `/api/library/${encodeURIComponent(itemId)}/game-status-history${query}`,
      {
        credentials: 'same-origin',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      },
    );
    const value = await response.json().catch(() => null);
    if (!response.ok || !value)
      throw new ApiError(
        response.status,
        t('Não foi possível carregar o histórico de status.'),
      );
    return value;
  }
  const read = useEffectEvent(request);
  useEffect(() => {
    const controller = new AbortController();
    void read(undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(true);
      });
    return () => controller.abort();
  }, [itemId, retry]);
  async function more() {
    if (!data?.nextBefore || pending.current) return;
    pending.current = true;
    setMoreBusy(true);
    setMoreError(false);
    try {
      const next = await request(data.nextBefore);
      // O cursor é estável mesmo que outra aba acrescente alterações durante a paginação.
      setData((current) =>
        current
          ? {
              ...next,
              events: [
                ...new Map(
                  [...current.events, ...next.events].map((event) => [
                    event.id,
                    event,
                  ]),
                ).values(),
              ],
            }
          : next,
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setMoreError(true);
    } finally {
      pending.current = false;
      setMoreBusy(false);
    }
  }
  return (
    <section
      className="game-status-history"
      aria-label={t('Histórico de status')}
    >
      <h2>{t('Histórico de status')}</h2>
      <p className="game-status-note">
        {t('As datas indicam quando cada alteração foi registrada no app.')}
      </p>
      {error ? (
        <>
          <p role="alert">
            {t('Não foi possível carregar o histórico de status.')}
          </p>
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
        <output>{t('Carregando histórico…')}</output>
      ) : (
        <>
          {data.events.length ? (
            <ol className="game-status-events">
              {data.events.map((event) => (
                <li key={event.id}>
                  <strong>{gameStatusEventLabel(event)}</strong>
                  <small>
                    {event.type === 'status' && event.fromStatus ? (
                      <>{statusNames.game[event.fromStatus]} → </>
                    ) : null}
                    {statusNames.game[event.toStatus]}
                  </small>
                  <time dateTime={event.recordedAt}>
                    {dateLabel(event.recordedAt)} ·{' '}
                    {new Date(event.recordedAt).toLocaleTimeString(language, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  {event.source !== 'manual' && (
                    <span>
                      {t(
                        event.source === 'session'
                          ? 'Ao registrar uma sessão de jogo'
                          : 'Ao atualizar as horas jogadas',
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>
              {t(
                'Ainda não há alterações de status registradas para este jogo.',
              )}
            </p>
          )}
          {data.earlierHistoryUnknown && (
            <p className="game-status-note">
              {t(
                'Alterações anteriores a este histórico não estão disponíveis; nenhuma data antiga foi presumida.',
              )}
            </p>
          )}
          {moreError && (
            <p role="alert">
              {t('Não foi possível carregar mais alterações. Tente novamente.')}
            </p>
          )}
          {data.nextBefore && (
            <Button
              variant="outline"
              disabled={moreBusy}
              onClick={() => void more()}
            >
              {t(
                moreBusy
                  ? 'Carregando…'
                  : moreError
                    ? 'Tentar novamente'
                    : 'Ver alterações anteriores',
              )}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
