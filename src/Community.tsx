import PageLoading from './PageLoading';
import { notifySaved } from './notifications';
import { dateLabel, t, language } from './i18n';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import { Heart, MessageCircle, Reply, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from './auth';
import './community.css';

type Comment = {
  spoiler?: boolean;
  id: string;
  parentId: string | null;
  text: string;
  author: string;
  mine: boolean;
  deleted: boolean;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  replyCount: number;
  parentReplyCount?: number;
};
type CommunityData = {
  ratingSummary?: {
    average: number | null;
    count: number;
    distribution: { stars: number; count: number }[];
  };
  comments: Comment[];
  next: string | null;
};
type Thread = { comment: Comment; replies: Comment[]; next: string | null };
function mergeRows(
  previous: Comment[],
  incoming: Comment[],
  descending = false,
) {
  return [
    ...new Map([...previous, ...incoming].map((row) => [row.id, row])).values(),
  ].sort((a, b) =>
    descending ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id),
  );
}
async function request<T>(
  id: string,
  path: string,
  method = 'GET',
  body?: object,
): Promise<T> {
  const response = await fetch(
    `/api/library/${encodeURIComponent(id)}/${path}`,
    {
      method,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(15000),
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    },
  );
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof data?.message === 'string'
        ? data.message
        : t('Não foi possível carregar a conversa.'),
    );
  if (method !== 'GET' && method !== 'PATCH')
    notifySaved(
      t(
        method === 'DELETE'
          ? 'Comentário removido.'
          : path.endsWith('/replies')
            ? 'Resposta publicada.'
            : 'Comentário publicado.',
      ),
    );
  return data as T;
}
function CommentCard({
  comment,
  busy,
  confirmDelete,
  like,
  reply,
  remove,
  children,
}: {
  comment: Comment;
  busy: boolean;
  confirmDelete: string;
  like: () => void;
  reply?: () => void;
  remove: () => void;
  children?: ReactNode;
}) {
  return (
    <article
      className={`title-comment${comment.parentId ? ' comment-reply' : ''}`}
      id={`comment-${comment.id}`}
      tabIndex={-1}
    >
      <header>
        <strong>
          {comment.mine
            ? t('Você')
            : comment.author.replace(/^Pessoa /, t('Pessoa') + ' ')}
        </strong>
        <time dateTime={comment.createdAt}>{dateLabel(comment.createdAt)}</time>
      </header>
      {comment.deleted ? (
        <p>
          <em>{t('Comentário removido')}</em>
        </p>
      ) : comment.spoiler !== false ? (
        <details>
          <summary>
            {t('Conteúdo protegido: revelar possíveis spoilers')}
          </summary>
          <p>{comment.text}</p>
        </details>
      ) : (
        <p>{comment.text}</p>
      )}
      {!comment.deleted && (
        <div className="comment-actions">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-pressed={comment.liked}
            aria-label={t(
              comment.liked ? 'Retirar curtida' : 'Curtir comentário',
            )}
            onClick={like}
          >
            <Heart
              aria-hidden="true"
              fill={comment.liked ? 'currentColor' : 'none'}
            />
            <span>{comment.likeCount}</span>
          </Button>
          {reply && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={reply}
            >
              <Reply aria-hidden="true" />
              {t('Responder')}
            </Button>
          )}
          {comment.mine && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 aria-hidden="true" />
              {t(
                confirmDelete === comment.id
                  ? 'Confirmar exclusão'
                  : 'Excluir comentário',
              )}
            </Button>
          )}
        </div>
      )}
      {children}
    </article>
  );
}
export default function Community({
  itemId,
  focusCommentId,
  onExpired,
  onRating,
}: {
  itemId: string;
  focusCommentId?: string;
  onExpired: () => void;
  onRating?: (average: number | null) => void;
}) {
  const [data, setData] = useState<CommunityData | null>(null);
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replying, setReplying] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [spoilers, setSpoilers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const publication = useRef<Record<string, { text: string; id: string }>>({});
  const focused = useRef(false);
  const [revision, setRevision] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState('');
  const expired = useEffectEvent(onExpired);
  const ratingChanged = useEffectEvent((average: number | null) =>
    onRating?.(average),
  );
  useEffect(() => {
    let active = true;
    void Promise.all([
      request<CommunityData>(itemId, 'community'),
      focusCommentId
        ? request<Thread>(itemId, `comments/${focusCommentId}/thread`)
        : Promise.resolve(null),
    ])
      .then(([result, thread]) => {
        if (!active) return;
        ratingChanged(result.ratingSummary?.average ?? null);
        const incoming = thread
          ? mergeRows(result.comments, [thread.comment], true)
          : result.comments;
        setData((current) =>
          current
            ? {
                comments: mergeRows(current.comments, incoming, true),
                next: current.next,
                ratingSummary: result.ratingSummary,
              }
            : { ...result, comments: incoming },
        );
        if (thread) {
          setThreads((current) => ({
            ...current,
            [thread.comment.id]: thread,
          }));
          setExpanded((current) => ({ ...current, [thread.comment.id]: true }));
        }
        setError('');
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else
          setError(t('Não foi possível carregar a conversa. Tente novamente.'));
      });
    return () => {
      active = false;
    };
  }, [itemId, focusCommentId, revision]);
  useEffect(() => {
    if (!focusCommentId || !data || focused.current) return;
    const element = document.getElementById(`comment-${focusCommentId}`);
    if (element) {
      focused.current = true;
      element.scrollIntoView({ block: 'center' });
      element.focus({ preventScroll: true });
    }
  }, [focusCommentId, data]);
  async function action(run: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await run();
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
  function updateComment(id: string, values: Partial<Comment>) {
    setData((current) =>
      current
        ? {
            ...current,
            comments: current.comments.map((row) =>
              row.id === id ? { ...row, ...values } : row,
            ),
          }
        : current,
    );
    setThreads((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, value]) => [
          key,
          {
            ...value,
            comment:
              value.comment.id === id
                ? { ...value.comment, ...values }
                : value.comment,
            replies: value.replies.map((row) =>
              row.id === id ? { ...row, ...values } : row,
            ),
          },
        ]),
      ),
    );
  }
  function publicationId(key: string, value: string) {
    if (publication.current[key]?.text !== value)
      publication.current[key] = { text: value, id: crypto.randomUUID() };
    return publication.current[key].id;
  }
  function post(event: SubmitEvent<HTMLFormElement>, root?: Comment) {
    event.preventDefault();
    const value = (root ? drafts[root.id] || '' : text).trim();
    if (!value) return;
    const key = root?.id || 'root';
    void action(async () => {
      const spoiler = spoilers[key] !== false;
      const body = {
        text: value,
        spoiler,
        clientRequestId: publicationId(key, JSON.stringify([value, spoiler])),
      };
      if (root) {
        const result = await request<{ comment: Comment }>(
          itemId,
          `comments/${root.id}/replies`,
          'POST',
          body,
        );
        setThreads((current) => ({
          ...current,
          [root.id]: {
            comment: current[root.id]?.comment || root,
            replies: mergeRows(current[root.id]?.replies || [], [
              result.comment,
            ]),
            next: current[root.id]?.next || null,
          },
        }));
        updateComment(root.id, {
          replyCount: result.comment.parentReplyCount ?? root.replyCount + 1,
        });
        setDrafts((current) => ({ ...current, [root.id]: '' }));
        setReplying(null);
        window.dispatchEvent(new Event('nextplay:notifications-changed'));
      } else {
        await request(itemId, 'comments', 'POST', body);
        setText('');
        setRevision((value) => value + 1);
      }
      delete publication.current[key];
    });
  }
  async function loadThread(root: Comment, more = false) {
    const result = await request<Thread>(
      itemId,
      `comments/${root.id}/thread${more && threads[root.id]?.next ? '?after=' + threads[root.id].next : ''}`,
    );
    setThreads((current) => ({
      ...current,
      [root.id]: {
        ...result,
        replies: mergeRows(current[root.id]?.replies || [], result.replies),
      },
    }));
    updateComment(root.id, result.comment);
    setExpanded((current) => ({ ...current, [root.id]: true }));
  }
  const card = (comment: Comment, children?: ReactNode) => (
    <CommentCard
      key={comment.id}
      comment={comment}
      busy={busy}
      confirmDelete={confirmDelete}
      like={() =>
        void action(async () => {
          const result = await request<{ liked: boolean; likeCount: number }>(
            itemId,
            `comments/${comment.id}/like`,
            'PATCH',
            { liked: !comment.liked },
          );
          updateComment(comment.id, result);
        })
      }
      reply={
        !comment.parentId
          ? () =>
              void action(async () => {
                await loadThread(comment);
                setReplying(comment.id);
              })
          : undefined
      }
      remove={() => {
        if (confirmDelete !== comment.id) {
          setConfirmDelete(comment.id);
          return;
        }
        void action(async () => {
          await request(itemId, `comments/${comment.id}`, 'DELETE');
          updateComment(comment.id, {
            deleted: true,
            text: '',
            liked: false,
            likeCount: 0,
          });
          setConfirmDelete('');
        });
      }}
    >
      {children}
    </CommentCard>
  );
  return (
    <section
      className="title-community"
      aria-label={t('Comunidade deste título')}
    >
      <h3>{t(' Conversa sobre este título ')}</h3>
      <p>
        {t(
          ' Os comentários são visíveis para todas as pessoas que adicionaram este título à coleção. Podem conter spoilers. ',
        )}
      </p>
      {data?.ratingSummary && (
        <section
          className="community-rating"
          aria-label={t('Nota da comunidade')}
        >
          <div>
            <strong>
              <Star aria-hidden="true" />
              {data.ratingSummary.average === null
                ? '—'
                : data.ratingSummary.average.toLocaleString(language, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  })}
              <small>/ 5</small>
            </strong>
            <span>{t('Nota da comunidade')}</span>
            <small>{t('{0} avaliações', data.ratingSummary.count)}</small>
          </div>
          {data.ratingSummary.count ? (
            <div className="community-rating-bars">
              {data.ratingSummary.distribution.map((row) => (
                <label key={row.stars}>
                  <span>{row.stars} ★</span>
                  <progress
                    value={row.count}
                    max={data.ratingSummary!.count}
                    aria-label={t(
                      '{0} avaliações com {1} estrelas',
                      row.count,
                      row.stars,
                    )}
                  />
                  <small>{row.count}</small>
                </label>
              ))}
            </div>
          ) : (
            <p>{t('Ainda não há avaliações para este título.')}</p>
          )}
        </section>
      )}
      {error && (
        <div role="alert" className="home-error">
          {error}
          <Button
            type="button"
            variant="link"
            onClick={() => setRevision((value) => value + 1)}
          >
            {t(' Tentar novamente ')}
          </Button>
        </div>
      )}
      {!data && !error && (
        <PageLoading compact label={t('Carregando comentários…')} />
      )}
      {data?.comments.map((comment) =>
        card(
          comment,
          <>
            {comment.replyCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                aria-expanded={Boolean(expanded[comment.id])}
                onClick={() => {
                  if (expanded[comment.id])
                    setExpanded((current) => ({
                      ...current,
                      [comment.id]: false,
                    }));
                  else void action(() => loadThread(comment));
                }}
              >
                <MessageCircle aria-hidden="true" />
                {t(
                  expanded[comment.id]
                    ? 'Ocultar respostas ({0})'
                    : 'Ver respostas ({0})',
                  comment.replyCount,
                )}
              </Button>
            )}
            {expanded[comment.id] && (
              <div className="comment-replies">
                {threads[comment.id]?.replies.map((reply) => card(reply))}
                {threads[comment.id]?.next && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void action(() => loadThread(comment, true))}
                  >
                    {t('Ver mais respostas')}
                  </Button>
                )}
                {replying === comment.id && !comment.deleted && (
                  <form
                    className="community-form"
                    onSubmit={(event) => post(event, comment)}
                  >
                    <label htmlFor={`reply-${comment.id}`}>
                      {t('Sua resposta')}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={spoilers[comment.id] !== false}
                        onChange={(event) =>
                          setSpoilers({
                            ...spoilers,
                            [comment.id]: event.target.checked,
                          })
                        }
                      />
                      {t('Proteger possíveis spoilers')}
                    </label>
                    <textarea
                      id={`reply-${comment.id}`}
                      value={drafts[comment.id] || ''}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [comment.id]: event.target.value,
                        }))
                      }
                      maxLength={2000}
                      required
                      rows={3}
                    />
                    <div className="comment-actions">
                      <Button
                        type="submit"
                        disabled={busy || !drafts[comment.id]?.trim()}
                      >
                        {t('Publicar resposta')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setReplying(null)}
                      >
                        {t('Cancelar')}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </>,
        ),
      )}
      {data && !data.comments.length && (
        <p>{t(' Seja a primeira pessoa a comentar. ')}</p>
      )}
      {data?.next && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const more = await request<CommunityData>(
                itemId,
                `community?before=${data.next}`,
              );
              setData((current) => ({
                ...more,
                comments: mergeRows(
                  current?.comments || [],
                  more.comments,
                  true,
                ),
              }));
            })
          }
        >
          {t(' Comentários anteriores ')}
        </Button>
      )}
      <form onSubmit={(event) => post(event)} className="community-form">
        <label>
          <input
            type="checkbox"
            checked={spoilers.root !== false}
            onChange={(event) =>
              setSpoilers({ ...spoilers, root: event.target.checked })
            }
          />
          {t('Proteger possíveis spoilers')}
        </label>
        <label htmlFor={`public-comment-${itemId}`}>
          {t(' Comentário compartilhado ')}
        </label>
        <textarea
          id={`public-comment-${itemId}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={2000}
          required
          rows={3}
          placeholder={t('O que você achou?')}
        />
        <Button
          type="submit"
          className="home-primary"
          disabled={busy || !text.trim()}
        >
          {t(busy ? 'Aguarde…' : 'Publicar comentário')}
        </Button>
      </form>
    </section>
  );
}
