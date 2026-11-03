import PsnConnection, { type PsnStatus } from './PsnConnection';
import { useEffect, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { NativeSelect } from '@/components/ui/native-select';
import type { LibraryItem } from './library';
import { estimateTime } from './game-estimate';
import { t } from './i18n';
import './game-planner.css';
type Game = {
  externalId: string;
  title: string;
  playtimeMinutes?: number;
  achievementsUnlocked?: number;
  achievementsTotal?: number;
};
export type Preview = {
  id: string;
  provider: string;
  source: string;
  total: number;
  games: Game[];
  nextOffset: number | null;
};
export default function GameImports({
  items,
  changed,
  onExpired,
}: {
  items: LibraryItem[];
  changed: () => void;
  onExpired: () => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null),
    [connection, setConnection] = useState<{
      connected: boolean;
      profileUrl: string | null;
      lastResult: string | null;
    }>({ connected: false, profileUrl: null, lastResult: null }),
    [psnConnection, setPsnConnection] = useState<PsnStatus>({
      connected: false,
      onlineId: null,
      expiresAt: null,
    }),
    [expanded, setExpanded] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [applied, setApplied] = useState<string[]>([]);
  const [collection, setCollection] = useState(false),
    [tracking, setTracking] = useState(true);
  const mounted = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    void fetch('/api/game-imports', {
      credentials: 'same-origin',
      signal: abort.signal,
    })
      .then(async (r) => {
        if (r.status === 401) {
          onExpired();
          return;
        }
        if (!r.ok) throw Error();
        const d = await r.json();
        if (!abort.signal.aborted) {
          setConfigured(d.steamConfigured);
          const steam = d.steamConnection || {
            connected: false,
            profileUrl: null,
            lastResult: null,
          };
          setConnection(steam);
          if (d.psnConnection) {
            setPsnConnection(d.psnConnection);
            if (d.psnConnection.connected) setExpanded(true);
          }
          if (steam.connected || steam.lastResult) setExpanded(true);
          if (steam.lastResult === 'cancelled')
            setMessage(t('Conexão Steam cancelada.'));
          if (steam.lastResult === 'error')
            setError(t('Não foi possível conectar a Steam. Tente novamente.'));
        }
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
      abort.abort();
    };
  }, [onExpired]);
  async function request(path: string, body?: unknown, method?: 'DELETE') {
    const r = await fetch('/api/game-imports' + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    if (r.status === 401) onExpired();
    const d = await r.json();
    if (!r.ok)
      throw Error(
        typeof d.message === 'string'
          ? d.message
          : t(
              'Não foi possível importar. Confira o arquivo e tente novamente.',
            ),
      );
    return d;
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : t('Não foi possível salvar.'),
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function show(value: Preview) {
    if (mounted.current) {
      setPreview(value);
      setApplied([]);
      setSelected({});
    }
  }
  return (
    <details
      className="game-planner"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{t('Importar jogos e histórico')}</summary>
      <p>
        {t(
          'Acervo possuído e acompanhamento são independentes. Revise cada jogo antes de importar.',
        )}
      </p>
      <div className="import-methods">
        <section
          className="import-method"
          aria-labelledby="account-import-heading"
        >
          <h3 id="account-import-heading">{t('Contas conectadas')}</h3>
          <h4 className="steam-brand">
            <img src="/brands/steam.svg" alt="Steam" width="112" height="34" />
          </h4>

          <p>
            {t(
              'Entre no site oficial da Steam para conectar sua conta. Os detalhes dos jogos precisam estar públicos para importar a biblioteca.',
            )}
          </p>
          {configured === false && (
            <p>
              {t(
                'A consulta automática Steam aguarda configuração da chave do aplicativo. A importação por arquivo já pode ser usada.',
              )}
            </p>
          )}
          {connection.connected ? (
            <>
              <p>
                {t('Conta Steam conectada.')}{' '}
                {connection.profileUrl && (
                  <a
                    href={connection.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('Ver perfil Steam')}
                  </a>
                )}
              </p>
              <Button
                variant="outline"
                disabled={busy || configured !== true}
                onClick={() =>
                  void run(async () =>
                    show(await request('/steam/library', {})),
                  )
                }
              >
                {t('Consultar minha biblioteca Steam')}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await request('/steam/connection', undefined, 'DELETE');
                    if (mounted.current) {
                      setConnection({
                        connected: false,
                        profileUrl: null,
                        lastResult: null,
                      });
                      setPreview((value) =>
                        value?.source === 'steam-api' ? null : value,
                      );
                      setMessage(
                        t(
                          'Steam desconectada. Seus jogos importados foram preservados.',
                        ),
                      );
                    }
                  })
                }
              >
                {t('Desconectar Steam')}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              disabled={busy || configured === null}
              onClick={() =>
                void run(async () => {
                  const result = await request('/steam/connect', {});
                  // O destino vem do servidor e continua restrito ao login oficial antes de navegar.
                  const url = new URL(result.url);
                  if (
                    url.origin !== 'https://steamcommunity.com' ||
                    url.pathname !== '/openid/login'
                  )
                    throw Error(
                      t('Não foi possível conectar a Steam. Tente novamente.'),
                    );
                  window.location.assign(url.href);
                })
              }
            >
              {t('Conectar Steam')}
            </Button>
          )}
          <PsnConnection
            connection={psnConnection}
            onConnection={(value) => {
              setPsnConnection(value);
              if (!value.connected)
                setPreview((current) =>
                  current?.source === 'psn-api' ? null : current,
                );
            }}
            run={run}
            request={request}
            show={show}
            busy={busy}
          />
        </section>
        <section
          className="import-method"
          aria-labelledby="file-import-heading"
        >
          <h3 id="file-import-heading">{t('Importar por arquivo')}</h3>
          <p>
            {t(
              'Steam, Xbox, PlayStation, Epic, GOG e Nintendo. Esta opção importa um arquivo adaptado ao modelo abaixo; não conecta nem sincroniza automaticamente essas contas.',
            )}
          </p>
          <a
            className={buttonVariants({ variant: 'outline' })}
            href="/data/game-import-example.json"
            download="modelo-importacao-steam.json"
          >
            <Download aria-hidden="true" />
            {t('Baixar modelo JSON da Steam')}
          </a>
          <label>
            {t('Selecionar arquivo JSON')}
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                void run(async () => {
                  if (file.size > 100 * 1024)
                    throw Error(
                      t('O arquivo deve ter até 100 KiB e 200 jogos.'),
                    );
                  const data = JSON.parse(await file.text());
                  show(await request('/file', data));
                });
              }}
            />
          </label>
          <p>
            {t(
              'Modelo: provider identifica a plataforma; games contém externalId, title e, opcionalmente, playtimeMinutes, achievementsUnlocked e achievementsTotal. Não inclua senhas, tokens ou cookies.',
            )}
          </p>
        </section>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <output>{message}</output>}
      {busy && <output>{t('Processando…')}</output>}
      {preview && (
        <>
          <small>
            {t(
              preview.source !== 'file'
                ? 'Via conexão de conta'
                : 'Via arquivo JSON',
            )}
          </small>
          <h3>
            {t('Prévia')}: {preview.provider} · {preview.total} {t('jogos')}
          </h3>
          <p>
            {t(
              'A prévia expira em uma hora. Novos acompanhamentos entram em Para depois; horas não significam conclusão. Sem sessões ou datas inventadas. Reimportar usa o maior total de horas, sem somar os totais.',
            )}
          </p>
          <label>
            <input
              type="checkbox"
              disabled={busy}
              checked={collection}
              onChange={(e) => setCollection(e.target.checked)}
            />
            {t('Adicionar ao meu acervo digital')}
          </label>
          <small>
            {t(
              'Uma cópia por jogo/origem importada. Cópias cadastradas manualmente não são unidas automaticamente.',
            )}
          </small>
          <label>
            <input
              type="checkbox"
              disabled={busy}
              checked={tracking}
              onChange={(e) => setTracking(e.target.checked)}
            />
            {t('Adicionar ou atualizar meu acompanhamento')}
          </label>
          <Button
            variant="outline"
            disabled={
              busy ||
              (!collection && !tracking) ||
              preview.games.every((game) => applied.includes(game.externalId))
            }
            onClick={() =>
              void run(async () => {
                let imported = 0;
                try {
                  // Lotes pequenos permitem revisar destinos e retomar uma falha sem repetir importações já confirmadas.
                  for (const game of preview.games
                    .filter((game) => !applied.includes(game.externalId))
                    .slice(0, 20)) {
                    if (!mounted.current) break;
                    await request(
                      `/preview/${preview.id}/${game.externalId}/apply`,
                      {
                        collection,
                        tracking,
                        ...(tracking && selected[game.externalId]
                          ? { itemId: selected[game.externalId] }
                          : {}),
                      },
                    );
                    imported++;
                    if (mounted.current)
                      setApplied((value) => [...value, game.externalId]);
                  }
                  if (mounted.current)
                    setMessage(t('Importados neste lote: {0}', imported));
                } finally {
                  if (imported && mounted.current) changed();
                }
              })
            }
          >
            {t('Importar próximos 20 jogos revisados')}
          </Button>
          {preview.source === 'psn-api' && (
            <p>
              {t(
                'Estes jogos foram jogados na PSN. Só adicione ao acervo os títulos que você possui.',
              )}
            </p>
          )}
          <ul>
            {preview.games.map((game) => (
              <li key={game.externalId}>
                <strong>{game.title}</strong>
                <small>
                  {game.playtimeMinutes === undefined
                    ? t('Horas não informadas')
                    : estimateTime(game.playtimeMinutes)}{' '}
                  ·{' '}
                  {game.achievementsTotal === undefined
                    ? t('Conquistas não informadas')
                    : `${game.achievementsUnlocked ?? '—'} / ${game.achievementsTotal} ${t('conquistas externas')}`}
                </small>
                {tracking && (
                  <label>
                    {t('Vincular a um jogo que já acompanho')}
                    <NativeSelect
                      value={selected[game.externalId] || ''}
                      disabled={busy || applied.includes(game.externalId)}
                      onChange={(e) =>
                        setSelected((v) => ({
                          ...v,
                          [game.externalId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">{t('Criar novo acompanhamento')}</option>
                      {items
                        .filter((i) => i.kind === 'game' && !i.archived)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.title} · {i.platform || t('Não informada')}
                          </option>
                        ))}
                    </NativeSelect>
                  </label>
                )}
                {(preview.source === 'steam-api' ||
                  preview.source === 'psn-api') && (
                  <Button
                    variant="ghost"
                    disabled={busy || applied.includes(game.externalId)}
                    onClick={() =>
                      void run(async () => {
                        const stats = await request(
                          `/preview/${preview.id}/${game.externalId}/${preview.source === 'psn-api' ? 'psn-trophies' : 'achievements'}`,
                          {},
                        );
                        if (mounted.current)
                          setPreview((v) =>
                            v
                              ? {
                                  ...v,
                                  games: v.games.map((g) =>
                                    g.externalId === game.externalId
                                      ? { ...g, ...stats }
                                      : g,
                                  ),
                                }
                              : v,
                          );
                      })
                    }
                  >
                    {t(
                      preview.source === 'psn-api'
                        ? 'Consultar troféus PSN'
                        : 'Consultar conquistas Steam',
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    (!collection && !tracking) ||
                    applied.includes(game.externalId)
                  }
                  onClick={() =>
                    void run(async () => {
                      await request(
                        `/preview/${preview.id}/${game.externalId}/apply`,
                        {
                          collection,
                          tracking,
                          ...(tracking && selected[game.externalId]
                            ? { itemId: selected[game.externalId] }
                            : {}),
                        },
                      );
                      if (mounted.current) {
                        setApplied((v) => [...v, game.externalId]);
                        setMessage(t('Jogo importado.'));
                        changed();
                      }
                    })
                  }
                >
                  {t(
                    applied.includes(game.externalId)
                      ? 'Importado'
                      : 'Confirmar este jogo',
                  )}
                </Button>
              </li>
            ))}
          </ul>
          {preview.nextOffset !== null && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await request(
                    `/preview/${preview.id}?offset=${preview.nextOffset}`,
                  );
                  if (mounted.current)
                    setPreview((v) =>
                      v
                        ? { ...next, games: [...v.games, ...next.games] }
                        : next,
                    );
                })
              }
            >
              {t('Carregar mais jogos')}
            </Button>
          )}
        </>
      )}
    </details>
  );
}
