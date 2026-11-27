import { useEffect, useEffectEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ApiError } from './auth';
import { t } from './i18n';
import { watchCountries } from './watch-countries';
import './catalog-preview.css';

type DirectoryEntry = { kind: string; id: number; name: string };

export function useStreamingDirectory(open: boolean, kind: string, country: string, onExpired: () => void) {
  const [state, setState] = useState<{ key: string; providers?: DirectoryEntry[]; error?: boolean }>();
  const [revision, setRevision] = useState(0);
  const expired = useEffectEvent(onExpired);
  const key = `${kind}:${country}:${revision}`;
  const loaded = state?.key === key;
  useEffect(() => {
    if (!open || kind === 'game' || loaded) return;
    const controller = new AbortController();
    // O diretório segue o país e as categorias exibidas, inclusive nas telas com filmes e séries juntos.
    void Promise.all((kind === 'all' ? ['movie', 'series'] : [kind]).map(async category => {
      const query = new URLSearchParams({ kind: category, watchRegion: country });
      const response = await fetch('/api/catalog/streaming-providers?' + query, {
        credentials: 'same-origin',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      if (!response.ok) throw new ApiError(response.status, '');
      const data = await response.json() as { providers: { id: number; name: string }[] };
      if (!Array.isArray(data.providers)) throw new Error();
      return data.providers.map(provider => ({ ...provider, kind: category }));
    })).then(pages => {
      if (!controller.signal.aborted) setState({ key, providers: pages.flat() });
    }).catch(reason => {
      if (controller.signal.aborted) return;
      if (reason instanceof ApiError && reason.status === 401) expired();
      else setState({ key, error: true });
    });
    return () => controller.abort();
  }, [open, kind, country, key, loaded]);
  return {
    providers: loaded ? state.providers : undefined,
    error: loaded && state.error,
    retry: () => setRevision(value => value + 1),
  };
}

export default function StreamingFilters({
  country, services, access, directory, onOpen, onCountry, onServices, onAccess,
}: {
  country: string;
  services: number[];
  access: string[];
  directory: ReturnType<typeof useStreamingDirectory>;
  onOpen: (value: boolean) => void;
  onCountry: (value: string) => void;
  onServices: (value: number[]) => void;
  onAccess: (value: string[]) => void;
}) {
  const id = useId();
  const count = services.length + access.length;
  const providers = directory.providers && [...new Map(directory.providers.map(provider => [provider.id, provider])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <details className="catalog-genre-filter catalog-streaming-filter" onToggle={event => onOpen(event.currentTarget.open)}>
      <summary>{t('Serviços de streaming')}{count ? ` (${count})` : ''}</summary>
      <div className="catalog-filter-field">
        <label htmlFor={id}>{t('País')}</label>
        <NativeSelect id={id} value={country} onChange={event => onCountry(event.target.value)}>
          {watchCountries.map(([code, name]) => <option key={code} value={code}>{t(name)}</option>)}
        </NativeSelect>
      </div>
      <fieldset className="catalog-watch-access">
        <legend>{t('Forma de acesso')}</legend>
        <div className="catalog-genre-options">
          {([
            ['free', t('Grátis (com ou sem anúncios)')],
            ['rent', t('Aluguel')],
            ['buy', t('Compra')],
            ['subscription', t('Assinatura')],
          ] as const).map(([mode, label]) => (
            <label key={mode}>
              <input type="checkbox" checked={access.includes(mode)} onChange={() =>
                onAccess(access.includes(mode) ? access.filter(value => value !== mode) : [...access, mode])
              } />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p>{t('Selecione até 8 serviços. Sem forma de acesso selecionada, o filtro por serviços usa assinatura.')}</p>
      {directory.error ? (
        <p role="alert">
          {t('Não foi possível carregar os serviços de streaming.')}
          <Button type="button" variant="link" onClick={directory.retry}>{t('Tentar novamente')}</Button>
        </p>
      ) : !providers ? (
        <p role="status">{t('Carregando serviços de streaming…')}</p>
      ) : !providers.length ? (
        <p>{t('Nenhum serviço de streaming encontrado para este país.')}</p>
      ) : (
        <div className="catalog-genre-options">
          {providers.map(provider => (
            <label key={provider.id}>
              <input type="checkbox" checked={services.includes(provider.id)}
                disabled={services.length >= 8 && !services.includes(provider.id)}
                onChange={() => onServices(services.includes(provider.id)
                  ? services.filter(value => value !== provider.id) : [...services, provider.id])}
              />
              {provider.name}
            </label>
          ))}
        </div>
      )}
      {services.length > 0 && (
        <Button type="button" variant="ghost" onClick={() => onServices([])}>{t('Limpar serviços')}</Button>
      )}
      <p>
        {t('Dados de disponibilidade fornecidos por')}{' '}
        <a href="https://www.justwatch.com/" target="_blank" rel="noreferrer">JustWatch</a>
      </p>
    </details>
  );
}
