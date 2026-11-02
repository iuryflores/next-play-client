type GamePlatformItem = { kind: string; platform?: string };
export const missingPlatform = 'missing';
export function platformKey(value?: string) {
  const name = (value || '').trim().replace(/\s+/g, ' ');
  // Normaliza apenas grafia: consoles distintos e plataformas personalizadas continuam separados.
  return name
    ? 'platform:' +
        name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('pt-BR')
    : missingPlatform;
}
export function platformOptions(items: readonly GamePlatformItem[]) {
  const groups = new Map<
    string,
    { key: string; name: string; count: number }
  >();
  for (const item of items) {
    if (item.kind !== 'game') continue;
    const key = platformKey(item.platform);
    const group = groups.get(key) || {
      key,
      name: (item.platform || '').trim().replace(/\s+/g, ' '),
      count: 0,
    };
    group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(a.key === missingPlatform) - Number(b.key === missingPlatform) ||
      a.name.localeCompare(b.name, 'pt-BR'),
  );
}
export function matchesPlatform(item: GamePlatformItem, selected?: string) {
  return (
    !selected ||
    (item.kind === 'game' && platformKey(item.platform) === selected)
  );
}
