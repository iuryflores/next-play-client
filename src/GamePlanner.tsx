import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { estimateTime, type EstimateMode } from './game-estimate';
import {
  plannerSummary,
  recommendGames,
  type PlannerGame,
} from './game-planner';
import { t } from './i18n';
import './game-planner.css';
export default function GamePlanner({
  open,
  onExpired,
}: {
  open: (id: string) => void;
  onExpired: () => void;
}) {
  const [items, setItems] = useState<PlannerGame[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false),
    [total, setTotal] = useState(0);
  const [mode, setMode] = useState<EstimateMode>('mainMinutes'),
    [budget, setBudget] = useState(0),
    [platform, setPlatform] = useState(''),
    [genre, setGenre] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function load() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setLoaded(false);
    setItems([]);
    const collected = new Map<string, PlannerGame>();
    let after: string | null = null;
    const seen = new Set<string>();
    try {
      do {
        const response: Response = await fetch(
          '/api/game-planner' + (after ? '?after=' + after : ''),
          {
            credentials: 'same-origin',
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(90000)]),
          },
        );
        if (response.status === 401) {
          onExpired();
          return;
        }
        if (!response.ok)
          throw Error(
            t('Não foi possível calcular o backlog. Tente novamente.'),
          );
        const data: {
          items: PlannerGame[];
          total: number;
          nextAfter: string | null;
        } = await response.json();
        if (abort.signal.aborted) return;
        for (const item of data.items) collected.set(item.id, item);
        setItems([...collected.values()]);
        setTotal(data.total);
        after = data.nextAfter;
        if (after && seen.has(after))
          throw Error(
            t('Não foi possível calcular o backlog. Tente novamente.'),
          );
        if (after) seen.add(after);
      } while (after && !abort.signal.aborted);
      if (!abort.signal.aborted) setLoaded(true);
    } catch (reason) {
      if (!abort.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const filtered = items.filter(
      (item) => !platform || item.platform === platform,
    ),
    summary = plannerSummary(filtered, mode);
  const suggestions = recommendGames(
    items,
    mode,
    budget,
    platform,
    genre,
    new Date().toLocaleDateString('en-CA'),
  );
  return (
    <details className="game-planner">
      <summary>{t('Planejar meus jogos')}</summary>
      <p>
        {t('Estime o tempo do backlog e escolha o próximo jogo da sua lista.')}
      </p>
      <Button variant="outline" disabled={busy} onClick={() => void load()}>
        {t(
          busy
            ? 'Calculando…'
            : loaded
              ? 'Atualizar estimativas'
              : 'Calcular meu backlog',
        )}
      </Button>
      {busy && (
        <output>
          {items.length} / {total || '…'} {t('jogos consultados')}
        </output>
      )}
      {error && <p role="alert">{error}</p>}
      {loaded && (
        <>
          <div className="game-planner-filters">
            <label>
              {t('Objetivo no jogo')}
              <NativeSelect
                value={mode}
                onChange={(e) => setMode(e.target.value as EstimateMode)}
              >
                <option value="mainMinutes">{t('História principal')}</option>
                <option value="extrasMinutes">{t('História + extras')}</option>
                <option value="completionistMinutes">
                  {t('100% completo')}
                </option>
              </NativeSelect>
            </label>
            <label>
              {t('Plataforma')}
              <NativeSelect
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="">{t('Todas')}</option>
                {[
                  ...new Set(
                    items.map((i) => i.platform || '').filter(Boolean),
                  ),
                ]
                  .sort()
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </NativeSelect>
            </label>
          </div>
          <h3>
            {t('Tempo restante do backlog')}:{' '}
            {summary.known
              ? estimateTime(summary.minutes)
              : t('Sem estimativa')}
          </h3>
          <p>
            {summary.known} / {filtered.length} {t('jogos com estimativa')} ·{' '}
            {summary.unknown} {t('sem estimativa')}
            {summary.failed > 0
              ? ` · ${summary.failed} ${t('falhas de consulta')}`
              : ''}
          </p>
          <small>
            {t(
              'Total parcial quando faltam dados. Médias da IGDB menos as horas de cada conteúdo; DLCs contam separadamente. Atingir a média não significa concluir.',
            )}
          </small>
          <h3>{t('O que jogar depois?')}</h3>
          <div className="game-planner-filters">
            <label>
              {t('Tempo disponível para terminar (horas)')}
              <input
                type="number"
                min="0"
                max="10000"
                step="0.5"
                value={budget / 60}
                onChange={(e) =>
                  setBudget(Math.max(0, Number(e.target.value) || 0) * 60)
                }
              />
              <small>
                {t(
                  'Zero inclui qualquer duração; não representa tempo de uma sessão.',
                )}
              </small>
            </label>
            <label>
              {t('Gênero')}
              <NativeSelect
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                <option value="">{t('Todos')}</option>
                {[...new Set(items.flatMap((i) => i.genres || []))]
                  .sort()
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </NativeSelect>
            </label>
          </div>
          <p>
            {t(
              'Prioridade primeiro, depois jogos em andamento e menor tempo restante. Lançamentos futuros ficam de fora.',
            )}
          </p>
          <ul>
            {suggestions.map(({ item, remaining }) => (
              <li key={item.id}>
                <button onClick={() => open(item.id)}>{item.title}</button>
                <small>
                  {item.platform || t('Não informada')} ·{' '}
                  {t(item.status === 'active' ? 'Jogando' : 'Para depois')} ·{' '}
                  {t(
                    (
                      {
                        high: 'Prioridade alta',
                        medium: 'Prioridade média',
                        low: 'Prioridade baixa',
                      } as Record<string, string>
                    )[item.priority || ''] || 'Sem prioridade',
                  )}{' '}
                  ·{' '}
                  {remaining === null
                    ? t('Sem estimativa')
                    : remaining === 0
                      ? t('Média já atingida')
                      : estimateTime(remaining)}
                </small>
              </li>
            ))}
          </ul>
          {!suggestions.length && (
            <p>
              {t(
                'Nenhum jogo corresponde aos filtros. Aumente o tempo ou altere suas preferências.',
              )}
            </p>
          )}
        </>
      )}
    </details>
  );
}
