import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from './i18n';
import type { Preview } from './GameImports';
export type PsnStatus = {
  experimental?: boolean;
  connected: boolean;
  onlineId: string | null;
  expiresAt: string | null;
};
export default function PsnConnection({
  connection,
  onConnection,
  run,
  request,
  show,
  busy,
}: {
  connection: PsnStatus;
  onConnection: (value: PsnStatus) => void;
  run: (action: () => Promise<void>) => Promise<void>;
  request: (
    path: string,
    body?: unknown,
    method?: 'DELETE',
  ) => Promise<unknown>;
  show: (value: Preview) => void;
  busy: boolean;
}) {
  const [npsso, setNpsso] = useState(''),
    [consent, setConsent] = useState(false);
  useEffect(() => {
    if (!connection.connected || !connection.expiresAt) return;
    const timer = setTimeout(
      () => onConnection({ connected: false, onlineId: null, expiresAt: null }),
      Math.max(0, Date.parse(connection.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [connection.connected, connection.expiresAt, onConnection]);
  return (
    <div className="psn-connection">
      <h4>PlayStation Network · {t('Experimental')}</h4>
      <p>
        {t(
          'Integração comunitária não oficial, somente leitura. O código NPSSO não é salvo; a conexão temporária expira ou termina ao reiniciar o servidor.',
        )}
      </p>
      {connection.connected ? (
        <>
          <p>
            {t('Conta PSN conectada')}: <strong>{connection.onlineId}</strong>
          </p>
          {connection.expiresAt && (
            <small>
              {t('Conexão válida até')}:{' '}
              {new Date(connection.expiresAt).toLocaleString()}
            </small>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () =>
                show((await request('/psn/library', {})) as Preview),
              )
            }
          >
            {t('Consultar jogos jogados na PSN')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await request('/psn/connection', undefined, 'DELETE');
                onConnection({
                  connected: false,
                  onlineId: null,
                  expiresAt: null,
                });
              })
            }
          >
            {t('Desconectar PSN')}
          </Button>
        </>
      ) : (
        <>
          <details>
            <summary>{t('Como obter o código NPSSO')}</summary>
            <ol>
              <li>
                {t('Entre na sua conta no site oficial da PlayStation.')}{' '}
                <a
                  href="https://www.playstation.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PlayStation
                </a>
              </li>
              <li>
                {t(
                  'No mesmo navegador, abra a página Sony abaixo e copie somente o valor de npsso.',
                )}{' '}
                <a
                  href="https://ca.account.sony.com/api/v1/ssocookie"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('Obter código na Sony')}
                </a>
              </li>
              <li>
                {t(
                  'Cole o código no campo abaixo. Não envie por chat nem informe sua senha ao NextPlay.',
                )}
              </li>
            </ol>
          </details>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || !consent) return;
              const code = npsso.trim();
              setNpsso('');
              void run(async () =>
                onConnection(
                  (await request('/psn/connect', {
                    npsso: code,
                    consent: true,
                  })) as PsnStatus,
                ),
              );
            }}
          >
            <label htmlFor="psn-npsso">
              {t('Código NPSSO')}
              <input
                id="psn-npsso"
                type="password"
                autoComplete="off"
                spellCheck={false}
                required
                minLength={64}
                maxLength={64}
                pattern="[A-Za-z0-9_-]{64}"
                value={npsso}
                disabled={busy}
                onChange={(event) => setNpsso(event.target.value)}
              />
            </label>
            <label className="psn-consent">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(event) => setConsent(event.target.checked)}
              />
              {t(
                'Entendo que a integração é experimental e autorizo a consulta dos meus jogos, horas e troféus.',
              )}
            </label>
            <Button
              type="submit"
              variant="outline"
              disabled={busy || !consent || npsso.trim().length !== 64}
            >
              {t('Conectar PSN experimental')}
            </Button>
          </form>
        </>
      )}
      <small>
        {t(
          'A PSN retorna jogos jogados; não garante a biblioteca completa de compras. Horas e troféus ausentes não serão inventados.',
        )}
      </small>
    </div>
  );
}
