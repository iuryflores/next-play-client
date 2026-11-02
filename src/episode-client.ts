import { achievementActivity } from './achievement-client';
import { t } from './i18n';
import { notifySaved } from './notifications';
import { ApiError } from './auth';
import { nextEpisode, type EpisodeData } from './episode-navigation';
export async function request(
  id: string,
  method = 'GET',
  body?: object,
  importing: boolean | 'complete' | 'watch-many' | 'unwatch-many' = false,
  viewing?: string | null,
): Promise<EpisodeData> {
  const headers = new Headers();
  if (viewing) headers.set('X-Viewing-Id', viewing);
  const options: RequestInit = {
    method,
    headers,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(typeof importing === 'string' ? 120000 : 20000),
  };
  if (body && method !== 'GET') {
    headers.set('Content-Type', 'application/json');
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
  if (method !== 'GET') achievementActivity();
  return data as EpisodeData;
}
export async function resume(
  id: string,
  data: EpisodeData,
  active: () => boolean,
  viewing?: string | null,
): Promise<EpisodeData> {
  if (!data.supported || !active()) return data;
  let result = data.seasons.length
    ? data
    : await request(id, 'POST', {}, true, viewing);
  while (active()) {
    const next = nextEpisode(result);
    if (!next || next.episode !== null) break;
    result = await request(id, 'POST', { season: next.season }, true, viewing);
  }
  return result;
}
