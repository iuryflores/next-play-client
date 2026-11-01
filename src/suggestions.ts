// Shuffle a copy so cached results and already displayed pages keep their order.
export function shuffleSuggestions<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}
export function rankSuggestions<T extends { relevance?: number }>(
  items: readonly T[],
): T[] {
  return shuffleSuggestions(items).sort(
    (a, b) => (b.relevance || 0) - (a.relevance || 0),
  );
}
