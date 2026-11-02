// Embaralha uma cópia para não alterar o cache nem a ordem de páginas já exibidas.
export function shuffleSuggestions<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function exploreSelection<T extends { catalogId: string }>(
  items: readonly T[],
  recentlyShown: readonly string[] = [],
  size = 12,
  preserveRanking = false,
) {
  const unique = [
    ...new Map(items.map((item) => [item.catalogId, item])).values(),
  ];
  const previous = new Set(recentlyShown);
  // Para TMDB, a API já combina afinidade com popularidade. A variedade vem
  // das páginas sorteadas; embaralhar os candidatos apagaria essa prioridade.
  const order = (candidates: T[]) =>
    preserveRanking ? candidates : shuffleSuggestions(candidates);
  // Primeiro variamos as obras, não apenas sua posição. Repetições só completam
  // a grade quando o catálogo não oferece candidatos novos suficientes.
  const ordered = [
    ...order(unique.filter((item) => !previous.has(item.catalogId))),
    ...order(unique.filter((item) => previous.has(item.catalogId))),
  ];
  return { results: ordered.slice(0, size), pending: ordered.slice(size) };
}
export function rankSuggestions<T extends { relevance?: number }>(
  items: readonly T[],
): T[] {
  return shuffleSuggestions(items).sort(
    (a, b) => (b.relevance || 0) - (a.relevance || 0),
  );
}
