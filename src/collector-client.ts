import { achievementActivity } from './achievement-client';
import { ApiError } from './auth';
import { t } from './i18n';
import type { Kind } from './library';
export type CollectorKind = Kind | 'other';

export interface OwnedCopy {
  id: string;
  title: string;
  kind: CollectorKind;
  category?: string;
  format: 'physical' | 'digital';
  platform: string;
  edition: string;
  notes: string;
  catalogId?: string;
  coverUrl?: string;
  year?: string;
  authors?: string[];
  isbn?: string;
  publisher?: string;
  language?: string;
  genres?: string[];
  createdAt: string;
  updatedAt: string;
}
export type CopyInput = Pick<
  OwnedCopy,
  'title' | 'kind' | 'format' | 'platform' | 'edition' | 'notes' | 'catalogId'
> & { category?: string; photo?: string };

export async function collectorRequest<T>(
  method = 'GET',
  id = '',
  body?: CopyInput,
  signal?: AbortSignal,
): Promise<T> {
  // O acervo tem suas próprias rotas: salvar posse nunca escreve na biblioteca de consumo.
  const response = await fetch(
    `/api/collector/copies${id ? '/' + encodeURIComponent(id) : ''}`,
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
  if (response.status === 204) {
    if (method !== 'GET') achievementActivity();
    return undefined as T;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new ApiError(
      response.status,
      typeof data?.message === 'string'
        ? data.message
        : t('Não foi possível acessar sua coleção.'),
    );
  if (method !== 'GET') achievementActivity();
  return data as T;
}
