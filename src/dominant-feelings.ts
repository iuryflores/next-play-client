export function dominantSeriesFeelings<
  T extends { itemId: string; kind: string; count: number },
>(sources: readonly T[]): T[] {
  const maximum = new Map<string, number>();
  for (const source of sources) {
    if (source.kind === 'series')
      maximum.set(
        source.itemId,
        Math.max(maximum.get(source.itemId) || 0, source.count),
      );
  }
  return sources.filter(
    (source) =>
      source.kind !== 'series' || source.count === maximum.get(source.itemId),
  );
}
