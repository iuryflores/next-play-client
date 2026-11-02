import { t } from './i18n';
import { notifySaved } from './notifications';
import { ApiError } from './auth';
import { achievementActivity } from './achievement-client';
export type Kind = 'movie' | 'series' | 'game' | 'book';
export type Status = 'planned' | 'active' | 'completed';
export type Priority = 'none' | 'high' | 'medium' | 'low';
export const priorityLabels: Record<Priority, string> = {
  none: 'Sem prioridade',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};
export interface LibraryItem {
  id: string;
  title: string;
  originalTitle?: string;
  authors?: string[];
  publisher?: string;
  isbn?: string;
  language?: string;
  kind: Kind;
  status: Status;
  priority?: Priority;
  inProgress?: boolean;
  caughtUp?: boolean;
  lastWatchedAt?: string;
  lastWatchedEpisode?: { season: number; episode: number };
  archived?: boolean;
  notes: string;
  episodeProgress?: {
    initialized: boolean;
    watched: number;
    total: number;
    next: {
      season: number;
      episode: number | null;
      name?: string;
      airDate?: string;
    } | null;
  };
  watchedDateUnknown?: boolean;
  completedOn?: string;
  completedAt?: string;
  episodesCompletedAt?: string;
  stars?: number;
  feeling?: string;
  favoriteCharacter?: string;
  favoriteCastId?: string;
  updatedAt: string;
  genres?: string[];
  parentGameCatalogId?: string;
  platform?: string;
  playtimeMinutes?: number;
  lastPlayedOn?: string | null;
  catalogId?: string;
  coverUrl?: string;
  year?: string;
  runtime?: number | null;
  productionCompanies?: { id: number; name: string; logoUrl?: string | null }[];
  releaseDate?: string;
  unreleased?: boolean;
  overview?: string;
  sourceUrl?: string;
}
export const categories: Record<Kind, string> = {
  movie: t('Filmes'),
  series: t('Séries'),
  game: t('Jogos'),
  book: t('Livros'),
};
export const statusNames: Record<Kind, Record<Status, string>> = {
  movie: {
    planned: t('Quero assistir'),
    active: t('Quero assistir'),
    completed: t('Assistido'),
  },
  series: {
    planned: t('Quero assistir'),
    active: t('Assistindo'),
    completed: t('Concluída'),
  },
  game: {
    planned: t('Quero jogar'),
    active: t('Jogando'),
    completed: t('Concluído'),
  },
  book: { planned: t('Quero ler'), active: t('Lendo'), completed: t('Lido') },
};
export async function libraryRequest<T>(
  method = 'GET',
  id = '',
  body?: object,
  action?:
    | 'priority'
    | 'playtime'
    | 'archive'
    | 'upcoming'
    | 'runtime'
    | 'production-companies'
    | 'game-estimate'
    | 'directors'
    | 'trailer',
  visitId?: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    // Descoberta pode recuperar metadados e consultar provedores externos;
    // a biblioteca salva continua com o prazo curto para navegação cotidiana.
    const timeout = AbortSignal.timeout(
      method === 'GET' ? (id === 'explore' ? 45000 : 15000) : 120000,
    );
    const options: RequestInit = {
      method,
      credentials: 'same-origin',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      ...(visitId ? { headers: { 'X-Ranking-Visit': visitId } } : {}),
    };
    if (body && method !== 'GET') {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    response = await fetch(
      `/api/library${id ? `/${encodeURIComponent(id)}` : ''}${action ? '/' + action : ''}`,
      options,
    );
  } catch {
    throw new Error(
      t('Não foi possível conectar à biblioteca. Tente novamente.'),
    );
  }
  const announce = () => {
    if (
      method !== 'GET' &&
      (!action || action === 'archive' || action === 'playtime')
    )
      achievementActivity();
    if (
      method !== 'GET' &&
      (!action ||
        action === 'archive' ||
        action === 'playtime' ||
        action === 'priority')
    )
      notifySaved(
        t(method === 'DELETE' ? 'Removido da coleção.' : 'Alterações salvas.'),
      );
  };
  if (response.status === 204) {
    announce();
    return undefined as T;
  }
  const data = (await response.json().catch(() => null)) as T & {
    message?: string | string[];
  };
  if (!response.ok || !data)
    throw new ApiError(
      response.status,
      Array.isArray(data?.message)
        ? data.message.join(' ')
        : data?.message || t('Não foi possível carregar a biblioteca.'),
    );
  announce();
  return data;
}
