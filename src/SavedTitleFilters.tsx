import { useEffect, useEffectEvent, useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { t } from './i18n';
import TitleOriginFilters from './TitleOriginFilters';
import StreamingFilters, { useStreamingDirectory } from './StreamingFilters';
import MaxAgeFilter from './MaxAgeFilter';
import TitleGroupFilters, { type TitleGroups } from './TitleGroupFilters';
import './saved-title-filters.css';
import {
  isFilterableTitle,
  matchesSavedTitle,
  isFilmOrSeries,
  type RatingSource,
  type SavedTitle,
  type SavedTitleMetadata,
} from './saved-title-filters';

export function useSavedTitleFilters(titles: SavedTitle[], enabled: boolean, kind: string, onExpired: () => void) {
  const [year, setYear] = useState('');
  const [company, setCompany] = useState('');
  const [source, setSource] = useState<RatingSource>('');
  const [minimum, setMinimum] = useState(0);
  const [originalLanguage, setOriginalLanguage] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [groups, setGroups] = useState<TitleGroups>({ franchise: '', universe: '' });
  const [watchRegion, setWatchRegion] = useState('BR');
  const [watchServices, setWatchServices] = useState<number[]>([]);
  const [watchAccess, setWatchAccess] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    metadata: Map<string, SavedTitleMetadata>;
    incomplete: boolean;
  }>();
  const expired = useEffectEvent(onExpired);
  const companies = enabled && Boolean(company.trim());
  const publicSource = enabled && (source === 'critic' || source === 'community') ? source : '';
  const allowScreenFilters = ['all', 'movie', 'series'].includes(kind);
  const origin = enabled && allowScreenFilters && Boolean(originalLanguage || originCountry);
  const ageRating = enabled && allowScreenFilters && maxAge !== '';
  const franchise = enabled ? groups.franchise : '';
  const universe = enabled && allowScreenFilters ? groups.universe : '';
  const grouped = Boolean(franchise || universe);
  const streaming = enabled && allowScreenFilters && Boolean(watchServices.length || watchAccess.length);
  const region = streaming ? watchRegion : '';
  const services = streaming ? watchServices.join(',') : '';
  const access = streaming ? watchAccess.join(',') : '';
  const references = (companies || publicSource || origin || streaming || ageRating || grouped)
    ? [...new Set(titles
        .filter(title => (!year || title.year === year) && (!(origin || streaming || ageRating || universe) || isFilmOrSeries(title)))
        .map(title => title.catalogId)
        .filter((id): id is string => typeof id === 'string' && /^(tmdb:(movie|series)|igdb:game):[1-9]\d{0,14}$/.test(id)))].sort().join(',')
    : '';
  const key = JSON.stringify([references, companies, publicSource, origin, ageRating, franchise, universe, region, services, access, revision]);
  useEffect(() => {
    if (!references) return;
    const controller = new AbortController();
    // Os lotes são deduplicados por obra e disparados só quando um filtro precisa de dados externos.
    const load = async () => {
      const keys = references.split(',');
      const metadata = new Map<string, SavedTitleMetadata>();
      let incomplete = false;
      for (let index = 0; index < keys.length; index += 25) {
        const query = new URLSearchParams({ ids: keys.slice(index, index + 25).join(',') });
        if (companies) query.set('companies', '1');
        if (origin) query.set('origin', '1');
        if (ageRating) query.set('ageRating', '1');
        if (franchise) query.set('franchise', franchise);
        if (universe) query.set('universe', universe);
        if (region) query.set('watchRegion', region);
        if (services) query.set('streamingProviders', services);
        if (access) query.set('watchAccess', access);
        if (publicSource) query.set('ratingSource', publicSource);
        try {
          const response = await fetch('/api/catalog/collection-filters?' + query, {
            credentials: 'same-origin',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]),
          });
          if (response.status === 401) { expired(); return; }
          if (!response.ok) {
            incomplete = true;
            if (response.status === 429) break;
            continue;
          }
          const data = await response.json() as {
            titles: (SavedTitleMetadata & { catalogId: string })[];
            incomplete: boolean;
          };
          incomplete ||= data.incomplete;
          for (const row of data.titles) metadata.set(row.catalogId, row);
        } catch {
          if (controller.signal.aborted) return;
          incomplete = true;
        }
      }
      if (!controller.signal.aborted) setLoaded({ key, metadata, incomplete });
    };
    // Uma seleção múltipla pode mudar várias vezes antes de terminar; evita iniciar lotes intermediários.
    const timer = window.setTimeout(() => void load(), region ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [references, companies, publicSource, origin, ageRating, franchise, universe, region, services, access, key]);

  const current = references && loaded?.key === key ? loaded : undefined;
  return {
    years: [...new Set(titles.filter(isFilterableTitle).map(title => title.year || '')
      .filter(value => /^\d{4}$/.test(value)))].sort((a, b) => Number(b) - Number(a)),
    year, setYear, company, setCompany, source, minimum, setMinimum, maxAge, setMaxAge, groups, setGroups,
    kind, allowScreenFilters, originalLanguage, setOriginalLanguage, originCountry, setOriginCountry, onExpired,
    watchRegion, watchServices, setWatchServices, watchAccess, setWatchAccess,
    setWatchRegion(value: string) {
      setWatchRegion(value);
      setWatchServices([]);
    },
    setSource(value: RatingSource) {
      setSource(value);
      setMinimum(value === 'critic' ? 70 : 3);
    },
    loading: Boolean(references && !current),
    incomplete: Boolean(current?.incomplete),
    retry: () => setRevision(value => value + 1),
    matches(title: SavedTitle, personal?: number) {
      return !enabled || matchesSavedTitle(title, {
        year, company, source, minimum,
        originalLanguage: allowScreenFilters ? originalLanguage : '',
        originCountry: allowScreenFilters ? originCountry : '',
        streaming,
        maxAge: ageRating ? Number(maxAge) : undefined,
        grouped,
      },
        title.catalogId ? current?.metadata.get(title.catalogId) : undefined, personal);
    },
  };
}

export default function SavedTitleFilters({ filters, leading }: {
  filters: ReturnType<typeof useSavedTitleFilters>;
  leading?: ReactNode;
}) {
  const id = useId();
  const [streamingOpen, setStreamingOpen] = useState(false);
  const streamingDirectory = useStreamingDirectory(streamingOpen && filters.allowScreenFilters, filters.kind, filters.watchRegion, filters.onExpired);
  const values = filters.source === 'critic'
    ? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    : filters.source === 'community' ? [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] : [1, 2, 3, 4, 5];
  return (
    <div className="saved-title-filters" aria-busy={filters.loading}>
      {leading}
      <div>
        <label htmlFor={id + '-year'}>{t('Ano de lançamento')}</label>
        <NativeSelect id={id + '-year'} value={filters.year} onChange={event => filters.setYear(event.target.value)}>
          <option value="">{t('Todos os anos')}</option>
          {filters.year && !filters.years.includes(filters.year) && <option value={filters.year}>{filters.year}</option>}
          {filters.years.map(year => <option key={year} value={year}>{year}</option>)}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor={id + '-company'}>{t('Produtora ou desenvolvedora')}</label>
        <Input id={id + '-company'} value={filters.company} onChange={event => filters.setCompany(event.target.value)} />
      </div>
      <div>
        <label htmlFor={id + '-source'}>{t('Fonte da avaliação')}</label>
        <NativeSelect id={id + '-source'} value={filters.source} onChange={event => filters.setSource(event.target.value as RatingSource)}>
          <option value="">{t('Todas as avaliações')}</option>
          <option value="critic">{t('Crítica')}</option>
          <option value="community">{t('Comunidade')}</option>
          <option value="personal">{t('Minha nota')}</option>
        </NativeSelect>
      </div>
      {filters.source && <div>
        <label htmlFor={id + '-minimum'}>{t('Nota mínima')}</label>
        <NativeSelect id={id + '-minimum'} value={filters.minimum} onChange={event => filters.setMinimum(Number(event.target.value))}>
          {values.map(value => <option key={value} value={value}>
            {new Intl.NumberFormat().format(value)}/{filters.source === 'critic' ? 100 : 5}
          </option>)}
        </NativeSelect>
      </div>}
      {filters.allowScreenFilters && <MaxAgeFilter value={filters.maxAge} onChange={filters.setMaxAge} />}
      <TitleGroupFilters value={filters.groups} allowUniverse={filters.allowScreenFilters} onApply={filters.setGroups} />
      {filters.allowScreenFilters && <TitleOriginFilters
        originalLanguage={filters.originalLanguage}
        originCountry={filters.originCountry}
        onLanguage={filters.setOriginalLanguage}
        onCountry={filters.setOriginCountry}
        onExpired={filters.onExpired}
      />}
      {filters.allowScreenFilters && <StreamingFilters
        country={filters.watchRegion}
        services={filters.watchServices}
        access={filters.watchAccess}
        directory={streamingDirectory}
        onOpen={setStreamingOpen}
        onCountry={filters.setWatchRegion}
        onServices={filters.setWatchServices}
        onAccess={filters.setWatchAccess}
      />}
      {filters.incomplete && (
        <div className="saved-title-filter-warning" role="status">
          {t('Alguns metadados não puderam ser carregados.')}
          <Button type="button" variant="ghost" onClick={filters.retry}>{t('Tentar novamente')}</Button>
        </div>
      )}
    </div>
  );
}
