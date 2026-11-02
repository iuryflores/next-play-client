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
  challenges: '/desafios',
  acervo: '/colecao',
  friends: '/amigos',
} as const;
export type HomeRoute = {
  view: keyof typeof homePaths;
  detailId: string | null;
  category: 'all' | 'movie' | 'series' | 'game' | 'book';
  historyMode: boolean;
  platform?: string;
};
export function readHomeRoute(url: URL): HomeRoute {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const matchedView =
    (Object.keys(homePaths) as HomeRoute['view'][]).find(
      (key) => homePaths[key] === path,
    ) || 'all';
  // Links antigos de estreias abrem a tela unificada, preservando filtros e detalhes.
  const view = matchedView === 'incoming' ? 'coming-soon' : matchedView;
  const category = url.searchParams.get('categoria');
  const detailId = url.searchParams.get('titulo');
  const platform = url.searchParams.get('plataforma');
  return {
    view,
    // O filtro faz parte do endereço para sobreviver a refresh, detalhes e voltar/avançar.
    ...(category === 'game' &&
    platform &&
    platform.length <= 160 &&
    (platform === 'missing' || platform.startsWith('platform:'))
      ? { platform }
      : {}),
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
  if (route.category === 'game' && route.platform)
    query.set('plataforma', route.platform);
  if (route.detailId) query.set('titulo', route.detailId);
  if (route.view === 'completed' && route.historyMode)
    query.set('historico', '1');
  return (
    homePaths[route.view === 'incoming' ? 'coming-soon' : route.view] +
    (query.size ? `?${query}` : '')
  );
}
