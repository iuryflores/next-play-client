export type Theme = 'light' | 'dark' | 'system';
export const themeKey = 'nextplay.theme';

export function validTheme(value: unknown): Theme {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function readTheme(): Theme {
  try {
    return validTheme(localStorage.getItem(themeKey));
  } catch {
    return 'system';
  }
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
  // A aparência pertence a este navegador e não depende de salvar o perfil na API.
  try {
    localStorage.setItem(themeKey, theme);
  } catch {
    // Navegação privada pode bloquear o armazenamento; a troca ainda funciona na sessão.
  }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('nextplay:theme', { detail: theme }));
}

export function initializeTheme() {
  let selected = readTheme();
  const media = matchMedia('(prefers-color-scheme: dark)');
  applyTheme(selected, media.matches);
  // Só acompanha o sistema enquanto o usuário não escolher um tema explícito.
  media.addEventListener('change', (event) =>
    applyTheme(selected, event.matches),
  );
  window.addEventListener('nextplay:theme', (event) => {
    selected = (event as CustomEvent<Theme>).detail;
  });
  window.addEventListener('storage', (event) => {
    if (event.key === themeKey || event.key === null) {
      selected = readTheme();
      applyTheme(selected, media.matches);
    }
  });
}
