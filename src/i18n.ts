import { translations } from './translations';
import { gameGenreName } from './stats-summary';
export type Language = 'pt-BR' | 'en-US' | 'es-ES';
export function validLanguage(value: unknown): Language {
  return value === 'en-US' || value === 'es-ES' ? value : 'pt-BR';
}
function initialLanguage(): Language {
  try {
    return validLanguage(localStorage.getItem('nextplay.language'));
  } catch {
    return 'pt-BR';
  }
}
export const language = initialLanguage();
export function rememberLanguage(value: Language) {
  try {
    localStorage.setItem('nextplay.language', value);
  } catch {
    /* Account preference remains saved on the server. */
  }
}
export function t(
  source: string,
  ...values: (string | number | null | undefined)[]
): string {
  const key = source.trim();
  const pair = translations[key];
  const translated =
    language === 'pt-BR' || !pair ? key : pair[language === 'en-US' ? 0 : 1];
  return (
    source.slice(0, source.length - source.trimStart().length) +
    translated +
    source.slice(source.trimEnd().length)
  ).replace(/\{(\d+)\}/g, (_, index: string) =>
    String(values[Number(index)] ?? ''),
  );
}
export function dateLabel(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + 'T12:00:00')
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
export function genreLabel(value: string) {
  value = gameGenreName(value);
  const key = Object.keys(translations).find(
    (key) => key.toLocaleLowerCase() === value.toLocaleLowerCase(),
  );
  return key ? t(key) : value;
}
export function apiMessage(status: number, message: string) {
  if (language === 'pt-BR' || translations[message.trim()]) return t(message);
  if (Object.values(translations).some((pair) => pair.includes(message)))
    return message;
  return t(
    status === 401
      ? 'Entre para continuar.'
      : status === 403
        ? 'Acesso não permitido.'
        : status === 404
          ? 'Título ou episódio não encontrado.'
          : status === 429
            ? 'Muitas tentativas. Aguarde um minuto e tente novamente.'
            : status === 400 || status === 409
              ? 'Confira os dados informados.'
              : 'O serviço está indisponível. Tente novamente em instantes.',
  );
}
