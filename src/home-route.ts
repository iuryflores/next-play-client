export const homePaths = {
  all: '/biblioteca',
  planned: '/para-depois',
  completed: '/concluidos',
  'coming-soon': '/em-breve',
  archived: '/arquivados',
  active: '/em-andamento',
  explore: '/explorar',
  add: '/adicionar',
  stats: '/estatisticas',
  incoming: '/estreias',
  account: '/conta',
  achievements: '/conquistas',
  acervo: '/colecao',
  friends: '/amigos',
} as const;
export type HomeRoute = {
  view: keyof typeof homePaths;
  detailId: string | null;
  category: 'all' | 'movie' | 'series' | 'game' | 'book';
  historyMode: boolean;
};
export function readHomeRoute(url: URL): HomeRoute {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const view =
    (Object.keys(homePaths) as HomeRoute['view'][]).find(
      (key) => homePaths[key] === path,
    ) || 'all';
  const category = url.searchParams.get('categoria');
  const detailId = url.searchParams.get('titulo');
  return {
    view,
    category:
      category === 'movie' ||
      category === 'series' ||
      category === 'game' ||
      category === 'book'
        ? category
        : 'all',
    detailId: detailId && /^[a-f0-9]{24}$/i.test(detailId) ? detailId : null,
    historyMode:
      view === 'completed' && url.searchParams.get('historico') === '1',
  };
}
export function homeRouteUrl(route: HomeRoute) {
  const query = new URLSearchParams();
  if (route.category !== 'all') query.set('categoria', route.category);
  if (route.detailId) query.set('titulo', route.detailId);
  if (route.view === 'completed' && route.historyMode)
    query.set('historico', '1');
  return homePaths[route.view] + (query.size ? `?${query}` : '');
}
