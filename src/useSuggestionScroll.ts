import { useEffect, useEffectEvent, useRef } from 'react';

export default function useSuggestionScroll({
  enabled,
  loading,
  blocked,
  resetKey,
  loadMore,
}: {
  enabled: boolean;
  loading: boolean;
  blocked: boolean;
  resetKey: string;
  loadMore: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const armed = useRef(true);
  const requestMore = useEffectEvent(() => {
    if (loading || blocked || pending.current || !armed.current) return;
    pending.current = true;
    armed.current = false;
    loadMore();
  });
  useEffect(() => {
    if (!loading) pending.current = false;
  }, [loading]);
  useEffect(() => {
    const element = end.current;
    if (!enabled || !element || typeof IntersectionObserver === 'undefined')
      return;
    armed.current = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) requestMore();
        else armed.current = true;
      },
      { rootMargin: '0px 0px 400px 0px' },
    );
    observer.observe(element);
    let frame = 0;
    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // Se um lote só trouxe duplicados, uma nova rolagem pode tentar o próximo.
        // Não encadeamos requisições sem interação enquanto o fim permanece visível.
        armed.current = true;
        observer.unobserve(element);
        observer.observe(element);
      });
    };
    // Captura também a rolagem interna dos diálogos de adicionar ao acervo.
    window.addEventListener('scroll', scroll, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [enabled, resetKey]);
  return end;
}
