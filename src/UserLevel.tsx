import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import { ArrowUpRight, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ApiError } from './auth';
import { language, t } from './i18n';
import './user-level.css';

type Progression = {
  level: number;
  totalXp: number;
  currentXp: number;
  requiredXp: number;
  gameHourCap: number;
  breakdown: {
    kind: string;
    label: string;
    rate: number;
    units: number;
    xp: number;
  }[];
  recent: {
    id: string;
    kind: string;
    label: string;
    xp: number;
    recordedAt: string;
  }[];
};
type LevelContext = {
  data: Progression | null;
  loading: boolean;
  error: string;
  refresh: () => void;
};
const Context = createContext<LevelContext | null>(null);
function useLevel() {
  const context = useContext(Context);
  if (!context) throw Error('UserLevelProvider ausente');
  return context;
}
const number = (value: number) => value.toLocaleString(language);
function Meter({ data }: { data: Progression }) {
  return (
    <div className="user-level-meter">
      <div>
        <span>{t('Próximo nível')}</span>
        <strong>
          {number(data.currentXp)} / {number(data.requiredXp)} XP
        </strong>
      </div>
      <progress
        value={data.currentXp}
        max={data.requiredXp}
        aria-label={t('Progresso para o próximo nível')}
      />
    </div>
  );
}
export function UserLevelBadge() {
  const { data, error } = useLevel();
  return (
    <DialogTrigger
      render={
        <Button
          variant="ghost"
          className="user-level-badge"
          aria-label={
            data
              ? t('Nível {0} · Ver experiência', data.level)
              : t('Sua experiência')
          }
        />
      }
    >
      <Sparkles aria-hidden="true" />
      {data ? t('Nível {0}', data.level) : error ? '—' : '…'}
    </DialogTrigger>
  );
}
export function UserLevelCard() {
  const { data, loading, error, refresh } = useLevel();
  return (
    <section className="user-level-card" aria-label={t('Sua experiência')}>
      <div className="user-level-card-heading">
        <div>
          <span>{t('SUA JORNADA')}</span>
          <h2>{data ? t('Nível {0}', data.level) : t('Sua experiência')}</h2>
        </div>
        <Sparkles aria-hidden="true" />
      </div>
      {data && (
        <>
          <p>{t('{0} XP acumulados', number(data.totalXp))}</p>
          <Meter data={data} />
        </>
      )}
      {loading && !data && <output>{t('Carregando…')}</output>}
      {error && (
        <p role="alert" className="home-error">
          {error}
          <Button variant="ghost" onClick={refresh}>
            {t('Tentar novamente')}
          </Button>
        </p>
      )}
      <DialogTrigger
        render={<Button variant="ghost" className="user-level-details-link" />}
      >
        {t('Ver detalhes do XP')}
        <ArrowUpRight aria-hidden="true" />
      </DialogTrigger>
    </section>
  );
}
export default function UserLevelProvider({
  children,
  onExpired,
}: {
  children: ReactNode;
  onExpired: () => void;
}) {
  const [data, setData] = useState<Progression | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const expired = useEffectEvent(onExpired);
  const mode = useRef<'read' | 'changed' | 'force'>('read');
  const refresh = () => {
    mode.current = 'force';
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    // Espera as conquistas serem sincronizadas para incluir o bônus recém-concedido.
    const activity = () => {
      mode.current = 'changed';
      setRevision((value) => value + 1);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') {
        mode.current = 'read';
        setRevision((value) => value + 1);
      }
    };
    window.addEventListener('nextplay:achievements-synced', activity);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('nextplay:achievements-synced', activity);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      // Na abertura, lê créditos prontos. Após uma atividade, só reconhece alterações pendentes.
      const currentMode = mode.current;
      void fetch(
        currentMode === 'read'
          ? '/api/progression'
          : `/api/progression/sync${currentMode === 'changed' ? '?changed=1' : ''}`,
        {
          method: currentMode === 'read' ? 'GET' : 'POST',
          credentials: 'same-origin',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
        },
      )
        .then(async (response) => {
          if (!response.ok)
            throw new ApiError(
              response.status,
              t('Não foi possível carregar seu nível.'),
            );
          const result: Progression = await response.json();
          if (!controller.signal.aborted) {
            setData(result);
            setError('');
            window.dispatchEvent(
              new CustomEvent('nextplay:progression-synced', {
                detail: { totalXp: result.totalXp, level: result.level },
              }),
            );
          }
        })
        .catch((reason) => {
          if (controller.signal.aborted) return;
          if (reason instanceof ApiError && reason.status === 401) expired();
          else setError(t('Não foi possível carregar seu nível.'));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [revision]);
  return (
    <Context.Provider value={{ data, loading, error, refresh }}>
      <Dialog>
        {children}
        <DialogContent className="user-level-dialog">
          <header>
            <span className="user-level-eyebrow">
              <Sparkles aria-hidden="true" />
              {t('SUA JORNADA')}
            </span>
            <DialogTitle>
              {data ? t('Nível {0}', data.level) : t('Sua experiência')}
            </DialogTitle>
            <DialogDescription>
              {t('Cada história soma experiência ao seu perfil.')}
            </DialogDescription>
          </header>
          {data && (
            <>
              <div className="user-level-total">
                <strong>{number(data.totalXp)}</strong>
                <span>XP</span>
              </div>
              <Meter data={data} />
              <section>
                <h3>{t('De onde vem seu XP')}</h3>
                <ul className="user-level-breakdown">
                  {data.breakdown.map((row) => (
                    <li key={row.kind}>
                      <div>
                        <strong>{t(row.label)}</strong>
                        <small>
                          {t(
                            '{0} registros · {1} XP cada',
                            number(row.units),
                            row.rate,
                          )}
                        </small>
                      </div>
                      <span>{number(row.xp)} XP</span>
                    </li>
                  ))}
                </ul>
              </section>
              <details className="user-level-guide">
                <summary>{t('Como funcionam os níveis?')}</summary>
                <p>
                  {t(
                    'Você começa no nível 1. O primeiro avanço exige 100 XP; cada próximo nível exige 25 XP a mais. Não há nível máximo.',
                  )}
                </p>
                <p>
                  {t(
                    'Cada obra, episódio distinto e conquista pontua uma vez. Cada revisão concluída de filme rende mais 20 XP. Avaliar com nota ou sentimento rende um único bônus por registro. Editar, desmarcar ou recadastrar não repete o XP já reconhecido.',
                  )}
                </p>
                <p>
                  {t(
                    'As primeiras {0} horas de cada jogo rendem XP. Horas extras continuam salvas, mas não geram pontos adicionais.',
                    data.gameHourCap,
                  )}
                </p>
                <p>
                  {t(
                    'O histórico existente também conta, mesmo sem data de consumo. O XP reconhecido fica salvo após exclusões. O nível do perfil é separado dos níveis das conquistas.',
                  )}
                </p>
                <p>
                  {t(
                    'Cada hora completa assistida rende 5 XP extras. Minutos se acumulam por filme, incluindo revisões concluídas, ou por série, somando episódios distintos. Só durações conhecidas contam; tempo sem duração não é estimado.',
                  )}
                </p>
              </details>
              <section>
                <h3>{t('Atividades reconhecidas recentemente')}</h3>
                <p className="user-level-history-note">
                  {t(
                    'As datas indicam quando o XP foi reconhecido. Importações antigas aparecem na data da sincronização; os valores mostram o crédito acumulado da atividade.',
                  )}
                </p>
                <ul className="user-level-recent">
                  {data.recent.map((row) => (
                    <li key={row.id}>
                      <div>
                        <strong>
                          {row.kind === 'achievement'
                            ? t(row.label)
                            : row.label}
                        </strong>
                        <small>
                          {t(
                            data.breakdown.find(
                              (entry) => entry.kind === row.kind,
                            )?.label || '',
                          )}{' '}
                          ·{' '}
                          <time dateTime={row.recordedAt}>
                            {new Date(row.recordedAt).toLocaleString(language, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </time>
                        </small>
                      </div>
                      <span>{number(row.xp)} XP</span>
                    </li>
                  ))}
                </ul>
                {data.recent.length === 0 && (
                  <p>
                    {t('Sua próxima história pode render os primeiros pontos.')}
                  </p>
                )}
              </section>
            </>
          )}
          {loading && !data && <output>{t('Carregando…')}</output>}
          {error && (
            <p role="alert" className="home-error">
              {error}
            </p>
          )}
          <Button variant="ghost" onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            {t('Atualizar experiência')}
          </Button>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
