import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  countryForCoordinates,
  locateCountry,
  detectLocationCountry,
} from '../src/location-country.ts';
const boundaries = JSON.parse(
  await readFile(
    new URL('../public/data/countries.v1.json', import.meta.url),
    'utf8',
  ),
).countries;
test('localização reconhece países reais sem inferir idioma, inclusive França/Noruega e coordenadas no hemisfério sul', () => {
  for (const [latitude, longitude, country] of [
    [-16.6869, -49.2648, 'BR'],
    [-23.5505, -46.6333, 'BR'],
    [40.7128, -74.006, 'US'],
    [38.7223, -9.1393, 'PT'],
    [48.8566, 2.3522, 'FR'],
    [59.9139, 10.7522, 'NO'],
    [35.6762, 139.6503, 'JP'],
    [51.5074, -0.1278, 'GB'],
    [43.6532, -79.3832, 'CA'],
    [1.3521, 103.8198, 'SG'],
  ])
    assert.equal(
      countryForCoordinates(boundaries, latitude, longitude),
      country,
      `${latitude},${longitude}`,
    );
  for (const [latitude, longitude] of [
    [91, 0],
    [0, 181],
    [NaN, 0],
    [0, Infinity],
  ])
    assert.equal(countryForCoordinates(boundaries, latitude, longitude), null);
  assert.equal(
    countryForCoordinates(boundaries, 0, -140),
    null,
    'oceano sem país não vira palpite por idioma',
  );
});
test('polígonos respeitam buracos, ilhas e a mudança de longitude no antimeridiano', () => {
  const countries = [
    {
      code: 'AA',
      polygons: [
        [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [3, 3],
            [7, 3],
            [7, 7],
            [3, 7],
            [3, 3],
          ],
        ],
      ],
    },
    {
      code: 'BB',
      polygons: [
        [
          [
            [3, 3],
            [7, 3],
            [7, 7],
            [3, 7],
            [3, 3],
          ],
        ],
      ],
    },
    {
      code: 'CC',
      polygons: [
        [
          [
            [179, -1],
            [-179, -1],
            [-179, 1],
            [179, 1],
            [179, -1],
          ],
        ],
      ],
    },
  ];
  assert.equal(countryForCoordinates(countries, 1, 1), 'AA');
  assert.equal(countryForCoordinates(countries, 5, 5), 'BB');
  assert.equal(countryForCoordinates(countries, 0, 179.5), 'CC');
  assert.equal(countryForCoordinates(countries, 0, -179.5), 'CC');
  assert.equal(countryForCoordinates(countries, 0, 20), null);
});
test('abertura não pede localização sem permissão prévia; detecção explícita respeita recusa e falta de suporte', async () => {
  let calls = 0,
    loads = 0;
  const geolocation = {
    getCurrentPosition(success) {
      calls++;
      success({ coords: { latitude: -23.5505, longitude: -46.6333 } });
    },
  };
  const load = async () => {
    loads++;
    return boundaries;
  };
  for (const state of ['prompt', 'denied'])
    assert.equal(
      await locateCountry(
        { geolocation, permissions: { query: async () => ({ state }) } },
        load,
        false,
      ),
      null,
    );
  assert.equal(await locateCountry({ geolocation }, load, false), null);
  assert.equal(calls, 0);
  assert.equal(loads, 0);
  assert.equal(
    await locateCountry(
      {
        geolocation,
        permissions: { query: async () => ({ state: 'granted' }) },
      },
      load,
      false,
    ),
    'BR',
  );
  assert.equal(calls, 1);
  assert.equal(await locateCountry({ geolocation }, load, true), 'BR');
  assert.equal(await locateCountry({}, load, true), null);
  await assert.rejects(
    locateCountry(
      {
        geolocation: {
          getCurrentPosition(_success, error) {
            error({ code: 1 });
          },
        },
      },
      load,
      true,
    ),
  );
});
test('clique durante verificação automática ainda pede permissão e coordenadas nunca entram na requisição ao servidor', async (t) => {
  const previousNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    ),
    previousFetch = globalThis.fetch;
  t.after(() => {
    if (previousNavigator)
      Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
    globalThis.fetch = previousFetch;
  });
  let permission,
    success,
    geoCalls = 0,
    fetches = 0;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      permissions: {
        query: () =>
          new Promise((resolve) => {
            permission = resolve;
          }),
      },
      geolocation: {
        getCurrentPosition(resolve) {
          geoCalls++;
          success = resolve;
        },
      },
    },
  });
  globalThis.fetch = async (url, options) => {
    fetches++;
    assert.equal(url, '/data/countries.v1.json');
    assert.equal(options.body, undefined);
    return { ok: true, json: async () => ({ countries: boundaries }) };
  };
  const automatic = detectLocationCountry(false),
    explicit = detectLocationCountry(true);
  assert.equal(geoCalls, 0);
  permission({ state: 'prompt' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(geoCalls, 1);
  success({ coords: { latitude: -16.6869, longitude: -49.2648 } });
  assert.equal(await automatic, null);
  assert.equal(await explicit, 'BR');
  assert.equal(fetches, 1);
  assert.equal(await detectLocationCountry(false), 'BR');
  assert.equal(geoCalls, 1);
});
