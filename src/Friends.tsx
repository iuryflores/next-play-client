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
    minutes: number;
    episodes: number;
    incomplete: boolean;
    rank: number;
    movement?: number | null;
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [revision, setRevision] = useState(0);
  const [visitId] = useState(() => crypto.randomUUID());
  const [remove, setRemove] = useState<Connection | null>(null);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    let active = true;
    void request<FriendsData>('', 'GET', undefined, visitId)
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
  }, [revision, visitId]);
  async function action(path: string, method: string, body?: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(path, method, body);
      const refreshed = await request<FriendsData>();
      setData(refreshed);
      onNameChanged(refreshed.name);
      if (path === '/requests') setCode('');
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
          <div className="friends-settings">
            <section>
              <h2>{t('Seu perfil de amigo')}</h2>
              <form
                className="item-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = new FormData(event.currentTarget).get('name');
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
              <label htmlFor="my-friend-code">{t('Seu código de amigo')}</label>
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
          <section className="friends-ranking">
            <h2>{t('Ranking de amigos')}</h2>
            <p>
              {t(
                'Tempo total em séries: soma dos episódios assistidos, uma vez por episódio. Filmes e jogos ainda não entram no tempo. Empates recebem a mesma posição.',
              )}
            </p>
            <div className="friends-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">{t('Amigo')}</th>
                    <th scope="col">{t('Tempo em séries')}</th>
                    <th scope="col">{t('Episódios assistidos')}</th>
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
                        {row.name}
                        {row.me ? ` · ${t('Você')}` : ''}
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
