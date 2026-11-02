type PageHistory = { signature: string; pages: number[] };
const fallback = new Map<string, PageHistory>();
const storageKey = (kind: string) => `nextplay.explore.pages.${kind}`;

export function explorePagePlan(
  totalPages: number,
  visited: readonly number[] = [],
  random: () => number = Math.random,
) {
  const total = Number.isSafeInteger(totalPages)
    ? Math.max(0, Math.min(totalPages, 500))
    : 0;
  const all = Array.from({ length: total }, (_, index) => index + 1);
  const seen = new Set(visited);
  const remaining = all.filter((page) => !seen.has(page));
  // As primeiras páginas do TMDB concentram os populares dentro dos gêneros
  // filtrados. O sorteio ponderado favorece essas páginas sem excluir descobertas
  // nem repetir páginas já visitadas antes de terminar o ciclo.
  const candidates = remaining.length ? remaining : all;
  return {
    pages: candidates
      .map((page) => ({
        page,
        priority: -Math.log(Math.max(Number.EPSILON, random())) * page ** 1.2,
      }))
      .sort((a, b) => a.priority - b.priority)
      .map((candidate) => candidate.page),
    reset: total > 0 && !remaining.length,
  };
}

export function readExplorePages(kind: string, signature: string) {
  let previous = fallback.get(kind);
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(storageKey(kind)) || 'null',
    );
    if (
      value &&
      typeof value === 'object' &&
      'signature' in value &&
      value.signature === signature &&
      'pages' in value &&
      Array.isArray(value.pages)
    ) {
      previous = {
        signature,
        pages: value.pages
          .slice(-500)
          .filter(
            (page): page is number =>
              Number.isInteger(page) && page >= 1 && page <= 500,
          ),
      };
    }
  } catch {
    /* Storage indisponível mantém a rotação em memória nesta janela. */
  }
  return previous?.signature === signature ? [...previous.pages] : [];
}

export function rememberExplorePages(
  kind: string,
  signature: string,
  pages: readonly number[],
  reset = false,
) {
  const previous = reset ? [] : readExplorePages(kind, signature);
  const value = {
    signature,
    pages: [...new Set([...previous, ...pages])]
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= 500)
      .slice(-500),
  };
  fallback.set(kind, value);
  // Apenas números de páginas e o contexto do filtro ficam na sessão do navegador;
  // nenhuma credencial ou dado de avaliação é enviado ou armazenado aqui.
  try {
    sessionStorage.setItem(storageKey(kind), JSON.stringify(value));
  } catch {
    /* A memória continua disponível. */
  }
}
