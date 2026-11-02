export type Episode = {
  number: number;
  name: string;
  airDate: string;
  overview?: string;
  stillUrl?: string;
  runtime?: number | null;
  watchedAt: string | null;
  watched?: boolean;
  watchedDateUnknown?: boolean;
  stars?: number;
  feeling?: string;
  favoriteCharacter?: string;
  favoriteCastId?: string;
  votes?: { name: string; count: number }[];
};
export type Season = {
  number: number;
  name: string;
  total: number;
  loaded: boolean;
  episodes: Episode[];
};
export type EpisodeData = { supported: boolean; seasons: Season[] };
export type EpisodeSelection = { season: number; episode: number | null };
export function nextEpisode(data: EpisodeData): EpisodeSelection | null {
  for (const season of [...data.seasons]
    .filter((season) => season.number > 0)
    .sort((a, b) => a.number - b.number)) {
    if (!season.loaded) return { season: season.number, episode: null };
    const episode = [...season.episodes]
      .sort((a, b) => a.number - b.number)
      .find(
        (episode) =>
          !(episode.watched || episode.watchedAt || episode.watchedDateUnknown),
      );
    if (episode) return { season: season.number, episode: episode.number };
  }
  return null;
}
export function hasEarlierUnwatched(
  data: EpisodeData,
  target: { season: number; episode: number },
): boolean {
  return data.seasons.some((season) => {
    if (
      target.season === 0
        ? season.number !== 0
        : season.number <= 0 || season.number > target.season
    )
      return false;
    if (!season.loaded) return season.number < target.season;
    return season.episodes.some(
      (episode) =>
        (season.number < target.season || episode.number < target.episode) &&
        !(episode.watched || episode.watchedAt || episode.watchedDateUnknown),
    );
  });
}
