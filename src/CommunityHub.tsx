import { useEffect, useEffectEvent, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { ApiError } from './auth';
import type { LibraryItem } from './library';
import { t } from './i18n';
import './lists.css';
import './social.css';
type Message = {
  id: string;
  text: string;
  spoiler: boolean;
  parentId: string | null;
  author: string;
};
type Topic = {
  id: string;
  title: string;
  type: string;
  scope: string;
  contextName: string;
  audience: string;
  year?: number;
  season?: number;
  episode?: number;
  closed: boolean;
};
type Detail = Topic & {
  posted?: Message;
  text: string;
  mine: boolean;
  ownerName: string;
  myVote: number | null;
  options: { label: string; count: number }[];
  posts: Message[];
  nextAfter: string | null;
};
type Page = { topics: Topic[]; nextBefore: string | null };
const types: Record<string, string> = {
  discussion: 'Discussão',
  theory: 'Teoria',
  'group-vote': 'Escolha em grupo',
  'favorites-vote': 'Votação de favoritos',
  duel: 'Duelo',
  awards: 'Premiação anual',
};
const mergeMessages = (old: Message[], fresh: Message[]) =>
  [...new Map([...old, ...fresh].map((row) => [row.id, row])).values()].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
async function api<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch('/api/community' + path, {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(30000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof data.message === 'string'
        ? data.message
        : t('Não foi possível salvar.'),
    );
  return data;
}
export default function CommunityHub({
  topicId,
  items,
  onSelect,
  onExpired,
}: {
  topicId?: string;
  items: LibraryItem[];
  onSelect: (id?: string) => void;
  onExpired: () => void;
}) {
  const [page, setPage] = useState<Page | null>(null),
    [topic, setTopic] = useState<Detail | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [text, setText] = useState(''),
    [parent, setParent] = useState<string | null>(null),
    [spoiler, setSpoiler] = useState(true),
    [postId, setPostId] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState({
    title: '',
    text: '',
    type: 'discussion',
    scope: 'general',
    contextName: '',
    itemId: '',
    season: 1,
    episode: 1,
    audience: 'community',
    options: '',
    optionType: 'title',
    year: new Date().getFullYear(),
    requestId: crypto.randomUUID(),
  });
  const expired = useEffectEvent(onExpired);
  const [query, setQuery] = useState(''),
    [appliedQuery, setAppliedQuery] = useState('');
  useEffect(() => {
    let active = true;
    void api<Detail | Page>(topicId ? '/' + topicId : '')
      .then((data) => {
        if (active) {
          if (topicId) setTopic(data as Detail);
          else setPage(data as Page);
        }
      })
      .catch((reason) => {
        if (active) {
          if (reason instanceof ApiError && reason.status === 401) expired();
          else setError(reason.message);
        }
      });
    return () => {
      active = false;
    };
  }, [topicId]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
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
            : t('Não foi possível salvar.'),
        );
    } finally {
      setBusy(false);
    }
  }
  function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const voting = !['discussion', 'theory'].includes(draft.type);
      const body = {
        title: draft.title,
        text: draft.text,
        type: draft.type,
        scope: draft.scope,
        contextName: draft.contextName,
        audience: draft.audience,
        optionType: draft.optionType,
        options: voting
          ? draft.options
              .split('\n')
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
        requestId: draft.requestId,
        ...(['work', 'episode'].includes(draft.scope)
          ? { itemId: draft.itemId }
          : {}),
        ...(draft.scope === 'episode'
          ? { season: draft.season, episode: draft.episode }
          : {}),
        ...(draft.type === 'awards' ? { year: draft.year } : {}),
      };
      const saved = await api<Detail>('', 'POST', body);
      onSelect(saved.id);
    });
  }
  return (
    <section className="social-page">
      <header className="social-toolbar">
        <h1>{t('Comunidade')}</h1>
        {topicId ? (
          <Button variant="outline" onClick={() => onSelect()}>
            {t('Voltar')}
          </Button>
        ) : (
          <Button
            onClick={() => {
              if (!creating)
                setDraft({ ...draft, requestId: crypto.randomUUID() });
              setCreating((value) => !value);
            }}
          >
            {t('Criar conversa ou votação')}
          </Button>
        )}
      </header>
      {error && (
        <p role="alert" className="home-error">
          {error}
        </p>
      )}
      {creating && !topicId && (
        <form className="list-editor" onSubmit={create}>
          <p>
            {t(
              'Publique apenas o que deseja compartilhar. Seu nome será mostrado; notas e anotações da biblioteca continuam privadas.',
            )}
          </p>
          <label>
            {t('Tipo')}
            <NativeSelect
              value={draft.type}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  type: event.target.value,
                  audience:
                    event.target.value === 'group-vote'
                      ? 'friends'
                      : draft.audience,
                })
              }
            >
              {Object.entries(types).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label>
            {t('Título')}
            <Input
              required
              maxLength={160}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </label>
          <label>
            {t('Descrição')}
            <textarea
              maxLength={2000}
              value={draft.text}
              onChange={(event) =>
                setDraft({ ...draft, text: event.target.value })
              }
            />
          </label>
          <label>
            {t('Contexto')}
            <NativeSelect
              value={draft.scope}
              onChange={(event) =>
                setDraft({ ...draft, scope: event.target.value })
              }
            >
              {[
                ['general', 'Geral'],
                ['work', 'Obra'],
                ['episode', 'Episódio'],
                ['franchise', 'Franquia'],
                ['universe', 'Universo'],
              ].map(([key, label]) => (
                <option value={key} key={key}>
                  {t(label)}
                </option>
              ))}
            </NativeSelect>
          </label>
          {['work', 'episode'].includes(draft.scope) && (
            <label>
              {t('Título da biblioteca')}
              <NativeSelect
                required
                value={draft.itemId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    itemId: event.target.value,
                    contextName:
                      items.find((item) => item.id === event.target.value)
                        ?.title || '',
                  })
                }
              >
                <option value="">{t('Selecione um título')}</option>
                {items
                  .filter(
                    (item) =>
                      draft.scope !== 'episode' || item.kind === 'series',
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </NativeSelect>
            </label>
          )}
          {['franchise', 'universe'].includes(draft.scope) && (
            <label>
              {t('Nome do contexto')}
              <Input
                required
                maxLength={160}
                value={draft.contextName}
                onChange={(event) =>
                  setDraft({ ...draft, contextName: event.target.value })
                }
              />
            </label>
          )}
          {draft.scope === 'episode' && (
            <div className="list-actions">
              <label>
                {t('Temporada')}
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  value={draft.season}
                  onChange={(event) =>
                    setDraft({ ...draft, season: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                {t('Episódio')}
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  value={draft.episode}
                  onChange={(event) =>
                    setDraft({ ...draft, episode: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          )}
          <label>
            {t('Quem pode ver')}
            <NativeSelect
              disabled={draft.type === 'group-vote'}
              value={draft.audience}
              onChange={(event) =>
                setDraft({ ...draft, audience: event.target.value })
              }
            >
              <option value="community">{t('Usuários do app')}</option>
              <option value="friends">{t('Meus amigos')}</option>
            </NativeSelect>
          </label>
          {!['discussion', 'theory'].includes(draft.type) && (
            <>
              <label>
                {t('Categoria das opções')}
                <NativeSelect
                  value={draft.optionType}
                  onChange={(event) =>
                    setDraft({ ...draft, optionType: event.target.value })
                  }
                >
                  {[
                    ['title', 'Obra'],
                    ['actor', 'Ator'],
                    ['director', 'Diretor'],
                    ['character', 'Personagem'],
                    ['franchise', 'Franquia'],
                    ['episode', 'Episódio'],
                    ['game', 'Jogo'],
                    ['book', 'Livro'],
                  ].map(([key, label]) => (
                    <option key={key} value={key}>
                      {t(label)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label>
                {t('Opções, uma por linha')}
                <textarea
                  required
                  rows={5}
                  maxLength={2019}
                  value={draft.options}
                  onChange={(event) =>
                    setDraft({ ...draft, options: event.target.value })
                  }
                />
              </label>
              <p>
                {t(
                  'Duelo usa duas opções; outras votações usam de duas a vinte.',
                )}
              </p>
            </>
          )}
          {draft.type === 'awards' && (
            <label>
              {t('Ano')}
              <Input
                type="number"
                min={1900}
                max={2200}
                value={draft.year}
                onChange={(event) =>
                  setDraft({ ...draft, year: Number(event.target.value) })
                }
              />
              <small>
                {t(
                  'Premiação organizada por você, sem representar prêmio oficial do app.',
                )}
              </small>
            </label>
          )}
          <Button type="submit" disabled={busy}>
            {t('Publicar')}
          </Button>
        </form>
      )}
      {!topicId && (
        <>
          <form
            className="list-invite"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                setPage(await api<Page>('?q=' + encodeURIComponent(query)));
                setAppliedQuery(query);
              });
            }}
          >
            <Input
              aria-label={t('Buscar conversa ou contexto')}
              maxLength={160}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button disabled={busy} type="submit">
              {t('Buscar')}
            </Button>
          </form>
          {!page && !error && <p>{t('Carregando…')}</p>}
          {page?.topics.length === 0 && (
            <p>
              {t(
                'Nenhuma conversa encontrada. Crie uma discussão, teoria ou votação.',
              )}
            </p>
          )}
          <div className="list-collection">
            {page?.topics.map((row) => (
              <button
                className="list-summary"
                key={row.id}
                onClick={() => onSelect(row.id)}
              >
                <strong>{row.title}</strong>
                <small>
                  {t(types[row.type])} · {row.contextName}
                  {row.season !== undefined
                    ? ` S${row.season}E${row.episode}`
                    : ''}
                  {row.year ? ' · ' + row.year : ''} ·{' '}
                  {t(
                    row.audience === 'friends'
                      ? 'Meus amigos'
                      : 'Usuários do app',
                  )}
                </small>
              </button>
            ))}
          </div>
          {page?.nextBefore && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await api<Page>(
                    '?before=' +
                      page.nextBefore +
                      '&q=' +
                      encodeURIComponent(appliedQuery),
                  );
                  setPage({
                    ...next,
                    topics: [...page.topics, ...next.topics],
                  });
                })
              }
            >
              {t('Ver mais')}
            </Button>
          )}
        </>
      )}
      {topic && topicId && (
        <>
          <h2>{topic.title}</h2>
          <p>
            {topic.ownerName} · {t(types[topic.type])} · {topic.contextName}
            {topic.season !== undefined
              ? ` S${topic.season}E${topic.episode}`
              : ''}
          </p>
          <details>
            <summary>
              {t('Conteúdo protegido: revelar possíveis spoilers')}
            </summary>
            <p className="social-bio">{topic.text}</p>
          </details>
          {topic.options.length > 0 && (
            <fieldset className="list-editor">
              <legend>{t('Votação')}</legend>
              {topic.options.map((option, index) => (
                <Button
                  key={index}
                  variant={topic.myVote === index ? 'default' : 'outline'}
                  disabled={busy || topic.closed}
                  aria-pressed={topic.myVote === index}
                  onClick={() =>
                    void run(async () =>
                      setTopic(
                        await api('/' + topic.id + '/vote', 'PATCH', {
                          option: index,
                        }),
                      ),
                    )
                  }
                >
                  {option.label} · {option.count}
                </Button>
              ))}
            </fieldset>
          )}
          {topic.mine && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  setTopic(
                    await api('/' + topic.id + '/closed', 'PATCH', {
                      closed: !topic.closed,
                    }),
                  ),
                )
              }
            >
              {t(topic.closed ? 'Reabrir conversa' : 'Encerrar conversa')}
            </Button>
          )}
          <div className="social-feed">
            {topic.posts.map((post) => (
              <article key={post.id} className="social-settings">
                <strong>{post.author}</strong>
                {post.parentId && <small> · {t('Resposta')}</small>}
                {post.spoiler ? (
                  <details>
                    <summary>
                      {t('Conteúdo protegido: revelar possíveis spoilers')}
                    </summary>
                    <p className="social-bio">{post.text}</p>
                  </details>
                ) : (
                  <p className="social-bio">{post.text}</p>
                )}
                {!post.parentId && !topic.closed && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setParent(post.id);
                      setPostId(crypto.randomUUID());
                    }}
                  >
                    {t('Responder')}
                  </Button>
                )}
              </article>
            ))}
          </div>
          {topic.nextAfter && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await api<Detail>(
                    '/' + topic.id + '?after=' + topic.nextAfter,
                  );
                  setTopic({
                    ...next,
                    posts: mergeMessages(topic.posts, next.posts),
                  });
                })
              }
            >
              {t('Ver mais mensagens')}
            </Button>
          )}
          {!topic.closed && (
            <form
              className="list-editor"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const saved = await api<Detail>(
                    '/' + topic.id + '/posts',
                    'POST',
                    {
                      text,
                      spoiler,
                      requestId: postId,
                      ...(parent ? { parentId: parent } : {}),
                    },
                  );
                  setTopic({
                    ...saved,
                    posts: mergeMessages(topic.posts, [
                      ...saved.posts,
                      ...(saved.posted ? [saved.posted] : []),
                    ]),
                  });
                  setText('');
                  setPostId(crypto.randomUUID());
                  setParent(null);
                });
              }}
            >
              {parent && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setParent(null)}
                >
                  {t('Cancelar resposta')}
                </Button>
              )}
              <label>
                {t('Mensagem')}
                <textarea
                  required
                  maxLength={2000}
                  rows={4}
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    setPostId(crypto.randomUUID());
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={spoiler}
                  onChange={(event) => {
                    setSpoiler(event.target.checked);
                    setPostId(crypto.randomUUID());
                  }}
                />
                {t('Proteger possíveis spoilers')}
              </label>
              <Button disabled={busy} type="submit">
                {t('Publicar')}
              </Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
