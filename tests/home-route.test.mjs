import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homePaths, homeRouteUrl, readHomeRoute } from '../src/home-route.ts';

test('cada tela mantém endereço próprio e pode ser restaurada após refresh', () => {
  for (const [view, path] of Object.entries(homePaths)) {
    const route = { view, detailId: null, category: 'all', historyMode: false };
    assert.equal(homeRouteUrl(route), path);
    assert.deepEqual(
      readHomeRoute(new URL(path, 'https://nextplay.example')),
      route,
    );
  }
});

test('detalhes, categoria e histórico sobrevivem à releitura da URL e ao voltar', () => {
  const list = {
    view: 'completed',
    detailId: null,
    category: 'series',
    historyMode: true,
  };
  const detail = { ...list, detailId: 'a'.repeat(24) };
  const urls = [list, detail].map(homeRouteUrl);
  assert.deepEqual(
    readHomeRoute(new URL(urls[1], 'https://nextplay.example')),
    detail,
  );
  assert.deepEqual(
    readHomeRoute(new URL(urls[0], 'https://nextplay.example')),
    list,
  );
});

test('endereços e filtros inválidos retornam valores seguros sem interferir no login', () => {
  assert.deepEqual(
    readHomeRoute(
      new URL(
        'https://nextplay.example/desconhecido?titulo=invalid&categoria=invalid&historico=1',
      ),
    ),
    {
      view: 'all',
      detailId: null,
      category: 'all',
      historyMode: false,
    },
  );
  assert.equal(
    readHomeRoute(new URL('https://nextplay.example/amigos/')).view,
    'friends',
  );
  assert.equal(
    readHomeRoute(
      new URL('https://nextplay.example/#reset-password=private-token'),
    ).detailId,
    null,
  );
  assert.ok(
    !homeRouteUrl({
      view: 'all',
      detailId: null,
      category: 'all',
      historyMode: false,
    }).includes('private-token'),
  );
});
