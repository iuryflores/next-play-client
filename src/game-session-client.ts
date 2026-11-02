import { ApiError } from './auth';
import { achievementActivity } from './achievement-client';
import { notifySaved } from './notifications';
import { t } from './i18n';
export type GameSession = {
  id: string;
  playedOn: string;
  minutes: number;
  createdAt: string;
  updatedAt: string;
};
export type GameHistory = {
  playtimeMinutes: number;
  baselineMinutes: number;
  lastPlayedOn: string | null;
  sessionCount: number;
  status: 'planned' | 'active' | 'completed';
  updatedAt: string | null;
  sessions: GameSession[];
  nextOffset: number | null;
};
export async function gameSessionRequest(
  id: string,
  path = '',
  method = 'GET',
  body?: object,
  signal?: AbortSignal,
): Promise<GameHistory> {
  const response = await fetch(
    `/api/library/${encodeURIComponent(id)}/game-sessions${path}`,
    {
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
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new ApiError(
      response.status,
      typeof data?.message === 'string'
        ? data.message
        : t('Não foi possível carregar as sessões.'),
    );
  if (method !== 'GET') {
    achievementActivity();
    notifySaved(t('Alterações salvas.'));
  }
  return data as GameHistory;
}
export const gameDuration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}min`;
