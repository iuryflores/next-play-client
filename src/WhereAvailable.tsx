import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ExternalLink, Gamepad2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { t, language } from './i18n';
import { detectLocationCountry } from './location-country';
import './where-available.css';
type Availability = {
  kind: string;
  source: 'igdb' | 'tmdb-justwatch';
  country: string | null;
  platforms: string[];
  stores: { name: string; url: string }[];
  groups: {
    type: string;
    providers: { id: number; name: string; logo: string }[];
  }[];
  link: string | null;
  checkedAt: string;
};
const groups: Record<string, string> = {
  flatrate: 'Assinatura',
  free: 'Grátis',
  ads: 'Grátis com anúncios',
  rent: 'Alugar',
  buy: 'Comprar',
};
function Results({
  catalogId,
  country,
  onExpired,
}: {
  catalogId: string;
  country: string;
  onExpired: () => void;
}) {
  const [data, setData] = useState<Availability | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      '/api/catalog/availability?' +
        new URLSearchParams({ catalogId, country }),
      {
        credentials: 'same-origin',
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(20000),
        ]),
      },
    )
      .then(async (response) => {
        if (response.status === 401) {
          if (!controller.signal.aborted) expired();
          return;
        }
        if (!response.ok) throw Error();
        const value = await response.json();
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [catalogId, country, retry]);
  if (error)
    return (
      <div>
        <p role="alert">
          {t('Não foi possível consultar a disponibilidade agora.')}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setError(false);
            setData(null);
            setRetry((value) => value + 1);
          }}
        >
          {t('Tentar novamente')}
        </Button>
      </div>
    );
  if (!data) return <output>{t('Consultando disponibilidade…')}</output>;
  return (
    <>
      {data.source === 'igdb' ? (
        <>
          {data.platforms.length > 0 && (
            <>
              <h3>{t('Plataformas')}</h3>
              <div className="where-platforms">
                {data.platforms.map((platform) => (
                  <span key={platform}>
                    <Gamepad2 aria-hidden="true" />
                    {platform}
                  </span>
                ))}
              </div>
            </>
          )}
          {data.stores.length > 0 && (
            <>
              <h3>{t('Lojas')}</h3>
              <div className="where-links">
                {data.stores.map((store) => (
                  <a
                    key={store.url}
                    href={store.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {store.name}
                    <ExternalLink aria-hidden="true" />
                  </a>
                ))}
              </div>
            </>
          )}
          {!data.platforms.length && !data.stores.length && (
            <p>
              {t(
                'A IGDB ainda não informou plataformas ou lojas para este jogo.',
              )}
            </p>
          )}
          <p className="where-note">
            {t(
              'Plataformas e links informados pela IGDB. Não confirma inclusão em Game Pass/PS Plus, preço, estoque ou disponibilidade na sua região.',
            )}
          </p>
        </>
      ) : (
        <>
          {/* Um serviço pode aparecer em várias ofertas; a tag reúne os tipos sem repetir o nome. */}
          <ul className="where-providers">
            {Array.from(
              new Map(
                data.groups.flatMap((group) =>
                  group.providers.map(
                    (provider) => [provider.id, provider] as const,
                  ),
                ),
              ).values(),
            ).map((provider) => {
              const offers = data.groups
                .filter((group) =>
                  group.providers.some((item) => item.id === provider.id),
                )
                .map((group) => t(groups[group.type] || group.type))
                .join(' · ');
              return (
                <li key={provider.id}>
                  <a
                    href={data.link || 'https://www.justwatch.com/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={offers}
                    aria-label={`${provider.name}: ${offers}`}
                  >
                    {provider.name}
                  </a>
                </li>
              );
            })}
          </ul>
          {!data.groups.length && (
            <p>
              {t(
                'Nenhuma opção informada para este país. Isso não confirma que o título esteja indisponível.',
              )}
            </p>
          )}
          <p className="where-note">
            {t('Dados de disponibilidade:')}{' '}
            <a
              href="https://www.justwatch.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              JustWatch
            </a>
            , via TMDB.
          </p>
        </>
      )}
      {data.source === 'igdb' && (
        <small className="where-note">
          {t(
            'Consulta ao catálogo em {0}',
            new Date(data.checkedAt).toLocaleString(language),
          )}
        </small>
      )}
    </>
  );
}
export default function WhereAvailable({
  catalogId,
  kind,
  onExpired,
}: {
  catalogId?: string;
  kind: string;
  onExpired: () => void;
}) {
  const [country, setCountry] = useState('BR');
  const [ready, setReady] = useState(false),
    [locating, setLocating] = useState(false),
    [locationNotice, setLocationNotice] = useState('');
  const locationAttempt = useRef(0);
  const supported =
    !!catalogId &&
    /^(tmdb:(movie|series)|igdb:game):[1-9]\d{0,14}$/.test(catalogId);
  useEffect(() => {
    if (kind === 'game' || kind === 'book' || !supported) return;
    let active = true;
    const attempt = locationAttempt.current;
    void detectLocationCountry(false)
      .then((code) => {
        if (active && attempt === locationAttempt.current && code) {
          setCountry(code);
          setLocationNotice(
            t(
              'País estimado pela sua localização. Você pode alterar manualmente.',
            ),
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [kind, supported]);
  function locate() {
    const attempt = ++locationAttempt.current;
    setLocating(true);
    setLocationNotice('');
    void detectLocationCountry(true)
      .then((code) => {
        if (attempt !== locationAttempt.current) return;
        if (code) {
          setCountry(code);
          setLocationNotice(
            t(
              'País estimado pela sua localização. Você pode alterar manualmente.',
            ),
          );
        } else
          setLocationNotice(
            t(
              'Não foi possível identificar o país. Mantenha ou altere a seleção manual.',
            ),
          );
      })
      .catch(() => {
        if (attempt === locationAttempt.current)
          setLocationNotice(
            t(
              'Localização não permitida ou indisponível. Mantenha ou altere o país manualmente.',
            ),
          );
      })
      .finally(() => {
        if (attempt === locationAttempt.current) {
          setLocating(false);
          setReady(true);
        }
      });
  }
  if (kind === 'book') return null;
  return (
    <section
      className="where-available"
      aria-label={t(kind === 'game' ? 'Onde jogar' : 'Where to watch')}
    >
      <header>
        <h2>{t(kind === 'game' ? 'Onde jogar' : 'Where to watch')}</h2>
      </header>
      {kind !== 'game' && supported && (
        <details className="where-settings">
          <summary>
            {t('País')}: {country}
          </summary>
          <label>
            {t('País')}
            <NativeSelect
              value={country}
              onChange={(event) => {
                ++locationAttempt.current;
                setCountry(event.target.value);
                setReady(true);
                setLocating(false);
                setLocationNotice('');
              }}
            >
              {![
                'BR',
                'PT',
                'US',
                'ES',
                'GB',
                'CA',
                'AR',
                'MX',
                'FR',
                'DE',
                'JP',
              ].includes(country) && (
                <option value={country}>
                  {new Intl.DisplayNames([language], { type: 'region' }).of(
                    country,
                  ) || country}
                </option>
              )}
              {[
                ['BR', 'Brasil'],
                ['PT', 'Portugal'],
                ['US', 'Estados Unidos'],
                ['ES', 'Espanha'],
                ['GB', 'Reino Unido'],
                ['CA', 'Canadá'],
                ['AR', 'Argentina'],
                ['MX', 'México'],
                ['FR', 'França'],
                ['DE', 'Alemanha'],
                ['JP', 'Japão'],
              ].map(([code, name]) => (
                <option value={code} key={code}>
                  {t(name)}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button variant="outline" disabled={locating} onClick={locate}>
            <MapPin aria-hidden="true" />
            {t(locating ? 'Identificando país…' : 'Usar minha localização')}
          </Button>
          {locationNotice && (
            <output className="where-note">{locationNotice}</output>
          )}
          <small className="where-note">
            {t(
              'A localização só é solicitada com sua permissão. As coordenadas são processadas no navegador para estimar o país.',
            )}{' '}
            <a
              href="https://www.naturalearthdata.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Natural Earth
            </a>
            .
          </small>
        </details>
      )}
      {supported ? (
        kind !== 'game' && (!ready || locating) ? (
          <output>{t('Identificando país…')}</output>
        ) : (
          <Results
            key={catalogId + country}
            catalogId={catalogId!}
            country={country}
            onExpired={onExpired}
          />
        )
      ) : (
        <p>
          {t(
            'Disponibilidade não disponível para títulos sem vínculo com o catálogo.',
          )}
        </p>
      )}
    </section>
  );
}
