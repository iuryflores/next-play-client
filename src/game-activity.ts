type GameItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  playtimeMinutes?: number;
  platform?: string;
  coverUrl?: string;
};
export function gameActivity(items: readonly GameItem[]) {
  const games = items.filter((item) => item.kind === 'game');
  const minutes = (item: GameItem) =>
    Number.isSafeInteger(item.playtimeMinutes) &&
    item.playtimeMinutes! > 0 &&
    item.playtimeMinutes! <= 6000000
      ? item.playtimeMinutes!
      : 0;
  const platforms = new Map<string, { name: string; minutes: number }>();
  let totalMinutes = 0;
  for (const game of games) {
    const time = minutes(game);
    totalMinutes += time;
    if (!time) continue;
    // A plataforma é a escolhida no acompanhamento; variações de caixa/espaços não dividem o mesmo grupo.
    const name = (game.platform || '').trim().replace(/\s+/g, ' ');
    const key = name.toLocaleLowerCase('pt-BR');
    const platform = platforms.get(key) || { name, minutes: 0 };
    platform.minutes += time;
    platforms.set(key, platform);
  }
  // Inclui arquivados como o restante das estatísticas; ausência de tempo não significa jogo não iniciado.
  return {
    totalMinutes,
    recordedGames: games.filter((game) => minutes(game) > 0).length,
    planned: games.filter((game) => game.status === 'planned').length,
    completionRate: games.length
      ? Math.round(
          (games.filter((game) => game.status === 'completed').length /
            games.length) *
            100,
        )
      : 0,
    mostPlayed: games
      .filter((game) => minutes(game) > 0)
      .map((game) => ({ ...game, minutes: minutes(game) }))
      .sort(
        (a, b) =>
          b.minutes - a.minutes ||
          a.title.localeCompare(b.title, 'pt-BR') ||
          a.id.localeCompare(b.id),
      ),
    platforms: [...platforms.values()].sort(
      (a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'pt-BR'),
    ),
  };
}
