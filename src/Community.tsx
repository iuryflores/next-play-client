import PageLoading from './PageLoading';
import { notifySaved } from './notifications';
import { dateLabel } from './i18n';
import { t } from './i18n';
import { useEffect, useEffectEvent, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from './auth';
type Comment = {
  id: string;
  text: string;
  author: string;
  mine: boolean;
  createdAt: string;
};
type CommunityData = {
  comments: Comment[];
  next: string | null;
};
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
  const announce = () => {
    if (method !== 'GET')
      notifySaved(
        t(
          method === 'DELETE'
            ? 'Comentário removido.'
            : 'Comentário publicado.',
        ),
      );
  };
  if (response.status === 204) {
    announce();
    return undefined as T;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new ApiError(
      response.status,
      typeof data?.message === 'string'
        ? data.message
        : t('Não foi possível carregar a conversa.'),
    );
  announce();
  return data as T;
}
export default function Community({
  itemId,
  onExpired,
}: {
  itemId: string;
  onExpired: () => void;
}) {
  const [data, setData] = useState<CommunityData | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState('');
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    let active = true;
    void request<CommunityData>(itemId, 'community')
      .then((result) => {
        if (active) {
          setData(result);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else
          setError(t('Não foi possível carregar a conversa. Tente novamente.'));
      });
    return () => {
      active = false;
    };
  }, [itemId, revision]);
  async function action(run: () => Promise<void>) {
    if (busy) return;
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
      setBusy(false);
    }
  }
  function post(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    void action(async () => {
      await request(itemId, 'comments', 'POST', { text: text.trim() });
      setText('');
      setRevision((value) => value + 1);
    });
  }
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
      {data?.comments.map((comment) => (
        <article className="title-comment" key={comment.id}>
          <header>
            <strong>
              {comment.mine
                ? t('Você')
                : comment.author.replace(/^Pessoa /, t('Pessoa') + ' ')}
            </strong>
            <time dateTime={comment.createdAt}>
              {dateLabel(comment.createdAt)}
            </time>
          </header>
          <p>{comment.text}</p>
          {comment.mine && (
            <Button
              type="button"
              variant="link"
              disabled={busy}
              onClick={() => {
                if (confirmDelete !== comment.id) {
                  setConfirmDelete(comment.id);
                  return;
                }
                void action(async () => {
                  await request(
                    itemId,
                    `comments/${encodeURIComponent(comment.id)}`,
                    'DELETE',
                  );
                  setConfirmDelete('');
                  setRevision((value) => value + 1);
                });
              }}
            >
              {confirmDelete === comment.id
                ? t('Confirmar exclusão')
                : t('Excluir comentário')}
            </Button>
          )}
        </article>
      ))}
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
                `community?before=${encodeURIComponent(data.next!)}`,
              );
              setData((current) =>
                current
                  ? {
                      ...more,
                      comments: [...current.comments, ...more.comments],
                    }
                  : more,
              );
            })
          }
        >
          {t(' Comentários anteriores ')}
        </Button>
      )}
      <form onSubmit={post} className="community-form">
        <label htmlFor="public-comment">
          {t(' Comentário compartilhado ')}
        </label>
        <textarea
          id="public-comment"
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
          {busy ? t('Aguarde…') : t('Publicar comentário')}
        </Button>
      </form>
    </section>
  );
}
