import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Flag, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import IconAction from './IconAction';
import { ApiError } from './auth';
import { dateLabel, t } from './i18n';
import './challenges.css';

type Challenge = {
  id: string;
  name: string;
  kind: 'game' | 'movie' | 'book';
  target: number;
  startsOn: string;
  endsOn: string;
  count: number;
  percent: number;
  achieved: boolean;
  closedAt: string | null;
  phase: 'active' | 'scheduled' | 'ended' | 'closed';
  evidence: { title: string; completedOn: string }[];
};
type Data = { challenges: Challenge[]; nextBefore: string | null };
async function request<T>(
  method = 'GET',
  path = '',
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch('/api/challenges' + path, {
    method,
    credentials: 'same-origin',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status === 204) return undefined as T;
  const value = await response.json().catch(() => null);
  if (!response.ok || !value)
    throw new ApiError(
      response.status,
      typeof value?.message === 'string'
        ? value.message
        : t('Não foi possível carregar os desafios.'),
    );
  return value;
}
export default function Challenges({ onExpired }: { onExpired: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    item: Challenge;
    action: 'close' | 'delete';
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const pending = useRef(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const morePending = useRef(false);
  const createId = useRef('');
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const controller = new AbortController();
    void request<Data>('GET', '', undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(t('Não foi possível carregar os desafios.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);
  function refresh() {
    if (morePending.current) return;
    setLoading(true);
    setError('');
    setMoreError(false);
    setReload((value) => value + 1);
  }
  const refreshOnFocus = useEffectEvent(() => {
    if (!pending.current && !morePending.current) refresh();
  });
  useEffect(() => {
    const handleFocus = () => refreshOnFocus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);
  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFormError('');
    try {
      await action();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setFormError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar o desafio.'),
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function more() {
    if (!data?.nextBefore || morePending.current) return;
    morePending.current = true;
    setMoreBusy(true);
    setMoreError(false);
    try {
      const next = await request<Data>(
        'GET',
        '?before=' + encodeURIComponent(data.nextBefore),
      );
      setData((current) =>
        current
          ? {
              ...next,
              challenges: [
                ...new Map(
                  [...current.challenges, ...next.challenges].map((item) => [
                    item.id,
                    item,
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
      morePending.current = false;
      setMoreBusy(false);
    }
  }
  const year = new Date().getFullYear();
  const kinds = {
    game: t('Jogos concluídos'),
    movie: t('Filmes assistidos'),
    book: t('Livros lidos'),
  };
  const phases = {
    active: t('Em andamento'),
    scheduled: t('Agendado'),
    ended: t('Prazo encerrado'),
    closed: t('Encerrado'),
  };
  return (
    <section className="challenges-page" aria-label={t('Desafios pessoais')}>
      <header className="challenges-heading">
        <div>
          <h1>{t('Desafios pessoais')}</h1>
          <p>
            {t(
              'Defina sua meta e acompanhe suas conclusões no período escolhido.',
            )}
          </p>
        </div>
        <div>
          <IconAction
            label={t('Atualizar desafios')}
            icon={RefreshCw}
            variant="ghost"
            disabled={loading || busy || moreBusy}
            onClick={refresh}
          />
          <Button
            disabled={loading || busy || moreBusy}
            onClick={() => {
              createId.current = crypto.randomUUID();
              setFormError('');
              setOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            {t('Novo desafio')}
          </Button>
        </div>
      </header>
      <p className="challenges-rule">
        {t(
          'Contam títulos concluídos com data informada, incluindo arquivados. Jogos principais e expansões independentes contam; DLCs dependentes identificadas não somam jogos extras.',
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {loading && <output>{t('Carregando desafios…')}</output>}
      {!loading && error && (
        <Button variant="outline" onClick={refresh}>
          {t('Tentar novamente')}
        </Button>
      )}
      {!loading && data && !data.challenges.length && (
        <div className="challenges-empty">
          <Flag aria-hidden="true" />
          <h2>{t('Qual será seu próximo desafio?')}</h2>
          <p>
            {t(
              'Crie uma meta, como concluir 10 jogos ou assistir a 50 filmes neste ano.',
            )}
          </p>
        </div>
      )}
      <div className="challenges-grid">
        {data?.challenges.map((item) => (
          <article
            className={`challenge-card${item.achieved ? ' challenge-achieved' : ''}`}
            key={item.id}
          >
            <header>
              <h2>{item.name}</h2>
              <IconAction
                label={t('Excluir desafio {0}', item.name)}
                icon={Trash2}
                variant="ghost"
                disabled={loading || moreBusy}
                onClick={() => {
                  setFormError('');
                  setConfirm({ item, action: 'delete' });
                }}
              />
            </header>
            <div className="challenge-badges">
              <span>{phases[item.phase]}</span>
              {item.achieved && <span>{t('Meta atingida')}</span>}
            </div>
            <p className="challenge-kind">{kinds[item.kind]}</p>
            <p className="challenge-count">
              <strong>{item.count}</strong> / {item.target}
            </p>
            <progress
              value={Math.min(item.count, item.target)}
              max={item.target}
              aria-label={t('Progresso do desafio {0}', item.name)}
            />
            <small>
              {dateLabel(item.startsOn)} — {dateLabel(item.endsOn)}
            </small>
            {!!item.evidence.length && (
              <details>
                <summary>{t('Últimas conclusões que contaram')}</summary>
                <ul>
                  {item.evidence.map((entry, index) => (
                    <li key={index}>
                      <span>{entry.title}</span>
                      <time dateTime={entry.completedOn}>
                        {dateLabel(entry.completedOn)}
                      </time>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {item.closedAt ? (
              <p className="challenge-frozen">
                {t(
                  'Progresso salvo ao encerrar em {0}.',
                  dateLabel(item.closedAt),
                )}
              </p>
            ) : (
              <Button
                variant="outline"
                disabled={loading || moreBusy}
                onClick={() => {
                  setFormError('');
                  setConfirm({ item, action: 'close' });
                }}
              >
                {t('Encerrar desafio')}
              </Button>
            )}
          </article>
        ))}
      </div>
      {moreError && (
        <p role="alert">{t('Não foi possível carregar mais desafios.')}</p>
      )}
      {data?.nextBefore && (
        <Button
          variant="outline"
          disabled={moreBusy || loading || busy}
          onClick={() => void more()}
        >
          {t(
            moreBusy
              ? 'Carregando…'
              : moreError
                ? 'Tentar novamente'
                : 'Ver mais desafios',
          )}
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending.current) setOpen(value);
        }}
      >
        <DialogContent className="challenge-dialog">
          <DialogTitle>{t('Novo desafio')}</DialogTitle>
          <DialogDescription>
            {t(
              'As conclusões já registradas no período também contam. O progresso pode mudar até você encerrar o desafio.',
            )}
          </DialogDescription>
          <form
            onChange={() => {
              createId.current = crypto.randomUUID();
            }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              let timeZone = 'UTC';
              try {
                timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              } catch {}
              void perform(async () => {
                await request('POST', '', {
                  id: createId.current,
                  name: form.get('name'),
                  kind: form.get('kind'),
                  target: Number(form.get('target')),
                  startsOn: form.get('startsOn'),
                  endsOn: form.get('endsOn'),
                  timeZone,
                });
                setOpen(false);
                refresh();
              });
            }}
          >
            <fieldset disabled={busy}>
              <label htmlFor="challenge-name">{t('Nome do desafio')}</label>
              <Input
                id="challenge-name"
                name="name"
                required
                minLength={3}
                maxLength={100}
                placeholder={t('Ex.: concluir 10 jogos este ano')}
              />
              <label htmlFor="challenge-kind">
                {t('O que você quer concluir?')}
              </label>
              <NativeSelect id="challenge-kind" name="kind" defaultValue="game">
                {Object.entries(kinds).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
              <label htmlFor="challenge-target">{t('Quantidade')}</label>
              <Input
                id="challenge-target"
                name="target"
                type="number"
                min={1}
                max={10000}
                step={1}
                defaultValue={10}
                required
              />
              <div className="challenge-dates">
                <div>
                  <label htmlFor="challenge-start">{t('Início')}</label>
                  <Input
                    id="challenge-start"
                    name="startsOn"
                    type="date"
                    defaultValue={`${year}-01-01`}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="challenge-end">{t('Término')}</label>
                  <Input
                    id="challenge-end"
                    name="endsOn"
                    type="date"
                    defaultValue={`${year}-12-31`}
                    required
                  />
                </div>
              </div>
            </fieldset>
            {formError && <p role="alert">{formError}</p>}
            <div className="challenge-dialog-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t('Cancelar')}
              </Button>
              <Button type="submit" disabled={busy}>
                {t(busy ? 'Salvando…' : 'Criar desafio')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirm}
        onOpenChange={(value) => {
          if (!value && !pending.current) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {t(
              confirm?.action === 'close'
                ? 'Encerrar este desafio?'
                : 'Excluir este desafio?',
            )}
          </DialogTitle>
          <DialogDescription>
            {confirm?.item.name} ·{' '}
            {t(
              confirm?.action === 'close'
                ? 'O progresso atual ficará salvo e não poderá ser reaberto. Seus títulos permanecem iguais.'
                : 'Somente este desafio será excluído. Seus títulos e históricos serão preservados.',
            )}
          </DialogDescription>
          {formError && <p role="alert">{formError}</p>}
          <div className="challenge-dialog-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              {t('Cancelar')}
            </Button>
            <Button
              variant={confirm?.action === 'delete' ? 'destructive' : 'default'}
              disabled={busy}
              onClick={() => {
                if (!confirm) return;
                const action = confirm;
                void perform(async () => {
                  await request(
                    action.action === 'close' ? 'POST' : 'DELETE',
                    '/' +
                      encodeURIComponent(action.item.id) +
                      (action.action === 'close' ? '/close' : ''),
                  );
                  setConfirm(null);
                  refresh();
                });
              }}
            >
              {t(
                busy
                  ? 'Salvando…'
                  : confirm?.action === 'close'
                    ? 'Encerrar desafio'
                    : 'Excluir desafio',
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
