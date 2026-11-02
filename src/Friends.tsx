import { RefreshCw } from 'lucide-react';
import PageLoading from './PageLoading';
import { notifySaved } from './notifications';
import RankMovement from './RankMovement';
import { useEffect, useEffectEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserRoundMinus, X } from 'lucide-react';
import IconAction from './IconAction';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ApiError } from './auth';
import { t, language } from './i18n';
import { AchievementIcon } from './AchievementProvider';
import AchievementStars from './AchievementStars';
type Connection = {
  id: string;
  name: string;
  status: string;
  incoming: boolean;
};
type FriendsData = {
  code: string;
  name: string;
  connections: Connection[];
  ranking: {
    id: string;
    name: string;
    me: boolean;
    avatar: string;
    connection: { id: string; status: string; incoming: boolean } | null;
    minutes: number;
    episodes: number;
    books: number;
    games: number;
    xp: number;
    level: number;
    incomplete: boolean;
    rank: number;
    movement?: number | null;
    achievement: {
      family: string;
      title: string;
      level: number;
      levels: number;
      progressionLevel: number;
      cycleStars: number;
      progressionMode: 'single' | 'finite' | 'continuous';
    } | null;
  }[];
};
async function request<T>(
  path = '',
  method = 'GET',
  body?: object,
  visitId?: string,
): Promise<T> {
  const response = await fetch('/api/friends' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(visitId ? { 'X-Ranking-Visit': visitId } : {}),
    },
    ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 204) {
    window.dispatchEvent(new Event('nextplay:notifications-changed'));
    if (method !== 'GET') notifySaved(t('Alterações salvas.'));
    return undefined as T;
  }
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof data.message === 'string'
        ? data.message
        : t('Confira os dados informados.'),
    );
  if (method !== 'GET') notifySaved(t('Alterações salvas.'));
  return data;
}
export default function Friends({
  onExpired,
  onNameChanged,
}: {
  onExpired: () => void;
  onNameChanged: (name: string) => void;
}) {
  const [data, setData] = useState<FriendsData | null>(null);
  const [scope, setScope] = useState<'friends' | 'all'>('friends');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [visitId] = useState(() => crypto.randomUUID());
  const [remove, setRemove] = useState<Connection | null>(null);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const progression = (event: Event) => {
      const value = (event as CustomEvent<{ totalXp: number; level: number }>)
        .detail;
      // A primeira sincronização pode terminar depois da leitura do ranking.
      refresh();
      setData((current) =>
        current
          ? {
              ...current,
              ranking: current.ranking.map((row) =>
                row.me
                  ? { ...row, xp: value.totalXp, level: value.level }
                  : row,
              ),
            }
          : current,
      );
    };
    window.addEventListener('nextplay:friends-changed', refresh);
    window.addEventListener('nextplay:progression-synced', progression);
    return () => {
      window.removeEventListener('nextplay:friends-changed', refresh);
      window.removeEventListener('nextplay:progression-synced', progression);
    };
  }, []);
  useEffect(() => {
    let active = true;
    void request<FriendsData>(`?scope=${scope}`, 'GET', undefined, visitId)
      .then((result) => {
        if (active) {
          setData(result);
          setError('');
        }
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) expired();
        else setError(t('Não foi possível carregar seus amigos.'));
      });
    return () => {
      active = false;
    };
  }, [revision, visitId, scope]);
  async function action(path: string, method: string, body?: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(path, method, body);
      const refreshed = await request<FriendsData>(
        `?scope=${scope}`,
        'GET',
        undefined,
        visitId,
      );
      setData(refreshed);
      onNameChanged(refreshed.name);
      if (path === '/requests') {
        setCode('');
        setInviteOpen(false);
      }
      setRemove(null);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          reason instanceof ApiError
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="friends-page">
      <header className="collection-toolbar">
        <h1>{t('Amigos')}</h1>
        <Button
          onClick={() => {
            setError('');
            setInviteOpen(true);
          }}
          disabled={!data || busy}
        >
          {t('Convidar amigo')}
        </Button>
        <IconAction
          variant="outline"
          disabled={busy}
          onClick={() => setRevision((value) => value + 1)}
          label={t('Atualizar dados')}
          icon={RefreshCw}
        />
      </header>
      <output className="home-error" aria-live="polite">
        {error}
      </output>
      {!data && !error && <PageLoading label={t('Carregando amigos…')} />}
      {data && (
        <>
          <section className="friends-ranking">
            <div
              className="friends-scopes"
              role="group"
              aria-label={t('Usuários no ranking')}
            >
              {(['friends', 'all'] as const).map((option) => (
                <Button
                  key={option}
                  variant={scope === option ? 'default' : 'outline'}
                  aria-pressed={scope === option}
                  onClick={() => {
                    // Limpa a tabela ao trocar o escopo para não rotular o ranking anterior como global.
                    setData(null);
                    setError('');
                    setScope(option);
                  }}
                  disabled={scope === option || busy}
                >
                  {t(
                    option === 'friends' ? 'Meus amigos' : 'Todos os usuários',
                  )}
                </Button>
              ))}
            </div>
            <h2>
              {t(scope === 'friends' ? 'Ranking de amigos' : 'Ranking geral')}
            </h2>
            <p>
              {t(
                'Tempo total em séries: soma dos episódios assistidos, uma vez por episódio. Filmes e jogos ainda não entram no tempo. Empates recebem a mesma posição.',
              )}
            </p>
            <p className="friends-ranking-note">
              {t(
                'Livros lidos e jogos concluídos contam títulos distintos, incluindo arquivados. O XP mostra o total já reconhecido no perfil; a posição continua pelo tempo em séries.',
              )}
            </p>
            <div className="friends-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">
                      {t(scope === 'friends' ? 'Amigo' : 'Usuário')}
                    </th>
                    <th scope="col">{t('Tempo em séries')}</th>
                    <th scope="col">{t('Episódios assistidos')}</th>
                    <th scope="col">{t('Livros lidos')}</th>
                    <th scope="col">{t('Jogos concluídos')}</th>
                    <th scope="col">XP</th>
                    <th scope="col">{t('Amizade')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranking.map((row) => (
                    <tr key={row.id} className={row.me ? 'ranking-me' : ''}>
                      <td>
                        {row.rank}{' '}
                        <RankMovement
                          changes={
                            row.movement === undefined
                              ? undefined
                              : { friends: { [row.id]: row.movement } }
                          }
                          ranking="friends"
                          id={row.id}
                        />
                      </td>
                      <th scope="row">
                        <span className="friend-avatar" aria-hidden="true">
                          {row.name.charAt(0).toUpperCase()}
                          {row.avatar && (
                            <img
                              src={row.avatar}
                              alt=""
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                        </span>
                        {row.name}
                        {row.me ? ` · ${t('Você')}` : ''}
                        {row.achievement && (
                          <div className="friend-achievement">
                            <span>
                              <AchievementIcon
                                family={row.achievement.family}
                              />{' '}
                              {t(row.achievement.title)}
                            </span>
                            <AchievementStars
                              level={row.achievement.level}
                              total={row.achievement.levels}
                              progressionLevel={
                                row.achievement.progressionLevel
                              }
                              cycleStars={row.achievement.cycleStars}
                              progressionMode={row.achievement.progressionMode}
                            />
                          </div>
                        )}
                        {row.incomplete && (
                          <small>
                            {t(
                              'Tempo parcial: há episódios sem duração ou dados pendentes.',
                            )}
                          </small>
                        )}
                      </th>
                      <td>
                        {Math.floor(row.minutes / 60).toLocaleString(language)}h{' '}
                        {row.minutes % 60}min
                      </td>
                      <td>{row.episodes.toLocaleString(language)}</td>
                      <td className="ranking-number">
                        {row.books.toLocaleString(language)}
                      </td>
                      <td className="ranking-number">
                        {row.games.toLocaleString(language)}
                      </td>
                      <td className="ranking-xp">
                        <strong>{row.xp.toLocaleString(language)}</strong>
                        <small>{t('Nível {0}', row.level)}</small>
                      </td>
                      <td>
                        {!row.me &&
                          (row.connection?.status === 'accepted' ? (
                            <small>{t('Amizade confirmada')}</small>
                          ) : row.connection?.incoming ? (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                void action(
                                  `/${row.connection!.id}/accept`,
                                  'POST',
                                )
                              }
                            >
                              {t('Aceitar')}
                            </Button>
                          ) : row.connection ? (
                            <small>{t('Pedido enviado')}</small>
                          ) : (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void action('/requests', 'POST', {
                                  code: row.id,
                                })
                              }
                            >
                              {t('Adicionar amigo')}
                            </Button>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="friends-connections">
            <h2>{t('Amizades e pedidos')}</h2>
            {!data.connections.length && (
              <p>
                {t(
                  'Adicione seu primeiro amigo para comparar o tempo assistido.',
                )}
              </p>
            )}
            {data.connections.map((link) => (
              <div className="friend-connection" key={link.id}>
                <div>
                  <strong>{link.name}</strong>
                  <small>
                    {t(
                      link.status === 'accepted'
                        ? 'Amizade confirmada'
                        : link.incoming
                          ? 'Pedido recebido'
                          : 'Pedido enviado',
                    )}
                  </small>
                </div>
                <div>
                  {link.status === 'pending' && link.incoming && (
                    <Button
                      disabled={busy}
                      onClick={() => void action(`/${link.id}/accept`, 'POST')}
                    >
                      {t('Aceitar')}
                    </Button>
                  )}
                  <IconAction
                    icon={link.status === 'accepted' ? UserRoundMinus : X}
                    label={t(
                      link.status === 'accepted'
                        ? 'Remover amigo'
                        : link.incoming
                          ? 'Recusar'
                          : 'Cancelar pedido',
                    )}
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setRemove(link)}
                  />
                </div>
              </div>
            ))}
          </section>
        </>
      )}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!busy) setInviteOpen(open);
        }}
      >
        <DialogContent className="friends-invite-dialog">
          <DialogTitle>{t('Convidar amigo')}</DialogTitle>
          <DialogDescription>
            {t(
              'Compartilhe seu código ou envie um pedido usando o código de outro usuário.',
            )}
          </DialogDescription>
          <output className="home-error" aria-live="polite">
            {error}
          </output>
          {data && (
            <>
              <div className="friends-settings">
                <section>
                  <h2>{t('Seu perfil de amigo')}</h2>
                  <form
                    className="item-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = new FormData(event.currentTarget).get(
                        'name',
                      );
                      if (typeof value === 'string')
                        void action('/profile', 'POST', { name: value });
                    }}
                  >
                    <label htmlFor="friend-name">{t('Nome no ranking')}</label>
                    <Input
                      key={data.name}
                      id="friend-name"
                      name="name"
                      defaultValue={data.name}
                      required
                      maxLength={40}
                    />
                    <Button disabled={busy} type="submit">
                      {t('Salvar nome')}
                    </Button>
                  </form>
                  <label htmlFor="my-friend-code">
                    {t('Seu código de amigo')}
                  </label>
                  <Input
                    id="my-friend-code"
                    value={data.code}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <small>{t('Compartilhe este código com seus amigos.')}</small>
                </section>
                <section>
                  <h2>{t('Adicionar amigo')}</h2>
                  <p>
                    {t(
                      'Ao aceitar a amizade, vocês compartilham o tempo assistido e a quantidade de episódios no ranking. Sua coleção, avaliações e anotações continuam privadas.',
                    )}
                  </p>
                  <form
                    className="item-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void action('/requests', 'POST', { code: code.trim() });
                    }}
                  >
                    <label htmlFor="friend-code">{t('Código do amigo')}</label>
                    <Input
                      id="friend-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      required
                      pattern="[a-fA-F0-9]{24}"
                      maxLength={24}
                    />
                    <Button type="submit" disabled={busy}>
                      {t('Enviar pedido')}
                    </Button>
                  </form>
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(open) => {
          if (!open && !busy) setRemove(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogTitle>{remove?.name}</DialogTitle>
          <DialogDescription>
            {t(
              'Confirmar a remoção desta amizade ou pedido? O acesso ao ranking entre vocês será encerrado.',
            )}
          </DialogDescription>
          <output className="home-error">{error}</output>
          <div className="item-form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              {t('Cancelar')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => remove && void action(`/${remove.id}`, 'DELETE')}
            >
              {t('Confirmar remoção')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
