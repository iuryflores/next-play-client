import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// Base pública vendorizada: o navegador só consulta arquivos do próprio app, sem enviar coordenadas.
const source =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const response = await fetch(source, { signal: AbortSignal.timeout(45000) });
if (!response.ok)
  throw new Error(
    'Não foi possível baixar a base de países: ' + response.status,
  );
const raw = await response.text();
if (raw.length > 20_000_000) throw new Error('Base inesperadamente grande.');
const data = JSON.parse(raw);
if (data.type !== 'FeatureCollection' || !Array.isArray(data.features))
  throw new Error('GeoJSON inválido.');
const countries = data.features.flatMap((feature) => {
  const properties = feature.properties || {};
  const code = [properties.ISO_A2_EH, properties.ISO_A2, properties.WB_A2].find(
    (value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value),
  );
  if (!code || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type))
    return [];
  return [
    {
      code,
      polygons:
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates,
    },
  ];
});
if (countries.length < 200) throw new Error('Base incompleta.');
const directory = new URL('../public/data/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL('countries.v1.json', directory),
  JSON.stringify({
    source,
    license: 'Public domain — Natural Earth',
    scale: '1:50m',
    sourceSha256: createHash('sha256').update(raw).digest('hex'),
    countries,
  }),
);
await writeFile(
  new URL('countries.LICENSE.txt', directory),
  'Natural Earth — public domain.\nSource: ' +
    source +
    '\nTerms: https://www.naturalearthdata.com/about/terms-of-use/\nOnly country codes and polygon coordinates are retained. Generalized boundaries estimate a country; they do not determine precise borders or legal jurisdiction.\n',
);
console.log('Base preparada: ' + countries.length + ' feições de países.');
