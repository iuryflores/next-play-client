import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  explorePagePlan,
  readExplorePages,
  rememberExplorePages,
} from '../src/explore-pages.ts';

test('sorteio favorece páginas populares sem prender a descoberta às primeiras páginas', () => {
  let state = 123456789;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  let popular = 0,
    discoveries = 0;
  const firstPages = new Set();
  for (let i = 0; i < 1000; i++) {
    const { pages } = explorePagePlan(500, [], random);
    if (pages[0] <= 20) popular++;
    else discoveries++;
    firstPages.add(pages[0]);
  }
  assert.ok(
    popular > 600,
    'maioria das seleções deve vir das páginas mais populares',
  );
  assert.ok(
    discoveries > 100,
    'páginas distantes continuam oferecendo descobertas',
  );
  assert.ok(
    firstPages.size > 50,
    'a variedade envolve obras de muitas páginas',
  );
  const remaining = explorePagePlan(
    500,
    Array.from({ length: 20 }, (_, i) => i + 1),
    random,
  );
  assert.equal(remaining.pages.length, 480);
  assert.ok(remaining.pages.every((page) => page > 20));
});

test('sorteio percorre todo o catálogo válido e não reutiliza páginas enquanto houver alternativas', () => {
  const visited = Array.from({ length: 80 }, (_, i) => i + 1);
  const plan = explorePagePlan(500, visited);
  assert.equal(plan.pages.length, 420);
  assert.equal(new Set(plan.pages).size, 420);
  assert.equal(plan.reset, false);
  assert.ok(plan.pages.every((page) => page >= 81 && page <= 500));
  const tiny = explorePagePlan(3, [1, 2, 3]);
  assert.equal(tiny.reset, true);
  assert.deepEqual([...tiny.pages].sort(), [1, 2, 3]);
  assert.equal(explorePagePlan(999).pages.length, 500);
  assert.deepEqual(explorePagePlan(0).pages, []);
});

test('histórico da sessão sobrevive à releitura e reinicia quando gênero/idioma mudam', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'sessionStorage',
  );
  const values = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  t.after(() => {
    if (descriptor)
      Object.defineProperty(globalThis, 'sessionStorage', descriptor);
    else delete globalThis.sessionStorage;
  });
  const signature = 'pt-BR:fantasia:500';
  rememberExplorePages('movie', signature, [125, 417], true);
  rememberExplorePages('movie', signature, [12, 300]);
  assert.deepEqual(readExplorePages('movie', signature), [125, 417, 12, 300]);
  const next = explorePagePlan(500, readExplorePages('movie', signature));
  assert.ok([125, 417, 12, 300].every((page) => !next.pages.includes(page)));
  assert.deepEqual(readExplorePages('movie', 'es-ES:drama:500'), []);
  assert.deepEqual(readExplorePages('series', signature), []);
  rememberExplorePages('movie', signature, [50], true);
  assert.deepEqual(readExplorePages('movie', signature), [50]);
});
