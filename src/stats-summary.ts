export function orderRanking<T>(
  entries: readonly T[],
  positions: Record<string, number> | undefined,
  key: (entry: T) => string | number,
) {
  return [...entries].sort(
    (a, b) =>
      (positions?.[key(a)] ?? Number.MAX_SAFE_INTEGER) -
      (positions?.[key(b)] ?? Number.MAX_SAFE_INTEGER),
  );
}
type Item = {
  kind: string;
  status: string;
  genres?: string[];
  platform?: string;
  stars?: number;
  feeling?: string;
  episodeProgress?: { watched: number };
};
export function gameGenreName(name: string) {
  const labels: Record<string, string> = {
    fighting: 'Luta',
    luta: 'Luta',
    adventure: 'Aventura',
    aventura: 'Aventura',
    'role-playing (rpg)': 'RPG',
    rpg: 'RPG',
    shooter: 'Tiro',
    tiro: 'Tiro',
    platform: 'Plataforma',
    plataforma: 'Plataforma',
    racing: 'Corrida',
    corrida: 'Corrida',
    sport: 'Esporte',
    esporte: 'Esporte',
    strategy: 'Estratégia',
    estratégia: 'Estratégia',
    simulator: 'Simulação',
    simulação: 'Simulação',
    puzzle: 'Quebra-cabeça',
    music: 'Música',
    indie: 'Indie',
    arcade: 'Arcade',
  };
  return labels[name.trim().toLowerCase()] || name.trim();
}
export type ActorVoteSource = {
  itemId: string;
  title: string;
  kind: string;
  count: number;
};
type ActorVotes = {
  sources?: ActorVoteSource[];
  id: string;
  name: string;
  photo: string;
  kind: string;
  count: number;
};
export function summarizeActors(entries: readonly ActorVotes[]) {
  const actors = new Map<string, Omit<ActorVotes, 'kind'>>();
  for (const entry of entries) {
    if (entry.kind !== 'movie' && entry.kind !== 'series') continue;
    const actor = actors.get(entry.id) || {
      id: entry.id,
      name: entry.name,
      photo: entry.photo,
      count: 0,
    };
    actor.count += entry.count;
    if (entry.sources?.length) {
      actor.sources ||= [];
      for (const source of entry.sources) {
        const existing = actor.sources.find(
          (value) => value.itemId === source.itemId,
        );
        if (existing) existing.count += source.count;
        else actor.sources.push({ ...source });
      }
      actor.sources.sort(
        (a, b) => b.count - a.count || a.title.localeCompare(b.title),
      );
    }
    if (!actor.photo && entry.photo) actor.photo = entry.photo;
    actors.set(entry.id, actor);
  }
  return [...actors.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}
export function summarizeKind(items: readonly Item[], kind: string) {
  const selected = items.filter((item) => item.kind === kind);
  const finished = selected.filter((item) => item.status === 'completed');
  const watched = selected.filter(
    (item) =>
      item.status === 'completed' ||
      (kind === 'series' && (item.episodeProgress?.watched || 0) > 0),
  );
  const normalize = (name: string) =>
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const genres = (source: Item[]) => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const item of source) {
      const unique = new Map(
        (item.genres || [])
          .map((name) => (kind === 'game' ? gameGenreName(name) : name))
          .filter((name) => name.trim())
          .map((name) => [normalize(name), name.trim()]),
      );
      for (const [key, name] of unique) {
        const entry = counts.get(key) || { name, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  };
  const ratings = finished.filter((item) => (item.stars || 0) > 0);
  const platforms = (source: Item[]) => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const item of source) {
      if (!item.platform?.trim()) continue;
      const key = normalize(item.platform);
      const entry = counts.get(key) || { name: item.platform.trim(), count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  };
  const feelings = new Map<string, number>();
  for (const item of finished)
    if (item.feeling)
      feelings.set(item.feeling, (feelings.get(item.feeling) || 0) + 1);
  return {
    total: selected.length,
    completed: finished.length,
    active: selected.filter((item) => item.status === 'active').length,
    average: ratings.length
      ? ratings.reduce((sum, item) => sum + item.stars!, 0) / ratings.length
      : null,
    rated: ratings.length,
    addedGenres: genres(selected),
    addedPlatforms: platforms(selected),
    completedPlatforms: platforms(finished),
    missingPlatforms: selected.filter((item) => !item.platform?.trim()).length,
    watchedGenres: genres(watched),
    feelings: [...feelings]
      .map(([feeling, count]) => ({ feeling, count }))
      .sort((a, b) => b.count - a.count),
  };
}
