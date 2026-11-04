import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from './auth';
import {
  achievementRequest,
  type AchievementState,
} from './achievement-client';
import { t } from './i18n';
import './achievements.css';
import AchievementStars from './AchievementStars';
import AchievementEvidence from './AchievementEvidence';

const icons: Record<string, string> = {
  'first-play': '🍿',
  binge: '🔥',
  season: '🏁',
  cinephile: '🎬',
  reader: '📚',
  collector: '💎',
  'series-finale': '📺',
  'episode-voyager': '🛰️',
  classics: '🎞️',
  critic: '🧐',
  'day-season': '🌅',
  heart: '❤️',
  'actor-fan': '🌟',
  'character-fan': '🎭',
  'first-game': '🎮',
  'game-credits': '🏆',
  'game-time': '⏱️',
  'game-platforms': '🕹️',
};
export function AchievementIcon({ family }: { family: string }) {
  return (
    <span className="achievement-emoji" aria-hidden="true">
      {icons[family] || '🏆'}
    </span>
  );
}
type Context = {
  data: AchievementState | null;
  loading: boolean;
  error: string;
  refresh: () => void;
  selectTitle: (id: string | null) => Promise<void>;
};
const AchievementContext = createContext<Context | null>(null);
export function useAchievements() {
  const value = useContext(AchievementContext);
  if (!value) throw Error('AchievementProvider ausente');
  return value;
}
export function AchievementTitle({ compact = false }: { compact?: boolean }) {
  const { data } = useAchievements();
  const selected = data?.achievements.find(
    (item) => item.id === data.selectedId && item.unlockedAt,
  );
  return selected ? (
    <span className="achievement-profile-title" data-family={selected.family}>
      <AchievementIcon family={selected.family} />
      {t(selected.title)}
      {!compact && (
        <AchievementStars
          level={selected.level}
          total={selected.levels}
          progressionLevel={selected.progressionLevel}
          cycleStars={selected.cycleStars}
          progressionMode={selected.progressionMode}
        />
      )}
    </span>
  ) : null;
}
export default function AchievementProvider({
  children,
  onExpired,
}: {
  children: ReactNode;
  onExpired: () => void;
}) {
  const [data, setData] = useState<AchievementState | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [revision, setRevision] = useState(0),
    [ackBusy, setAckBusy] = useState(false),
    [ackError, setAckError] = useState('');
  const [acknowledged, setAcknowledged] = useState(new Set<string>());
  const ackPending = useRef(false);
  const celebrationHeading = useRef<HTMLHeadingElement>(null);
  const titleRevision = useRef(0);
  const expired = useEffectEvent(onExpired);
  const forceRefresh = useRef(false);
  const refresh = () => {
    forceRefresh.current = true;
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const activity = () => setRevision((value) => value + 1);
    const visible = () => {
      if (document.visibilityState === 'visible') activity();
    };
    window.addEventListener('nextplay:achievement-activity', activity);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('nextplay:achievement-activity', activity);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // Agrupa salvamentos próximos. Se a resposta anterior for cancelada, as
    // celebrações continuam pendentes no banco e voltam na próxima sincronização.
    const timer = window.setTimeout(() => {
      const manualRefresh = forceRefresh.current;
      forceRefresh.current = false;
      const startedTitleRevision = titleRevision.current;
      let timeZone = 'UTC';
      try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {}
      void achievementRequest<AchievementState>(
        manualRefresh ? 'sync' : 'sync?changed=1',
        'POST',
        { timeZone },
        controller.signal,
      )
        .then((value) => {
          if (!controller.signal.aborted) {
            // Uma leitura iniciada antes da escolha do título não desfaz a escolha recém-salva.
            const changedTitle = startedTitleRevision !== titleRevision.current;
            setData((previous) =>
              changedTitle && previous
                ? { ...value, selectedId: previous.selectedId }
                : value,
            );
            setError('');
            window.dispatchEvent(new Event('nextplay:notifications-changed'));
            window.dispatchEvent(new Event('nextplay:achievements-synced'));
          }
        })
        .catch((reason) => {
          if (controller.signal.aborted) return;
          if (reason instanceof ApiError && reason.status === 401) expired();
          else setError(t('Não foi possível carregar suas conquistas.'));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [revision]);
  async function selectTitle(id: string | null) {
    titleRevision.current++;
    try {
      const result = await achievementRequest<{ selectedId: string | null }>(
        'title',
        'PATCH',
        { achievementId: id },
      );
      setData((current) =>
        current ? { ...current, selectedId: result.selectedId } : current,
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      throw reason;
    }
  }
  const pending = (data?.pending || []).filter((id) => !acknowledged.has(id));
  const current = data?.achievements.find((item) => item.id === pending[0]);
  const currentId = current?.id;
  useEffect(() => {
    // Cada medalha da fila é anunciada como um novo título, sem perder o foco no body.
    celebrationHeading.current?.focus({ preventScroll: true });
  }, [currentId]);
  async function dismiss(all = false) {
    if (ackPending.current || !current) return;
    ackPending.current = true;
    setAckBusy(true);
    setAckError('');
    const ids = all ? pending : [current.id];
    try {
      // A fila pode crescer com novas famílias; cada lote respeita o limite documentado da API.
      for (let offset = 0; offset < ids.length; offset += 40)
        await achievementRequest('celebrations', 'POST', {
          ids: ids.slice(offset, offset + 40),
        });
      setAcknowledged((previous) => new Set([...previous, ...ids]));
      setData((value) =>
        value
          ? {
              ...value,
              pending: value.pending.filter((id) => !ids.includes(id)),
            }
          : value,
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setAckError(
          t('Não foi possível confirmar a celebração. Tente novamente.'),
        );
    } finally {
      ackPending.current = false;
      setAckBusy(false);
    }
  }
  return (
    <AchievementContext.Provider
      value={{ data, loading, error, refresh, selectTitle }}
    >
      {children}
      <Dialog
        open={Boolean(current)}
        onOpenChange={(open) => {
          if (!open) void dismiss(true);
        }}
      >
        <DialogContent
          className="achievement-celebration"
          data-family={current?.family}
          showCloseButton={false}
          initialFocus={celebrationHeading}
        >
          {current && (
            <div className="achievement-reveal" key={current.id}>
              <div className="achievement-confetti" aria-hidden="true">
                {Array.from({ length: 24 }, (_, index) => (
                  <i
                    key={index}
                    style={
                      {
                        '--x': `${(index * 37) % 100}%`,
                        '--delay': `${(index % 7) * 0.07}s`,
                        '--spin': `${index % 2 ? 190 : -170}deg`,
                        '--color':
                          index % 3 === 0
                            ? '#b9f5cc'
                            : index % 3 === 1
                              ? '#a899ff'
                              : '#f4cd77',
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <p className="achievement-eyebrow">
                <Sparkles aria-hidden="true" />
                {t('Conquista desbloqueada!')}
              </p>
              <div className="achievement-medal">
                <AchievementIcon family={current.family} />
              </div>
              <DialogTitle ref={celebrationHeading} tabIndex={-1}>
                {t(current.name)}
              </DialogTitle>
              <AchievementStars
                level={current.level}
                total={current.levels}
                progressionLevel={current.progressionLevel}
                cycleStars={current.cycleStars}
                progressionMode={current.progressionMode}
              />
              <DialogDescription>
                {t(current.description, current.target)}
              </DialogDescription>
              <AchievementEvidence item={current} />
              <p className="achievement-earned-title">
                {t('Novo título: {0}', t(current.title))}
              </p>
              <p className="achievement-queue">
                {pending.length > 1
                  ? t('{0} conquistas para celebrar', pending.length)
                  : t('Mais uma história para sua jornada.')}
              </p>
              <output className="home-error" aria-live="polite">
                {ackError}
              </output>
              <div className="achievement-celebration-actions">
                <Button
                  aria-disabled={ackBusy}
                  aria-busy={ackBusy}
                  onClick={() => void dismiss()}
                >
                  {t(
                    ackBusy
                      ? 'Aguarde…'
                      : pending.length > 1
                        ? 'Próxima conquista'
                        : 'Continuar',
                  )}
                </Button>
                {pending.length > 1 && (
                  <Button
                    variant="ghost"
                    aria-disabled={ackBusy}
                    onClick={() => void dismiss(true)}
                  >
                    {t('Voltar ao app')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AchievementContext.Provider>
  );
}
