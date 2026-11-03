import { useEffect, useState } from 'react';
import { t } from './i18n';
import { estimateTime } from './game-estimate';
type Source = {
  provider: string;
  source: string;
  title: string;
  playtimeMinutes: number | null;
  achievementsUnlocked: number | null;
  achievementsTotal: number | null;
  checkedAt: string;
  externalId: string;
  steamAccountId?: string | null;
  psnOnlineId?: string | null;
  gameUrl?: string | null;
  accountUrl?: string | null;
};
export default function ExternalGameStats({ id }: { id: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    void fetch('/api/game-imports/stats/' + id, {
      credentials: 'same-origin',
      signal: abort.signal,
    })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          if (!abort.signal.aborted) setSources(d.sources);
        }
      })
      .catch(() => {});
    return () => abort.abort();
  }, [id]);
  if (!sources.length) return null;
  return (
    <section className="game-estimate">
      <h2>{t('Dados importados das plataformas')}</h2>
      {sources.map((s) => (
        <div key={s.provider}>
          <h3>
            {s.provider === 'steam'
              ? 'Steam'
              : s.provider === 'playstation'
                ? 'PlayStation Network'
                : s.provider}
          </h3>
          {s.provider === 'playstation' && s.psnOnlineId && (
            <p>
              {t('Conta de origem')}: {s.psnOnlineId}
            </p>
          )}
          {s.gameUrl && (
            <a href={s.gameUrl} target="_blank" rel="noopener noreferrer">
              {t('Ver jogo na Steam')}
            </a>
          )}
          {s.provider === 'steam' && (
            <p>
              {t('Conta de origem')}:{' '}
              {s.accountUrl ? (
                <a
                  href={s.accountUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.steamAccountId}
                </a>
              ) : (
                t(
                  'Não registrada nesta importação. Reimporte para atualizar a origem.',
                )
              )}
            </p>
          )}
          <p>
            {s.playtimeMinutes === null
              ? t('Horas não informadas')
              : estimateTime(s.playtimeMinutes)}{' '}
            ·{' '}
            {s.achievementsTotal === null
              ? t('Conquistas não informadas')
              : `${s.achievementsUnlocked ?? '—'} / ${s.achievementsTotal} ${t('conquistas externas')}`}
          </p>
          <small>
            {t(
              s.source === 'steam-api'
                ? 'Consultado na Steam'
                : s.source === 'psn-api'
                  ? 'Consultado na PSN experimental'
                  : 'Importado por arquivo',
            )}{' '}
            · {t('Última importação')}: {new Date(s.checkedAt).toLocaleString()}
          </small>
        </div>
      ))}
      <p>
        {t(
          'Conquistas externas são informativas e não equivalem às conquistas do NextPlay.',
        )}
      </p>
    </section>
  );
}
