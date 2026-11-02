import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homePaths, homeRouteUrl, readHomeRoute } from '../src/home-route.ts';

test('cada tela mantém endereço próprio e pode ser restaurada após refresh', () => {
  for (const [view, path] of Object.entries(homePaths)) {
    if (view === 'incoming') continue;
    const route = { view, detailId: null, category: 'all', historyMode: false };
    assert.equal(homeRouteUrl(route), path);
    assert.deepEqual(
      readHomeRoute(new URL(path, 'https://nextplay.example')),
      route,
    );
  }
});

test('link antigo de estreias abre Em breve e preserva filtros e título selecionado', () => {
  const id = 'a'.repeat(24);
  const route = readHomeRoute(
    new URL(`https://nextplay.example/estreias?categoria=series&titulo=${id}`),
  );
  assert.equal(route.view, 'coming-soon');
  assert.equal(route.category, 'series');
  assert.equal(route.detailId, id);
  assert.equal(homeRouteUrl(route), `/em-breve?categoria=series&titulo=${id}`);
  assert.equal(
    homeRouteUrl({ ...route, view: 'incoming' }),
    `/em-breve?categoria=series&titulo=${id}`,
  );
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


test('plataforma de jogos sobrevive ao refresh e à abertura dos detalhes, sem filtrar outras mídias', () => {
  const route = { view: 'all', category: 'game', historyMode: false, detailId: null, platform: 'platform:playstation 5' };
  const url = homeRouteUrl(route);
  assert.deepEqual(readHomeRoute(new URL(url, 'https://nextplay.example')), route);
  const details = { ...route, detailId: 'b'.repeat(24) };
  assert.deepEqual(readHomeRoute(new URL(homeRouteUrl(details), 'https://nextplay.example')), details);
  assert.ok(!homeRouteUrl({ ...route, category: 'movie' }).includes('plataforma'));
  assert.equal(readHomeRoute(new URL('https://nextplay.example/biblioteca?categoria=movie&plataforma=platform:pc')).platform, undefined);
  assert.equal(readHomeRoute(new URL('https://nextplay.example/biblioteca?categoria=game&plataforma=invalid')).platform, undefined);
  assert.equal(readHomeRoute(new URL('https://nextplay.example/biblioteca?categoria=game&plataforma=missing')).platform, 'missing');
});


test('notificação preserva título e conversa específica após refresh sem aceitar IDs inválidos', () => {
  const route = { view: 'all', category: 'all', detailId: 'a'.repeat(24), commentId: 'b'.repeat(24), historyMode: false };
  const url = new URL(homeRouteUrl(route), 'https://nextplay.example');
  assert.equal(url.searchParams.get('comentario'), route.commentId);
  assert.deepEqual(readHomeRoute(url), route);
  assert.equal(readHomeRoute(new URL('https://nextplay.example/biblioteca?comentario=' + route.commentId)).commentId, undefined);
  assert.equal(readHomeRoute(new URL('https://nextplay.example/biblioteca?titulo=' + route.detailId + '&comentario=bad')).commentId, undefined);
});
