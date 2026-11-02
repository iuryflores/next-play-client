import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SetStateAction,
} from 'react';
import { homeRouteUrl, readHomeRoute, type HomeRoute } from './home-route';

export default function useHomeRoute() {
  const [route, setRoute] = useState(() =>
    readHomeRoute(new URL(window.location.href)),
  );
  const initialized = useRef(false);
  useLayoutEffect(() => {
    const url = homeRouteUrl(route);
    // A URL é a fonte de restauração; nenhuma preferência de navegação é gravada no navegador ou no banco.
    if (window.location.pathname + window.location.search !== url) {
      if (initialized.current) window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    }
    initialized.current = true;
  }, [route]);
  useEffect(() => {
    const restore = () =>
      setRoute(readHomeRoute(new URL(window.location.href)));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const set = <K extends keyof HomeRoute>(
    key: K,
    value: SetStateAction<HomeRoute[K]>,
  ) =>
    setRoute((previous) => ({
      ...previous,
      ...(key === 'view' && value !== 'social' ? { profileId: undefined } : {}),
      ...(key === 'view' && value !== 'lists' ? { listId: undefined } : {}),
      // Trocar de título limpa a âncora de conversa da navegação anterior.
      ...(key === 'detailId' ? { commentId: undefined } : {}),
      // Sair de Jogos limpa o filtro específico, sem afetar outras mídias.
      ...(key === 'category' && value !== 'game'
        ? { platform: undefined }
        : {}),
      [key]:
        typeof value === 'function'
          ? (value as (current: HomeRoute[K]) => HomeRoute[K])(previous[key])
          : value,
    }));
  return { route, set };
}
