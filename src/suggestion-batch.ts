export type SuggestionBuffer<T> = { pending: T[]; next: number | null };
export function suggestionCount(batch: number, visible: number, size = 12) {
  return Math.max(size, batch * size - visible);
}
export async function suggestionBatch<T extends { catalogId: string }>(
  buffer: SuggestionBuffer<T>,
  fetchPage: (
    page: number,
  ) => Promise<{ results: T[]; nextPage: number | null }>,
  exclude: (item: T) => boolean,
  signal: AbortSignal,
  size = 12,
  maxPages = Infinity,
) {
  let fetched = 0;
  const available = () => [
    ...new Map(
      buffer.pending
        .filter((item) => !exclude(item))
        .map((item) => [item.catalogId, item]),
    ).values(),
  ];
  // Algumas páginas podem conter apenas obras já vistas; o limite mantém o
  // botão responsivo e preserva o cursor para a próxima tentativa.
  while (
    available().length < size &&
    buffer.next !== null &&
    fetched < maxPages
  ) {
    signal.throwIfAborted();
    const page = buffer.next;
    const data = await fetchPage(page);
    fetched++;
    signal.throwIfAborted();
    buffer.pending.push(...data.results);
    buffer.next =
      data.nextPage !== null && data.nextPage > page ? data.nextPage : null;
  }
  signal.throwIfAborted();
  const candidates = available();
  const results = candidates.slice(0, size);
  buffer.pending = candidates.slice(size);
  return {
    results,
    hasMore: buffer.pending.length > 0 || buffer.next !== null,
  };
}
