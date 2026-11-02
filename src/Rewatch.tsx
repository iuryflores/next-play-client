import { useEffect, useRef, useState } from 'react';
import { Repeat2, Play, CheckCheck, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ApiError } from './auth';
import { libraryRequest, type LibraryItem } from './library';
import { dateLabel, t } from './i18n';
import WatchDateField from './WatchDateField';
import './rewatch.css';

type Entry = {
  id: string;
  number: number;
  original: boolean;
  active: boolean;
  startedAt?: string;
  completedAt?: string;
  completedOn?: string | null;
  watchedDateUnknown: boolean;
  episodes: {
    season: number;
    episode: number;
    watchedAt: string | null;
    watchedDateUnknown: boolean;
  }[];
};
export default function Rewatch({
  item,
  changed,
  onExpired,
}: {
  item: LibraryItem;
  changed: (item: LibraryItem) => void;
  onExpired: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'start' | 'finish' | null>(null);
  const dateForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!historyOpen) return;
    const controller = new AbortController();
    void libraryRequest<{ entries: Entry[]; nextBefore: number | null }>(
      'GET',
      item.id,
      undefined,
      'rewatches',
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setEntries(result.entries);
          setNextBefore(result.nextBefore);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : t('Não foi possível carregar.'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    historyOpen,
    item.id,
    item.updatedAt,
    item.rewatchCount,
    item.rewatching,
  ]);
  async function moreHistory() {
    if (nextBefore === null || moreBusy) return;
    setMoreBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/library/${encodeURIComponent(item.id)}/rewatches?before=${nextBefore}`,
        { credentials: 'same-origin', signal: AbortSignal.timeout(15000) },
      );
      const data = await response.json();
      if (!response.ok)
        throw new ApiError(
          response.status,
          data.message || t('Não foi possível carregar.'),
        );
      setEntries((current) => [
        ...current,
        ...data.entries.filter(
          (entry: Entry) =>
            !current.some((previous) => previous.id === entry.id),
        ),
      ]);
      setNextBefore(data.nextBefore);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível carregar.'),
        );
    } finally {
      setMoreBusy(false);
    }
  }
  async function run(action: 'plan' | 'unplan' | 'start' | 'finish') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const form = dateForm.current ? new FormData(dateForm.current) : null;
      const unknown = form?.get('watchedDateUnknown') === 'true';
      const result = await libraryRequest<{ item: LibraryItem }>(
        'POST',
        item.id,
        {
          action,
          expectedCount: item.rewatchCount || 0,
          ...(action === 'finish'
            ? {
                watchedDateUnknown: unknown,
                ...(!unknown && form?.get('completedOn')
                  ? { completedOn: form.get('completedOn') }
                  : {}),
              }
            : {}),
        },
        'rewatches',
      );
      changed(result.item);
      setDialog(null);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const eligible =
    item.status === 'completed' || item.caughtUp || item.watchedBefore;
  if (!eligible && !item.rewatching) return null;
  return (
    <section className="rewatch-panel" aria-label={t('Visualizações')}>
      {item.rewatching && (
        <strong className="rewatch-tag">
          {t('Reassistindo · {0}ª vez', (item.rewatchCount || 0) + 1)}
        </strong>
      )}
      <div className="rewatch-actions">
        {!item.archived && !item.rewatching && (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run(item.rewatchWanted ? 'unplan' : 'plan')}
            >
              <Repeat2 aria-hidden="true" />
              {t(item.rewatchWanted ? 'Remover de Quero rever' : 'Quero rever')}
            </Button>
            <Button
              variant={item.rewatchWanted ? 'default' : 'outline'}
              disabled={busy}
              onClick={() => {
                setError('');
                setDialog('start');
              }}
            >
              <Play aria-hidden="true" />
              {t('Começar a rever')}
            </Button>
          </>
        )}
        {item.rewatching && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setError('');
              setDialog('finish');
            }}
          >
            <CheckCheck aria-hidden="true" />
            {t('Concluir esta vez')}
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={busy}
          aria-expanded={historyOpen}
          onClick={() => {
            if (!historyOpen) setLoading(true);
            setHistoryOpen(!historyOpen);
          }}
        >
          <History aria-hidden="true" />
          {t('Histórico de visualizações')}
        </Button>
      </div>
      {historyOpen && (
        <div className="rewatch-history" aria-busy={loading}>
          {loading ? (
            <p>{t('Carregando…')}</p>
          ) : (
            entries.map((entry) => (
              <details key={entry.id}>
                <summary>
                  <strong>{t('{0}ª vez', entry.number)}</strong>
                  <span>
                    {entry.active
                      ? t('Em andamento')
                      : entry.watchedDateUnknown
                        ? t('Data desconhecida')
                        : entry.completedOn || entry.completedAt
                          ? dateLabel(entry.completedOn || entry.completedAt!)
                          : t('Data não registrada')}
                  </span>
                  {item.kind === 'series' && (
                    <small>
                      {t('{0} episódios assistidos', entry.episodes.length)}
                    </small>
                  )}
                </summary>
                {entry.startedAt && (
                  <p>
                    {t('Início')}: {dateLabel(entry.startedAt)}
                  </p>
                )}
                {entry.original && (
                  <p>
                    {t(
                      'Primeira visualização: registros originais preservados.',
                    )}
                  </p>
                )}
                {!!entry.episodes.length && (
                  <ul>
                    {entry.episodes.map((episode) => (
                      <li key={`${episode.season}:${episode.episode}`}>
                        <strong>
                          T{episode.season} E{episode.episode}
                        </strong>
                        <span>
                          {episode.watchedAt
                            ? dateLabel(episode.watchedAt)
                            : t('Data desconhecida')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))
          )}
        </div>
      )}
      {historyOpen && nextBefore !== null && (
        <Button
          variant="outline"
          disabled={moreBusy || loading}
          onClick={() => void moreHistory()}
        >
          {t(moreBusy ? 'Carregando…' : 'Ver visualizações anteriores')}
        </Button>
      )}
      {!dialog && error && (
        <p role="alert" className="home-error">
          {error}
        </p>
      )}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogTitle>
            {t(
              dialog === 'start'
                ? 'Começar a rever?'
                : 'Concluir esta visualização?',
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              dialog === 'start'
                ? 'Uma nova visualização começa do zero. A conclusão, as datas e os episódios anteriores ficam preservados no histórico.'
                : item.kind === 'series' &&
                    item.catalogId?.startsWith('tmdb:series:')
                  ? 'Conclua todos os episódios regulares já lançados desta visualização antes de encerrá-la. Para marcar os pendentes de uma vez, use Concluir série.'
                  : 'Esta data pertence somente a esta visualização. A primeira vez assistida continua preservada.',
            )}
          </DialogDescription>
          {dialog === 'finish' && (
            <form ref={dateForm} onSubmit={(event) => event.preventDefault()}>
              <WatchDateField withDate />
            </form>
          )}
          {error && (
            <p role="alert" className="home-error">
              {error}
            </p>
          )}
          <div className="item-form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              {t('Cancelar')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (
                  dialog === 'finish' &&
                  dateForm.current &&
                  !dateForm.current.reportValidity()
                )
                  return;
                void run(dialog === 'start' ? 'start' : 'finish');
              }}
            >
              {t(
                busy
                  ? 'Salvando…'
                  : dialog === 'start'
                    ? 'Começar a rever'
                    : 'Concluir esta vez',
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
