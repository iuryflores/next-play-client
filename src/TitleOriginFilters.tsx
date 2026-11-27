import { useEffect, useEffectEvent, useId, useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { Button } from '@/components/ui/button';
import { language, t } from './i18n';
import './catalog-preview.css';

type OriginOptions = { languages: string[]; countries: string[] };

function labels(codes: string[], type: 'language' | 'region') {
  const names = new Intl.DisplayNames([language], { type });
  return codes.map(code => ({ code, label: names.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, language));
}

export default function TitleOriginFilters({
  originalLanguage, originCountry, onLanguage, onCountry, onExpired,
}: {
  originalLanguage: string;
  originCountry: string;
  onLanguage: (value: string) => void;
  onCountry: (value: string) => void;
  onExpired: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OriginOptions>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    if (!open || options) return;
    const controller = new AbortController();
    // Carrega o diretório só quando o painel é aberto, sem atrasar a lista principal.
    void fetch('/api/catalog/origin-options', {
      credentials: 'same-origin',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    }).then(async response => {
      if (response.status === 401) { if (!controller.signal.aborted) expired(); return; }
      if (!response.ok) throw new Error();
      const data = await response.json() as OriginOptions;
      if (!Array.isArray(data.languages) || !Array.isArray(data.countries)) throw new Error();
      if (!controller.signal.aborted) {
        setOptions(data);
        setError(false);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [open, options, revision]);

  const count = Number(Boolean(originalLanguage)) + Number(Boolean(originCountry));
  return (
    <details className="catalog-genre-filter title-origin-filter" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{t('Idioma e país de origem')}{count ? ` (${count})` : ''}</summary>
      {error ? (
        <p role="alert">
          {t('Não foi possível carregar idiomas e países.')}
          <Button type="button" variant="link" onClick={() => {
            setError(false);
            setRevision(value => value + 1);
          }}>{t('Tentar novamente')}</Button>
        </p>
      ) : options ? (
        <div className="catalog-origin-fields">
          <div className="catalog-filter-field">
            <label htmlFor={id + '-language'}>{t('Idioma original')}</label>
            <NativeSelect id={id + '-language'} value={originalLanguage} onChange={event => onLanguage(event.target.value)}>
              <option value="">{t('Todos os idiomas')}</option>
              {labels(options.languages, 'language').map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
            </NativeSelect>
          </div>
          <div className="catalog-filter-field">
            <label htmlFor={id + '-country'}>{t('País de origem')}</label>
            <NativeSelect id={id + '-country'} value={originCountry} onChange={event => onCountry(event.target.value)}>
              <option value="">{t('Todos os países')}</option>
              {labels(options.countries, 'region').map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
            </NativeSelect>
          </div>
        </div>
      ) : <p role="status">{t('Carregando idiomas e países…')}</p>}
    </details>
  );
}
