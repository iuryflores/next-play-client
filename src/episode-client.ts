import { t } from './i18n';
import { notifySaved } from './notifications';
import { ApiError } from './auth';
import { nextEpisode, type EpisodeData } from './episode-navigation';
export async function request(
  id: string,
  method = 'GET',
  body?: object,
  importing: boolean | 'complete' | 'watch-many' | 'unwatch-many' = false,
): Promise<EpisodeData> {
  const options: RequestInit = {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(typeof importing === 'string' ? 120000 : 20000),
  };
  if (body && method !== 'GET') {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(
    `/api/library/${encodeURIComponent(id)}/episodes${typeof importing === 'string' ? '/' + importing : importing ? '/import' : ''}`,
    options,
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new ApiError(
      response.status,
      typeof data?.message === 'string'
        ? data.message
        : t('Não foi possível carregar os episódios.'),
    );
  if (
    method === 'PATCH' ||
    importing === 'watch-many' ||
    importing === 'unwatch-many'
  )
    notifySaved(t('Progresso salvo.'));
  return data as EpisodeData;
}
export async function resume(
  id: string,
  data: EpisodeData,
  active: () => boolean,
): Promise<EpisodeData> {
  if (!data.supported || !active()) return data;
  let result = data.seasons.length ? data : await request(id, 'POST', {}, true);
  while (active()) {
    const next = nextEpisode(result);
    if (!next || next.episode !== null) break;
    result = await request(id, 'POST', { season: next.season }, true);
  }
  return result;
}
