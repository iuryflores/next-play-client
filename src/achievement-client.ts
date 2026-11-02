import { ApiError } from './auth';
export interface Achievement {
  id: string;
  family: string;
  name: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  level: number;
  levels: number;
  current: number;
  unlockedAt: string | null;
}
export interface AchievementState {
  timeZone: string;
  selectedId: string | null;
  pending: string[];
  achievements: Achievement[];
}
export async function achievementRequest<T>(
  path = '',
  method = 'GET',
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/achievements${path ? '/' + path : ''}`, {
    method,
    credentials: 'same-origin',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new ApiError(
      response.status,
      typeof data?.message === 'string'
        ? data.message
        : 'Não foi possível carregar suas conquistas.',
    );
  return data as T;
}
export function achievementActivity() {
  // Apenas avisa que houve uma mutação bem-sucedida; metas e pontos nunca vêm do cliente.
  window.dispatchEvent(new Event('nextplay:achievement-activity'));
}
