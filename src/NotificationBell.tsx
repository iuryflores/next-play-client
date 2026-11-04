import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  Trophy,
  MessageCircle,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ApiError } from './auth';
import { language, t } from './i18n';
import './notification-center.css';

type Notice = {
  id: string;
  kind: 'achievement' | 'friend-request' | 'comment-reply' | 'friend-activity';
  createdAt: string;
  readAt: string | null;
  achievement: {
    id: string;
    name: string;
    family: string;
    description: string;
    target: number;
    evidence: string[];
  } | null;
  commentReply: {
    available: boolean;
    author: string;
    title: string;
    itemId: string | null;
    parentCommentId: string | null;
    excerpt: string;
  } | null;
  friendActivity: {
    available: boolean;
    name: string;
    title: string;
    itemId: string | null;
  } | null;
  friendRequest: {
    id: string;
    name: string;
    avatar: string;
    status: 'pending' | 'accepted' | 'closed';
  } | null;
};
type Notices = {
  items: Notice[];
  unreadCount: number;
  nextCursor: string | null;
};
async function request<T>(
  path: string,
  method = 'GET',
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new ApiError(
      response.status,
      t('Não foi possível atualizar as notificações.'),
    );
  return response.status === 204 ? (undefined as T) : response.json();
}
export default function NotificationBell({
  onExpired,
  onAchievements,
  onComment,
  onTitle,
}: {
  onExpired: () => void;
  onAchievements: () => void;
  onComment: (itemId: string, commentId: string) => void;
  onTitle: (itemId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Notices | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const opened = useRef(false);
  const actionPending = useRef(false);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible')
        setRevision((value) => value + 1);
    };
    // Mantém a paginação e a posição de leitura enquanto a central está aberta.
    const timer = window.setInterval(() => {
      if (!opened.current && !actionPending.current) refresh();
    }, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('nextplay:notifications-changed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('nextplay:notifications-changed', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    // Com a central fechada, o sino precisa só do contador, sem baixar evidências e perfis de trinta avisos.
    const summary = !opened.current;
    void request<Notices>(
      summary ? '/notifications?summary=1' : '/notifications',
      'GET',
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setData((current) =>
            summary && current
              ? { ...current, unreadCount: value.unreadCount }
              : value,
          );
        }
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(t('Não foi possível atualizar as notificações.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  async function act(
    path: string,
    method: string,
    notice?: Notice,
    friendship = false,
  ) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    try {
      await request(path, method);
      if (friendship) {
        // O convite pode ter sido resolvido em outra aba; a próxima consulta atualiza seu status.
        window.dispatchEvent(new Event('nextplay:friends-changed'));
        if (notice) await request(`/notifications/${notice.id}/read`, 'PATCH');
      }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      setError(
        t('Não foi possível concluir a ação. Atualize e tente novamente.'),
      );
    } finally {
      actionPending.current = false;
      setBusy(false);
      setRevision((value) => value + 1);
    }
  }
  async function more() {
    if (!data?.nextCursor || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    const started = generation.current;
    try {
      const page = await request<Notices>(
        `/notifications?cursor=${encodeURIComponent(data.nextCursor)}`,
      );
      // Uma atualização da primeira página invalida paginações iniciadas antes dela.
      if (started === generation.current)
        setData((current) =>
          current
            ? {
                ...page,
                items: [
                  ...current.items,
                  ...page.items.filter(
                    (item) =>
                      !current.items.some(
                        (existing) => existing.id === item.id,
                      ),
                  ),
                ],
              }
            : page,
        );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setError(t('Não foi possível atualizar as notificações.'));
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  const count = data?.unreadCount || 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        opened.current = value;
        setOpen(value);
        // Abrir a central apenas atualiza o histórico; a leitura exige uma ação explícita.
        if (value) {
          setError('');
          setLoading(true);
          setRevision((current) => current + 1);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="notification-bell"
            aria-label={
              count
                ? t('Notificações: {0} não lidas', count)
                : t('Notificações')
            }
          />
        }
      >
        <Bell aria-hidden="true" />
        {count > 0 && (
          <span className="notification-count" aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </DialogTrigger>
      <DialogContent placement="side" className="notification-center">
        <header className="notification-heading">
          <span className="notification-heading-icon" aria-hidden="true">
            <Bell />
          </span>
          <div>
            <DialogTitle>{t('Notificações')}</DialogTitle>
            <DialogDescription>
              {t(
                'Conquistas, convites, respostas e atividades relacionadas ao seu Para depois.',
              )}
            </DialogDescription>
          </div>
        </header>
        <div className="notification-toolbar">
          <span className="notification-total">
            {count > 0
              ? t('Notificações: {0} não lidas', count)
              : t('Notificações')}
          </span>
          <div className="notification-toolbar-actions">
            <Button
              variant="ghost"
              className="notification-read-all"
              disabled={busy || !count}
              onClick={() => void act('/notifications/read-all', 'POST')}
            >
              <CheckCheck aria-hidden="true" />
              {t('Marcar todas como lidas')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('Atualizar notificações')}
              disabled={busy}
              onClick={() => {
                setError('');
                setRevision((value) => value + 1);
              }}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="home-error">
            {error}
          </p>
        )}
        {loading ? (
          <output>{t('Carregando…')}</output>
        ) : !data?.items.length && !error ? (
          <p className="notification-empty">
            {t('Nenhuma notificação por enquanto.')}
          </p>
        ) : null}
        <ul className="notification-list" aria-busy={busy}>
          {data?.items.map((item) => (
            <li
              key={item.id}
              className={`notification-item${item.readAt ? '' : ' is-unread'}`}
              data-kind={item.kind}
            >
              <div className="notification-symbol" aria-hidden="true">
                {item.achievement ? (
                  <Trophy />
                ) : item.friendActivity ? (
                  <Users />
                ) : item.commentReply ? (
                  <MessageCircle />
                ) : item.friendRequest?.avatar ? (
                  <img src={item.friendRequest.avatar} alt="" />
                ) : (
                  item.friendRequest?.name.charAt(0) || <Trophy />
                )}
              </div>
              <div className="notification-body">
                <small>
                  {t(
                    item.kind === 'achievement'
                      ? 'Conquista desbloqueada!'
                      : item.kind === 'comment-reply'
                        ? 'Resposta ao seu comentário'
                        : item.kind === 'friend-activity'
                          ? 'Atividade de amigo'
                          : 'Convite de amizade',
                  )}
                  {!item.readAt && (
                    <span className="notification-unread">
                      <span className="sr-only">{t('Não lida')}</span>
                    </span>
                  )}
                </small>
                <strong>
                  {item.achievement
                    ? t(item.achievement.name)
                    : item.commentReply
                      ? item.commentReply.available
                        ? item.commentReply.title
                        : t('Conversa indisponível')
                      : item.friendActivity
                        ? item.friendActivity.available
                          ? item.friendActivity.title
                          : t('Atividade indisponível')
                        : item.friendRequest?.name}
                </strong>
                {item.achievement && (
                  <>
                    <p>
                      {t(item.achievement.description, item.achievement.target)}
                    </p>
                    {item.achievement.evidence.length > 0 && (
                      <p className="notification-reason">
                        {item.achievement.evidence.at(-1)}
                      </p>
                    )}
                    {item.achievement.evidence.length > 0 && (
                      <details>
                        <summary>{t('Por que ganhei?')}</summary>
                        <ul>
                          {item.achievement.evidence.map((evidence, index) => (
                            <li key={index}>{evidence}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
                {item.friendRequest && (
                  <p>
                    {t(
                      item.friendRequest.status === 'pending'
                        ? 'Quer ser seu amigo.'
                        : item.friendRequest.status === 'accepted'
                          ? 'Convite aceito.'
                          : 'Convite encerrado.',
                    )}
                  </p>
                )}
                {item.commentReply &&
                  (item.commentReply.available ? (
                    <>
                      <p>
                        {t(
                          '{0} respondeu ao seu comentário.',
                          item.commentReply.author.replace(
                            /^Pessoa /,
                            t('Pessoa') + ' ',
                          ),
                        )}
                      </p>
                      <p className="notification-reason">
                        {item.commentReply.excerpt}
                      </p>
                    </>
                  ) : (
                    <p>{t('Esta conversa não está mais disponível.')}</p>
                  ))}
                {item.friendActivity && (
                  <p>
                    {item.friendActivity.available
                      ? t(
                          '{0} registrou a conclusão deste título, que estava no seu Para depois.',
                          item.friendActivity.name,
                        )
                      : t('Esta atividade não está mais disponível.')}
                  </p>
                )}
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString(language, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </time>
                <div className="notification-actions">
                  {item.achievement && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (!item.readAt)
                          void act(`/notifications/${item.id}/read`, 'PATCH');
                        opened.current = false;
                        setOpen(false);
                        onAchievements();
                      }}
                    >
                      {t('Ver conquistas')}
                    </Button>
                  )}
                  {item.commentReply?.available && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (!item.readAt)
                          void act(`/notifications/${item.id}/read`, 'PATCH');
                        opened.current = false;
                        setOpen(false);
                        onComment(
                          item.commentReply!.itemId!,
                          item.commentReply!.parentCommentId!,
                        );
                      }}
                    >
                      {t('Ver conversa')}
                    </Button>
                  )}
                  {item.friendActivity?.available && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (!item.readAt)
                          void act(`/notifications/${item.id}/read`, 'PATCH');
                        opened.current = false;
                        setOpen(false);
                        onTitle(item.friendActivity!.itemId!);
                      }}
                    >
                      {t('Ver título')}
                    </Button>
                  )}
                  {item.friendRequest?.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            `/friends/${item.friendRequest!.id}/accept`,
                            'POST',
                            item,
                            true,
                          )
                        }
                      >
                        {t('Aceitar')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            `/friends/${item.friendRequest!.id}`,
                            'DELETE',
                            item,
                            true,
                          )
                        }
                      >
                        {t('Recusar')}
                      </Button>
                    </>
                  )}
                  {!item.readAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="notification-read-one"
                      disabled={busy}
                      onClick={() =>
                        void act(`/notifications/${item.id}/read`, 'PATCH')
                      }
                    >
                      {t('Marcar como lida')}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {data?.nextCursor && (
          <Button variant="outline" disabled={busy} onClick={() => void more()}>
            {t('Ver mais')}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
