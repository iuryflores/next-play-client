import { t } from './i18n';
import { notifySaved } from './notifications';
import { apiMessage } from './i18n';
export interface AuthUser {
  requiresVerification?: boolean;
  language?: 'pt-BR' | 'en-US' | 'es-ES';
  displayName?: string;
  avatar?: string;
  id: string;
  email: string;
  provider: string;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(apiMessage(status, message));
  }
}

export async function authRequest<T>(path: string, body?: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(['register', 'forgot-password', 'resend-confirmation', 'profile'].includes(path) ? 30000 : 15000),
    });
  } catch {
    throw new ApiError(
      0,
      t('Não foi possível conectar à API. Confira se o servidor está rodando.'),
    );
  }
  const announce = () => {
    if (body && ['profile', 'preferences'].includes(path))
      notifySaved(t('Alterações salvas.'));
  };
  if (response.status === 204) {
    announce();
    return undefined as T;
  }
  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;
  if (!response.ok || payload === null) {
    const message = payload?.message;
    throw new ApiError(
      response.status,
      Array.isArray(message)
        ? message.join(' ')
        : message || t('A API está indisponível. Tente novamente.'),
    );
  }
  announce();
  return payload;
}
