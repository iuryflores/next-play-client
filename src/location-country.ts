type Ring = number[][];
export type CountryBoundary = { code: string; polygons: Ring[][] };
// O resultado é uma estimativa cartográfica. Nunca deduz país pelo idioma ou pelo fuso.
function insideRing(ring: Ring, latitude: number, longitude: number) {
  let min = Infinity,
    max = -Infinity;
  for (const point of ring) {
    min = Math.min(min, point[0]);
    max = Math.max(max, point[0]);
  }
  const crossesDateLine = max - min > 180;
  const x = (value: number) =>
    crossesDateLine && value < 0 ? value + 360 : value;
  const target = x(longitude);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [rawX, y] = ring[i],
      [rawPreviousX, previousY] = ring[j],
      currentX = x(rawX),
      previousX = x(rawPreviousX);
    if (
      y > latitude !== previousY > latitude &&
      target <
        ((previousX - currentX) * (latitude - y)) / (previousY - y) + currentX
    )
      inside = !inside;
  }
  return inside;
}
export function countryForCoordinates(
  countries: CountryBoundary[],
  latitude: number,
  longitude: number,
): string | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  for (const country of countries)
    for (const polygon of country.polygons) {
      if (
        polygon.length &&
        insideRing(polygon[0], latitude, longitude) &&
        !polygon.slice(1).some((hole) => insideRing(hole, latitude, longitude))
      )
        return country.code;
    }
  // Limites simplificados podem deixar cidades costeiras fora da linha do mapa.
  // Só aproxima à costa mais próxima até 5 km; mar aberto continua sem país estimado.
  const longitudeDelta = (value: number) => ((value + 540) % 360) - 180;
  const longitudeScale =
    111.32 * Math.max(0.001, Math.cos((latitude * Math.PI) / 180));
  let closest = 5,
    code: string | null = null;
  for (const country of countries)
    for (const polygon of country.polygons) {
      const ring = polygon[0] || [];
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1],
          b = ring[i],
          first = longitudeDelta(a[0] - longitude),
          second = first + longitudeDelta(b[0] - a[0]);
        const x = first * longitudeScale,
          y = (a[1] - latitude) * 111.32,
          dx = (second - first) * longitudeScale,
          dy = (b[1] - a[1]) * 111.32;
        const length = dx * dx + dy * dy,
          ratio = length
            ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length))
            : 0;
        const distance = Math.hypot(x + ratio * dx, y + ratio * dy);
        if (distance < closest) {
          closest = distance;
          code = country.code;
        }
      }
    }
  if (code) return code;
  return null;
}
type LocationBrowser = {
  geolocation?: Pick<Geolocation, 'getCurrentPosition'>;
  permissions?: {
    query: (descriptor: { name: 'geolocation' }) => Promise<{ state: string }>;
  };
};
type BoundaryLoader = () => Promise<CountryBoundary[]>;
export async function locateCountry(
  browser: LocationBrowser,
  load: BoundaryLoader,
  requestPermission: boolean,
): Promise<string | null> {
  if (!browser.geolocation) return null;
  if (!requestPermission) {
    if (!browser.permissions) return null;
    try {
      if (
        (await browser.permissions.query({ name: 'geolocation' })).state !==
        'granted'
      )
        return null;
    } catch {
      return null;
    }
  }
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    browser.geolocation!.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 8000,
    }),
  );
  const boundaries = await load();
  // Coordenadas só são usadas em memória no navegador; ao servidor de disponibilidade vai apenas o país.
  return countryForCoordinates(
    boundaries,
    position.coords.latitude,
    position.coords.longitude,
  );
}
let boundaries: Promise<CountryBoundary[]> | undefined;
function loadBoundaries() {
  boundaries ??= fetch('/data/countries.v1.json', {
    signal: AbortSignal.timeout(15000),
  })
    .then(async (response) => {
      if (!response.ok) throw Error('country-data');
      const data = await response.json();
      if (!Array.isArray(data.countries)) throw Error('country-data');
      return data.countries as CountryBoundary[];
    })
    .catch((reason) => {
      boundaries = undefined;
      throw reason;
    });
  return boundaries;
}
let cached: { code: string; until: number } | undefined;
let pending:
  | { interactive: boolean; promise: Promise<string | null> }
  | undefined;
export function detectLocationCountry(
  requestPermission = false,
): Promise<string | null> {
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.code);
  if (pending) {
    if (requestPermission && !pending.interactive)
      return pending.promise
        .catch(() => null)
        .then((code) => code || detectLocationCountry(true));
    return pending.promise;
  }
  // Só uma consulta de localização por vez; a estimativa é reutilizada durante cinco minutos na sessão.
  const work = locateCountry(navigator, loadBoundaries, requestPermission).then(
    (code) => {
      if (code) cached = { code, until: Date.now() + 300000 };
      return code;
    },
  );
  const request = { interactive: requestPermission, promise: work };
  pending = request;
  request.promise = work.finally(() => {
    if (pending === request) pending = undefined;
  });
  return request.promise;
}
