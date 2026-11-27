export type RatingSource = '' | 'critic' | 'community' | 'personal';
export type SavedTitle = {
  kind: string;
  year?: string;
  catalogId?: string;
  productionCompanies?: { name: string }[];
};
export type SavedTitleMetadata = {
  companies?: string[];
  rating?: number | null;
  originalLanguage?: string;
  originCountries?: string[];
  streamingMatch?: boolean;
  ageRating?: number | null;
  groupsMatch?: boolean;
};
export type SavedTitleFilter = {
  year: string;
  company: string;
  source: RatingSource;
  minimum: number;
  originalLanguage?: string;
  originCountry?: string;
  streaming?: boolean;
  maxAge?: number;
  grouped?: boolean;
};

export function isFilterableTitle(title: SavedTitle) {
  return ['movie', 'series', 'game'].includes(title.kind);
}

export function isFilmOrSeries(title: SavedTitle) {
  return title.kind === 'movie' || title.kind === 'series';
}

const normalized = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

export function matchesSavedTitle(
  title: SavedTitle,
  filter: SavedTitleFilter,
  metadata?: SavedTitleMetadata,
  personal?: number,
) {
  const company = normalized(filter.company);
  if (!filter.year && !company && !filter.source && !filter.originalLanguage && !filter.originCountry &&
      !filter.streaming && !filter.grouped && filter.maxAge === undefined) return true;
  if (!isFilterableTitle(title) || (filter.year && title.year !== filter.year)) return false;
  if (filter.grouped && metadata?.groupsMatch !== true) return false;
  if (filter.maxAge !== undefined) {
    // Livre é zero. Uma obra sem classificação confirmada não passa pelo limite.
    const age = metadata?.ageRating;
    if (!isFilmOrSeries(title) || typeof age !== 'number' || !Number.isFinite(age) || age > filter.maxAge) return false;
  }
  if (filter.streaming && (!isFilmOrSeries(title) || metadata?.streamingMatch !== true)) return false;
  if (filter.originalLanguage || filter.originCountry) {
    // A origem se aplica a filmes e séries vinculados. Coproduções podem ter vários países.
    if (!isFilmOrSeries(title) ||
        (filter.originalLanguage && metadata?.originalLanguage !== filter.originalLanguage) ||
        (filter.originCountry && !metadata?.originCountries?.includes(filter.originCountry))) return false;
  }
  const companies = metadata?.companies ?? title.productionCompanies?.map(value => value.name);
  if (company && !companies?.some(name => normalized(name).includes(company))) return false;
  if (!filter.source) return true;
  // A nota pessoal zero significa ausência. Uma nota zero da crítica é válida.
  const rating = filter.source === 'personal' ? personal : metadata?.rating;
  const isCritic = filter.source === 'critic';
  return typeof rating === 'number' && Number.isFinite(rating) &&
    rating >= Math.max(filter.minimum, isCritic ? 0 : 1) && rating <= (isCritic ? 100 : 5);
}
