import { NativeSelect } from '@/components/ui/native-select';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Clock3, Gamepad2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { libraryRequest, type LibraryItem } from './library';
import { ApiError } from './auth';
import { t, dateLabel } from './i18n';
import { today } from './CompletionFields';
import {
  gameSessionRequest,
  gameDuration,
  type GameHistory,
  type GameSession,
} from './game-session-client';
import './game-time.css';

type Props = {
  item: LibraryItem;
  parts?: LibraryItem[];
  changed: (item: LibraryItem) => void;
  onExpired: () => void;
};
export default function GameTimeAction(props: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(props.item.id);
  const parts = props.parts?.length ? props.parts : [props.item];
  const selected = parts.find((item) => item.id === selectedId) || props.item;
  // Trocar a parte remonta o formulário e descarta valores/datas da outra sessão, mantendo o diálogo aberto.
  return (
    <GameTimeForm
      key={selected.id}
      {...props}
      item={selected}
      parts={parts}
      open={open}
      setOpen={setOpen}
      selectPart={setSelectedId}
    />
  );
}
function GameTimeForm({
  item,
  parts,
  changed,
  onExpired,
  open,
  setOpen,
  selectPart,
}: Props & {
  parts: LibraryItem[];
  open: boolean;
  setOpen: (value: boolean) => void;
  selectPart: (id: string) => void;
}) {
  const [tab, setTab] = useState<'register' | 'history'>('register');
  const [data, setData] = useState<GameHistory | null>(null);
  const [loading, setLoading] = useState(open);
  const [mode, setMode] = useState<'add' | 'total'>('add');
  const [hours, setHours] = useState(''),
    [minutes, setMinutes] = useState('');
  const [playedOn, setPlayedOn] = useState(today);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false),
    requestId = useRef(crypto.randomUUID());
  const fieldId = useId();
  const expired = useEffectEvent(onExpired);
  const total = data?.playtimeMinutes ?? item.playtimeMinutes ?? 0;
  const renew = () => {
    requestId.current = crypto.randomUUID();
  };
  function choose(value: 'add' | 'total') {
    setMode(value);
    setError('');
    renew();
    setHours(value === 'total' ? String(Math.floor(total / 60)) : '');
    setMinutes(value === 'total' ? String(total % 60) : '');
  }
  function reset() {
    setEditing(null);
    setPlayedOn(today());
    choose('add');
  }
  function apply(value: GameHistory) {
    setData(value);
    changed({
      ...item,
      playtimeMinutes: value.playtimeMinutes,
      lastPlayedOn: value.lastPlayedOn,
      status: value.status,
      updatedAt: value.updatedAt || item.updatedAt,
    });
  }
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void gameSessionRequest(item.id, '', 'GET', undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(t('Não foi possível carregar as sessões.'));
      });
    return () => controller.abort();
  }, [open, item.id]);
  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar. Tente novamente.'),
        );
      // O modo total depende da fotografia atual; em conflito, recarrega antes de permitir nova tentativa.
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          setData(await gameSessionRequest(item.id));
        } catch {}
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function edit(session: GameSession) {
    setEditing(session.id);
    setMode('add');
    setHours(String(Math.floor(session.minutes / 60)));
    setMinutes(String(session.minutes % 60));
    setPlayedOn(session.playedOn);
    setTab('register');
    setError('');
  }
  let timeZone = 'UTC';
  try {
    timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (pending.current) return;
        setOpen(value);
        if (value) {
          setData(null);
          setLoading(true);
          reset();
          setRemoving(null);
          setTab('register');
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="game-time-trigger"
            aria-label={t('Registrar tempo de jogo em {0}', item.title)}
          />
        }
      >
        <Gamepad2 aria-hidden="true" />
        {t('Joguei')}
      </DialogTrigger>
      <DialogContent className="game-time-dialog">
        <div className="game-time-heading">
          <span aria-hidden="true">
            <Gamepad2 />
          </span>
          <div>
            <DialogTitle>{t('Tempo de jogo')}</DialogTitle>
            <DialogDescription>{item.title}</DialogDescription>
          </div>
        </div>
        {parts.length > 1 && (
          <div className="game-time-part">
            <label htmlFor={`${fieldId}-part`}>{t('Onde você jogou?')}</label>
            <NativeSelect
              id={`${fieldId}-part`}
              value={item.id}
              disabled={busy || loading}
              onChange={(event) => selectPart(event.target.value)}
            >
              {parts.map((part, index) => (
                <option key={part.id} value={part.id}>
                  {part.title}
                  {index === 0 ? ` · ${t('Jogo principal')}` : ''}
                </option>
              ))}
            </NativeSelect>
            <small>
              {t('As horas serão registradas somente na parte selecionada.')}
            </small>
          </div>
        )}
        <div className="game-time-current">
          <Clock3 aria-hidden="true" />
          <span>
            {t('Total registrado')}
            <strong>{gameDuration(total)}</strong>
          </span>
          {data?.lastPlayedOn && (
            <small>
              {t('Última vez jogado')}: {dateLabel(data.lastPlayedOn)}
            </small>
          )}
        </div>
        <div className="game-time-tabs">
          <Button
            variant={tab === 'register' ? 'default' : 'ghost'}
            disabled={busy}
            onClick={() => {
              reset();
              setTab('register');
            }}
          >
            {t('Registrar sessão')}
          </Button>
          <Button
            variant={tab === 'history' ? 'default' : 'ghost'}
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setTab('history');
            }}
          >
            {t('Histórico de sessões')}
            {data ? ` (${data.sessionCount})` : ''}
          </Button>
        </div>
        {loading && <output>{t('Carregando…')}</output>}
        {error && (
          <p role="alert" className="home-error">
            {error}
          </p>
        )}
        {!loading && !data && (
          <Button
            variant="outline"
            onClick={() =>
              void perform(async () =>
                setData(await gameSessionRequest(item.id)),
              )
            }
          >
            {t('Tentar novamente')}
          </Button>
        )}
        {data && tab === 'register' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const entered = Number(hours || 0) * 60 + Number(minutes || 0);
              if (
                !Number.isInteger(entered) ||
                entered < 1 ||
                entered > 6000000
              ) {
                setError(t('Informe um tempo de jogo válido.'));
                return;
              }
              void perform(async () => {
                const result = editing
                  ? await gameSessionRequest(
                      item.id,
                      `/${encodeURIComponent(editing)}`,
                      'PATCH',
                      { playedOn, minutes: entered, timeZone },
                    )
                  : await gameSessionRequest(item.id, '', 'POST', {
                      id: requestId.current,
                      mode,
                      minutes: entered,
                      playedOn,
                      timeZone,
                      ...(mode === 'total' ? { expectedTotal: total } : {}),
                    });
                apply(result);
                reset();
                setTab('history');
              });
            }}
          >
            {editing && <h3>{t('Editar sessão')}</h3>}
            <label className="game-session-date" htmlFor={`${fieldId}-date`}>
              {t('Dia em que jogou')}
              <Input
                id={`${fieldId}-date`}
                type="date"
                value={playedOn}
                max={today()}
                required
                disabled={busy}
                onChange={(event) => {
                  setPlayedOn(event.target.value);
                  renew();
                }}
              />
            </label>
            {!editing && (
              <fieldset disabled={busy} className="game-time-mode">
                <legend className="sr-only">
                  {t('Como registrar o tempo?')}
                </legend>
                <label>
                  <input
                    type="radio"
                    name={`${fieldId}-mode`}
                    checked={mode === 'add'}
                    onChange={() => choose('add')}
                  />
                  {t('Adicionar tempo jogado')}
                </label>
                <label>
                  <input
                    type="radio"
                    name={`${fieldId}-mode`}
                    checked={mode === 'total'}
                    onChange={() => choose('total')}
                  />
                  {t('Informar total após jogar')}
                </label>
              </fieldset>
            )}
            <p className="game-time-help">
              {t(
                editing || mode === 'add'
                  ? 'Quanto tempo você jogou?'
                  : 'Só a diferença para o total atual será registrada nesta sessão.',
              )}
            </p>
            <div className="game-time-inputs">
              <label htmlFor={`${fieldId}-hours`}>
                {t('Horas')}
                <Input
                  id={`${fieldId}-hours`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={mode === 'add' ? 24 : 100000}
                  step={1}
                  value={hours}
                  placeholder="0"
                  disabled={busy}
                  onChange={(event) => {
                    setHours(event.target.value);
                    renew();
                  }}
                />
              </label>
              <label htmlFor={`${fieldId}-minutes`}>
                {t('Minutos')}
                <Input
                  id={`${fieldId}-minutes`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  step={1}
                  value={minutes}
                  placeholder="0"
                  disabled={busy}
                  onChange={(event) => {
                    setMinutes(event.target.value);
                    renew();
                  }}
                />
              </label>
            </div>
            <div className="game-time-footer">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (editing) {
                    reset();
                    setTab('history');
                  } else setOpen(false);
                }}
              >
                {t('Cancelar')}
              </Button>
              <Button type="submit" disabled={busy}>
                {t(
                  busy
                    ? 'Salvando…'
                    : editing
                      ? 'Salvar alterações'
                      : 'Salvar sessão',
                )}
              </Button>
            </div>
          </form>
        )}
        {data && tab === 'history' && (
          <div className="game-session-history">
            <details className="game-session-baseline">
              <summary>
                {t('Saldo anterior sem data')}:{' '}
                {gameDuration(data.baselineMinutes)}
              </summary>
              <p>
                {t(
                  'Horas antigas permanecem aqui, sem inventar os dias em que você jogou. Corrigir o saldo não cria uma sessão.',
                )}
              </p>
              <form
                key={data.baselineMinutes}
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const baseline =
                    Number(form.get('hours') || 0) * 60 +
                    Number(form.get('minutes') || 0);
                  void perform(async () => {
                    await libraryRequest(
                      'PATCH',
                      item.id,
                      {
                        mode: 'total',
                        minutes:
                          data.playtimeMinutes -
                          data.baselineMinutes +
                          baseline,
                        expectedTotal: data.playtimeMinutes,
                      },
                      'playtime',
                    );
                    apply(await gameSessionRequest(item.id));
                  });
                }}
              >
                <div className="game-time-inputs">
                  <label>
                    {t('Horas')}
                    <Input
                      type="number"
                      name="hours"
                      min={0}
                      max={100000}
                      step={1}
                      defaultValue={Math.floor(data.baselineMinutes / 60)}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    {t('Minutos')}
                    <Input
                      type="number"
                      name="minutes"
                      min={0}
                      max={59}
                      step={1}
                      defaultValue={data.baselineMinutes % 60}
                      disabled={busy}
                    />
                  </label>
                </div>
                <Button type="submit" variant="outline" disabled={busy}>
                  {t('Corrigir saldo anterior')}
                </Button>
              </form>
            </details>
            {data.sessionCount === 0 && (
              <p className="game-time-help">
                {t(
                  'Nenhuma sessão registrada. As horas antigas continuam no saldo anterior.',
                )}
              </p>
            )}
            <ul className="game-session-list">
              {data.sessions.map((session) => (
                <li key={session.id}>
                  <div>
                    <strong>{dateLabel(session.playedOn)}</strong>
                    <span>{gameDuration(session.minutes)}</span>
                  </div>
                  <div className="game-session-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={t(
                        'Editar sessão de {0}',
                        dateLabel(session.playedOn),
                      )}
                      onClick={() => edit(session)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={t(
                        'Excluir sessão de {0}',
                        dateLabel(session.playedOn),
                      )}
                      onClick={() => setRemoving(session.id)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                  {removing === session.id && (
                    <div className="game-session-confirm">
                      <p>
                        {t(
                          'Excluir esta sessão e descontar sua duração do total?',
                        )}
                      </p>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setRemoving(null)}
                      >
                        {t('Cancelar')}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            apply(
                              await gameSessionRequest(
                                item.id,
                                `/${session.id}`,
                                'DELETE',
                              ),
                            );
                            setRemoving(null);
                          })
                        }
                      >
                        {t('Excluir sessão')}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {data.nextOffset !== null && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const next = await gameSessionRequest(
                      item.id,
                      `?offset=${data.nextOffset}`,
                    );
                    setData((current) =>
                      current
                        ? {
                            ...next,
                            sessions: [
                              ...current.sessions,
                              ...next.sessions.filter(
                                (session) =>
                                  !current.sessions.some(
                                    (previous) => previous.id === session.id,
                                  ),
                              ),
                            ],
                          }
                        : next,
                    );
                  })
                }
              >
                {t('Ver mais sessões')}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
