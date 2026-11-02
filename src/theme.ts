export type Theme = 'light' | 'dark' | 'system';
let selectedTheme: Theme = 'system';

export function validTheme(value: unknown): Theme {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function readTheme(): Theme {
  return selectedTheme;
}

export function applyTheme(
  theme: Theme,
  systemDark = matchMedia('(prefers-color-scheme: dark)').matches,
) {
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#191621' : '#f5f3f9');
}

export function rememberTheme(theme: Theme) {
  // Mantém apenas o estado da sessão; a persistência é feita na conta pela API.
  selectedTheme = theme;
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('nextplay:theme', { detail: theme }));
}

export function initializeTheme() {
  const media = matchMedia('(prefers-color-scheme: dark)');
  applyTheme(readTheme(), media.matches);
  // Só acompanha o sistema enquanto o usuário não escolher um tema explícito.
  media.addEventListener('change', (event) =>
    applyTheme(readTheme(), event.matches),
  );
}
