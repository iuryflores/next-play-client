import { useEffect, useEffectEvent, useState, type SubmitEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ListVideo,
  Plus,
  Share2,
  Trash2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ApiError } from './auth';
import { categories, type LibraryItem } from './library';
import { t } from './i18n';
import { notifySaved } from './notifications';
import PageLoading from './PageLoading';
import './social.css';
import './lists.css';

type Entry = {
  entryId?: string;
  sourceId?: string;
  key: string;
  title: string;
  kind: LibraryItem['kind'];
  coverUrl: string;
  year: string;
};
type List = {
  id: string;
  mine: boolean;
  canEdit: boolean;
  role: 'owner' | 'editor' | 'invited' | 'viewer';
  friends?: { id: string; name: string }[];
  collaborators?: {
    id: string;
    name: string;
    status: 'pending' | 'accepted';
  }[];
  name: string;
  description: string;
  visibility: 'private' | 'friends';
  revision: number;
  ownerName: string;
  count: number;
  entries: Entry[];
};
type Summary = Omit<List, 'entries'> & { covers: string[] };
type Page = { lists: Summary[]; nextBefore: string | null };
type Draft = {
  name: string;
  description: string;
  visibility: List['visibility'];
  entries: Entry[];
  requestId: string;
};
async function request<T>(
  path: string,
  method = 'GET',
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch('/api/lists' + path, {
    method,
    credentials: 'same-origin',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new ApiError(
      response.status,
      typeof data?.message === 'string'
        ? data.message
        : t('Não foi possível salvar.'),
    );
  return data;
}
export default function Lists({
  listId,
  items,
  onSelect,
  onExpired,
}: {
  listId?: string;
  items: LibraryItem[];
  onSelect: (id?: string) => void;
  onExpired: () => void;
}) {
  const [scope, setScope] = useState<'mine' | 'friends' | 'collaborations'>(
    'mine',
  );
  const [inviteId, setInviteId] = useState('');
  const [page, setPage] = useState<Page | null>(null);
  const [list, setList] = useState<List | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const controller = new AbortController();
    void request<List | Page>(
      listId ? '/' + listId : '?scope=' + scope,
      'GET',
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (listId) setList(result as List);
        else setPage(result as Page);
        setError('');
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else
          setError(
            reason instanceof Error
              ? reason.message
              : t('Não foi possível carregar.'),
          );
      });
    return () => controller.abort();
  }, [listId, scope, refresh]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setConflict(false);
    try {
      await action();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409)
        setConflict(true);
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
  function edit(value: List | null) {
    setDraft({
      name: value?.name || '',
      description: value?.description || '',
      visibility: value?.visibility || 'private',
      entries: value?.entries || [],
      requestId: crypto.randomUUID(),
    });
    setSearch('');
    setKind('all');
    setError('');
  }
  function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    void run(async () => {
      const fields = {
        name: draft.name,
        description: draft.description,
        visibility: draft.visibility,
        // Entradas compartilhadas usam seu ID público; cada novo título vem da biblioteca do editor.
        itemIds: draft.entries.map((entry) => entry.entryId || entry.sourceId),
      };
      // A chave permanece no rascunho após timeout; reenviar não cria outra lista.
      const saved = await request<List>(
        list ? '/' + list.id : '',
        list ? 'PATCH' : 'POST',
        {
          ...fields,
          ...(list
            ? { revision: list.revision }
            : { requestId: draft.requestId }),
        },
      );
      setDraft(null);
      setList(saved);
      onSelect(saved.id);
      setRefresh((value) => value + 1);
      notifySaved(t('Lista salva.'));
    });
  }
  function move(index: number, offset: number) {
    if (!draft) return;
    const entries = [...draft.entries];
    [entries[index], entries[index + offset]] = [
      entries[index + offset],
      entries[index],
    ];
    setDraft({ ...draft, entries });
  }
  function collaborate(
    action: 'invite' | 'remove' | 'accept' | 'decline' | 'leave',
    userId?: string,
  ) {
    if (!list) return;
    void run(async () => {
      const updated = await request<List>(
        '/' + list.id + '/collaboration',
        'PATCH',
        { action, revision: list.revision, ...(userId ? { userId } : {}) },
      );
      setList(updated);
      setInviteId('');
      notifySaved(t('Colaboração atualizada.'));
    });
  }
  const candidates = items
    .filter(
      (item) =>
        !draft?.entries.some((entry) => entry.sourceId === item.id) &&
        (kind === 'all' || item.kind === kind) &&
        item.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
  return (
    <section className="social-page">
      <header className="social-toolbar">
        <h1>{t('Listas')}</h1>
        <div>
          {listId && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onSelect()}
            >
              <ArrowLeft aria-hidden="true" />
              {t('Voltar')}
            </Button>
          )}
          {!listId && (
            <Button disabled={busy || !!draft} onClick={() => edit(null)}>
              <Plus aria-hidden="true" />
              {t('Criar lista')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={busy || !!draft}
            aria-label={t('Atualizar dados')}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
      </header>
      {error && (
        <p className="home-error" role="alert">
          {error}
        </p>
      )}
      {conflict && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setDraft(null);
            setError('');
            setConflict(false);
            setRefresh((value) => value + 1);
          }}
        >
          {t('Descartar rascunho e atualizar lista')}
        </Button>
      )}
      {draft ? (
        <form className="list-editor" onSubmit={save}>
          <h2>{t(list ? 'Editar lista' : 'Criar lista')}</h2>
          <label>
            {t('Nome da lista')}
            <Input
              required
              maxLength={100}
              value={draft.name}
              disabled={busy}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
          <label>
            {t('Descrição')}
            <textarea
              maxLength={1000}
              rows={3}
              value={draft.description}
              disabled={busy}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          {(!list || list.mine) && (
            <label>
              {t('Quem pode ver')}
              <NativeSelect
                disabled={busy}
                value={draft.visibility}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    visibility: event.target.value as Draft['visibility'],
                  })
                }
              >
                <option value="private">{t('Somente eu')}</option>
                <option value="friends">{t('Meus amigos')}</option>
              </NativeSelect>
            </label>
          )}
          <p className="social-help">
            {t(
              'O link exige login e amizade aceita. A lista compartilha apenas os títulos escolhidos, sem notas ou progresso. Remover da biblioteca não remove da lista.',
            )}
          </p>
          <fieldset className="list-picker" disabled={busy}>
            <legend>{t('Adicionar títulos da biblioteca')}</legend>
            <Input
              aria-label={t('Buscar na biblioteca')}
              placeholder={t('Buscar na biblioteca')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <NativeSelect
              aria-label={t('Tipo de título')}
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">{t('Todos')}</option>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label={t('Adicionar título à lista')}
              disabled={draft.entries.length >= 100}
              value=""
              onChange={(event) => {
                const item = items.find(
                  (item) => item.id === event.target.value,
                );
                if (item)
                  setDraft({
                    ...draft,
                    entries: [
                      ...draft.entries,
                      {
                        sourceId: item.id,
                        key: item.id,
                        title: item.title,
                        kind: item.kind,
                        coverUrl: item.coverUrl || '',
                        year: item.year || '',
                      },
                    ],
                  });
              }}
            >
              <option value="">{t('Selecione um título')}</option>
              {candidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {categories[item.kind]}
                </option>
              ))}
            </NativeSelect>
          </fieldset>
          <p>{t('{0} de 100 títulos', draft.entries.length)}</p>
          <ol className="list-order">
            {draft.entries.map((entry, index) => (
              <li key={entry.entryId || entry.sourceId}>
                <span>
                  <strong>{entry.title}</strong>
                  <small>
                    {categories[entry.kind]} {entry.year}
                  </small>
                </span>
                <div className="list-order-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy || index === 0}
                    aria-label={t('Subir {0}', entry.title)}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy || index === draft.entries.length - 1}
                    aria-label={t('Descer {0}', entry.title)}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={t('Remover {0} da lista', entry.title)}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        entries: draft.entries.filter(
                          (_, pos) => pos !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <div className="list-actions">
            <Button type="submit" disabled={busy || !draft.name.trim()}>
              {t(busy ? 'Salvando…' : 'Salvar lista')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              {t('Cancelar')}
            </Button>
          </div>
        </form>
      ) : listId ? (
        list && !error ? (
          <>
            <header className="list-heading">
              <div>
                <h2>{list.name}</h2>
                <p>
                  {list.ownerName} ·{' '}
                  {t(
                    list.visibility === 'friends'
                      ? 'Meus amigos'
                      : 'Somente eu',
                  )}
                </p>
              </div>
              <div className="list-actions">
                {list.canEdit && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => edit(list)}
                  >
                    <Pencil aria-hidden="true" />
                    {t('Editar lista')}
                  </Button>
                )}
                {list.mine && (
                  <>
                    <Button
                      variant="ghost"
                      aria-label={t('Excluir lista')}
                      onClick={() => setDeleting(true)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  disabled={busy || list.visibility !== 'friends'}
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(
                        window.location.origin + '/listas?lista=' + list.id,
                      );
                      notifySaved(t('Link da lista copiado.'));
                    })
                  }
                >
                  <Share2 aria-hidden="true" />
                  {t('Copiar link da lista')}
                </Button>
              </div>
            </header>
            {list.role === 'invited' && (
              <section className="list-collaboration">
                <h2>{t('Convite para colaborar')}</h2>
                <p>
                  {t(
                    'O dono convidou você para editar esta lista. Aceite para adicionar, remover e organizar títulos.',
                  )}
                </p>
                <div className="list-actions">
                  <Button disabled={busy} onClick={() => collaborate('accept')}>
                    {t('Aceitar convite')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => collaborate('decline')}
                  >
                    {t('Recusar convite')}
                  </Button>
                </div>
              </section>
            )}
            {list.role === 'editor' && (
              <section className="list-collaboration">
                <p>
                  {t(
                    'Você é colaborador desta lista. Só o dono gerencia participantes, privacidade e exclusão.',
                  )}
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => collaborate('leave')}
                >
                  {t('Deixar de colaborar')}
                </Button>
              </section>
            )}
            {list.mine && (
              <section className="list-collaboration">
                <h2>{t('Colaboradores')}</h2>
                <p className="social-help">
                  {t(
                    'Convide até 20 amigos aceitos. Eles precisam aceitar para editar. Tornar a lista privada encerra os convites e as colaborações.',
                  )}
                </p>
                {list.visibility !== 'friends' ? (
                  <p>
                    {t(
                      'Edite a lista e escolha Meus amigos para permitir colaboração.',
                    )}
                  </p>
                ) : (
                  <>
                    <div className="list-invite">
                      <NativeSelect
                        aria-label={t('Amigo para colaborar')}
                        value={inviteId}
                        disabled={
                          busy || (list.collaborators?.length || 0) >= 20
                        }
                        onChange={(event) => setInviteId(event.target.value)}
                      >
                        <option value="">{t('Selecione um amigo')}</option>
                        {list.friends
                          ?.filter(
                            (friend) =>
                              !list.collaborators?.some(
                                (member) => member.id === friend.id,
                              ),
                          )
                          .map((friend) => (
                            <option key={friend.id} value={friend.id}>
                              {friend.name}
                            </option>
                          ))}
                      </NativeSelect>
                      <Button
                        disabled={busy || !inviteId}
                        onClick={() => collaborate('invite', inviteId)}
                      >
                        {t('Convidar para colaborar')}
                      </Button>
                    </div>
                    <ul className="list-members">
                      {list.collaborators?.map((member) => (
                        <li key={member.id}>
                          <span>
                            <strong>{member.name}</strong>
                            <small>
                              {t(
                                member.status === 'pending'
                                  ? 'Convite pendente'
                                  : 'Colaborador',
                              )}
                            </small>
                          </span>
                          <Button
                            variant="outline"
                            disabled={busy}
                            aria-label={t(
                              'Remover colaboração de {0}',
                              member.name,
                            )}
                            onClick={() => collaborate('remove', member.id)}
                          >
                            {t(
                              member.status === 'pending'
                                ? 'Cancelar convite'
                                : 'Remover colaborador',
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
            {list.description && (
              <p className="list-description">{list.description}</p>
            )}
            <p className="social-help">{t('{0} títulos', list.count)}</p>
            {!list.count && <p>{t('Esta lista ainda não tem títulos.')}</p>}
            <ol className="social-titles list-posters">
              {list.entries.map((entry, index) => (
                <li key={entry.key} className="social-title">
                  <div className="social-cover">
                    {entry.coverUrl ? (
                      <img
                        src={entry.coverUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ListVideo aria-hidden="true" />
                    )}
                  </div>
                  <strong>
                    {index + 1}. {entry.title}
                  </strong>
                  <small>
                    {categories[entry.kind]} {entry.year}
                  </small>
                </li>
              ))}
            </ol>
          </>
        ) : (
          !error && <PageLoading label={t('Carregando…')} />
        )
      ) : (
        <>
          <fieldset
            className="list-actions list-scopes"
            aria-label={t('Listas')}
          >
            <Button
              variant={scope === 'mine' ? 'default' : 'outline'}
              aria-pressed={scope === 'mine'}
              disabled={busy}
              onClick={() => {
                if (scope !== 'mine') {
                  setPage(null);
                  setScope('mine');
                }
              }}
            >
              {t('Minhas listas')}
            </Button>
            <Button
              variant={scope === 'friends' ? 'default' : 'outline'}
              aria-pressed={scope === 'friends'}
              disabled={busy}
              onClick={() => {
                if (scope !== 'friends') {
                  setPage(null);
                  setScope('friends');
                }
              }}
            >
              {t('Listas dos amigos')}
            </Button>
            <Button
              variant={scope === 'collaborations' ? 'default' : 'outline'}
              aria-pressed={scope === 'collaborations'}
              disabled={busy}
              onClick={() => {
                if (scope !== 'collaborations') {
                  setPage(null);
                  setScope('collaborations');
                }
              }}
            >
              {t('Colaborações e convites')}
            </Button>
          </fieldset>
          {!page && !error && <PageLoading label={t('Carregando…')} />}
          {page && !page.lists.length && (
            <div className="social-empty">
              <ListVideo aria-hidden="true" />
              <p>
                {t(
                  scope === 'collaborations'
                    ? 'Você ainda não tem convites ou listas em colaboração.'
                    : scope === 'mine'
                      ? 'Crie sua primeira lista e compartilhe com amigos.'
                      : 'Seus amigos ainda não compartilharam listas.',
                )}
              </p>
            </div>
          )}
          <div className="list-collection">
            {page?.lists.map((row) => (
              <button
                type="button"
                className="list-summary"
                key={row.id}
                onClick={() => onSelect(row.id)}
              >
                <div className="list-preview">
                  {row.covers.map((cover, index) =>
                    cover ? (
                      <img
                        key={index}
                        src={cover}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ListVideo key={index} aria-hidden="true" />
                    ),
                  )}
                </div>
                <strong>{row.name}</strong>
                {(row.role === 'editor' || row.role === 'invited') && (
                  <small className="list-role">
                    {t(
                      row.role === 'invited'
                        ? 'Convite para colaborar'
                        : 'Colaborador',
                    )}
                  </small>
                )}
                <small>
                  {row.ownerName} · {t('{0} títulos', row.count)}
                </small>
                <small>
                  {t(
                    row.visibility === 'friends' ? 'Meus amigos' : 'Somente eu',
                  )}
                </small>
              </button>
            ))}
          </div>
          {page?.nextBefore && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await request<Page>(
                    '?scope=' + scope + '&before=' + page.nextBefore,
                  );
                  setPage((current) => ({
                    ...next,
                    lists: [...current!.lists, ...next.lists],
                  }));
                })
              }
            >
              {t('Ver mais listas')}
            </Button>
          )}
        </>
      )}
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogTitle>{t('Excluir lista')}</DialogTitle>
          <DialogDescription>
            {t(
              'A lista e seu link serão removidos. Os títulos continuam na sua biblioteca.',
            )}
          </DialogDescription>
          <div className="list-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              {t('Cancelar')}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request('/' + list!.id, 'DELETE', {
                    revision: list!.revision,
                  });
                  setDeleting(false);
                  onSelect();
                  notifySaved(t('Lista excluída.'));
                })
              }
            >
              {t('Excluir lista')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
