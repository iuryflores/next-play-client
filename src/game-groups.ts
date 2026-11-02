type Part = {
  id: string;
  kind: string;
  catalogId?: string;
  parentGameCatalogId?: string;
  archived?: boolean;
  status: string;
  playtimeMinutes?: number;
  lastPlayedOn?: string | null;
};
export function groupGames<T extends Part>(
  items: readonly T[],
): (T & { gameParts?: T[] })[] {
  const games = new Map(
    items
      .filter((item) => item.kind === 'game' && item.catalogId)
      .map((item) => [item.catalogId!, item]),
  );
  const root = (item: T) => {
    let current = item;
    const seen = new Set<string>([item.id]);
    while (current.parentGameCatalogId) {
      const parent = games.get(current.parentGameCatalogId);
      // Sem pai acompanhado, ou arquivado separadamente, a parte continua acessível em seu próprio card.
      if (!parent || Boolean(parent.archived) !== Boolean(item.archived)) break;
      if (seen.has(parent.id)) return item;
      seen.add(parent.id);
      current = parent;
    }
    return current;
  };
  const groups = new Map<string, T[]>();
  for (const item of items)
    if (item.kind === 'game') {
      const id = root(item).id;
      const parts = groups.get(id) || [];
      parts.push(item);
      groups.set(id, parts);
    }
  return items.flatMap((item) => {
    if (item.kind !== 'game') return [item];
    const parts = groups.get(item.id);
    if (!parts) return [];
    if (parts.length === 1) return [item];
    // Total é apenas apresentação: cada sessão/estatística/XP continua usando os registros originais.
    const ordered = [item, ...parts.filter((part) => part.id !== item.id)];
    const status = parts.some((part) => part.status === 'active')
      ? 'active'
      : parts.some((part) => part.status === 'planned')
        ? 'planned'
        : 'completed';
    const dates = parts
      .flatMap((part) => (part.lastPlayedOn ? [part.lastPlayedOn] : []))
      .sort();
    return [
      {
        ...item,
        gameParts: ordered,
        status,
        playtimeMinutes: parts.reduce(
          (sum, part) => sum + Math.max(0, part.playtimeMinutes || 0),
          0,
        ),
        lastPlayedOn: dates.at(-1) || null,
      },
    ];
  });
}
