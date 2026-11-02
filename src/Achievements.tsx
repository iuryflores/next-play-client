import { useState } from 'react';
import { Trophy, LockKeyhole, Check, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AchievementIcon,
  useAchievements,
  AchievementTitle,
} from './AchievementProvider';
import PageLoading from './PageLoading';
import { t, language } from './i18n';
import type { Achievement } from './achievement-client';
import AchievementStars from './AchievementStars';

export default function Achievements() {
  const { data, loading, error, refresh, selectTitle } = useAchievements();
  const [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState('');
  const groups = new Map<string, Achievement[]>();
  data?.achievements.forEach((item) =>
    groups.set(item.family, [...(groups.get(item.family) || []), item]),
  );
  const selected = data?.achievements.find(
    (item) => item.id === data.selectedId,
  );
  async function choose(id: string | null) {
    if (busy) return;
    setBusy(true);
    setSaveError('');
    try {
      await selectTitle(id);
    } catch {
      setSaveError(t('Não foi possível salvar seu título.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="achievements-page">
      <header className="achievements-heading">
        <span className="home-kicker">{t('SUA JORNADA')}</span>
        <h1>
          <Trophy aria-hidden="true" />
          {t('Conquistas')}
        </h1>
        <p>{t('Cada história deixa uma marca. Celebre as suas.')}</p>
      </header>
      <div className="achievement-profile">
        <div>
          <strong>{t('Seu título no perfil')}</strong>
          <AchievementTitle />
          {!selected && (
            <p>
              {t('Desbloqueie uma conquista e escolha um título para exibir.')}
            </p>
          )}
        </div>
        {selected && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void choose(null)}
          >
            {t('Remover título')}
          </Button>
        )}
      </div>
      <output className="home-error" aria-live="polite">
        {saveError || error}
      </output>
      {error && (
        <Button variant="outline" onClick={refresh}>
          {t('Tentar novamente')}
        </Button>
      )}
      {loading && !data ? (
        <PageLoading compact />
      ) : (
        <>
          <p className="achievement-summary">
            {t(
              '{0} conquistas desbloqueadas',
              data?.achievements.filter((item) => item.unlockedAt).length || 0,
            )}
          </p>
          <div className="achievement-grid">
            {[...groups].map(([family, levels]) => {
              const earned = levels.filter((item) => item.unlockedAt).at(-1),
                next = levels.find((item) => !item.unlockedAt),
                display = next || earned!;
              const value =
                earned && !next
                  ? display.target
                  : Math.min(display.target, display.current);
              return (
                <article
                  className={`achievement-card${earned ? ' is-earned' : ''}`}
                  key={family}
                  data-family={family}
                >
                  <div className="achievement-card-heading">
                    <div className="achievement-card-icon">
                      <AchievementIcon family={family} />
                    </div>
                    <span>
                      {earned ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <LockKeyhole aria-hidden="true" />
                      )}
                    </span>
                  </div>
                  <h2>{t(display.name)}</h2>
                  <AchievementStars
                    level={earned?.level || 0}
                    total={display.levels}
                  />
                  <p>{t(display.description, display.target)}</p>
                  <label
                    className="achievement-progress-label"
                    htmlFor={`achievement-${family}`}
                  >
                    <span>
                      {t(next ? 'Próxima meta' : 'Todas as metas conquistadas')}
                    </span>
                    <strong>
                      {value} / {display.target}
                    </strong>
                  </label>
                  <progress
                    id={`achievement-${family}`}
                    value={value}
                    max={display.target}
                  />
                  <details
                    className="achievement-steps"
                    open={levels.length <= 6 ? true : undefined}
                  >
                    <summary hidden={levels.length <= 6}>
                      {t('Ver todas as metas')}
                    </summary>
                    <div
                      className="achievement-levels"
                      aria-label={t('Metas de {0}', t(display.name))}
                    >
                      {levels.map((level) => (
                        <span
                          key={level.id}
                          className={level.unlockedAt ? 'is-earned' : ''}
                          title={
                            level.unlockedAt
                              ? t(
                                  'Conquistado em {0}',
                                  new Intl.DateTimeFormat(language, {
                                    dateStyle: 'medium',
                                    timeZone: data?.timeZone,
                                  }).format(new Date(level.unlockedAt)),
                                )
                              : t('Meta: {0}', level.target)
                          }
                        >
                          {level.unlockedAt ? (
                            <Check aria-hidden="true" />
                          ) : (
                            <Flag aria-hidden="true" />
                          )}
                          {level.target}
                        </span>
                      ))}
                    </div>
                  </details>
                  {earned ? (
                    <Button
                      className="achievement-use-title"
                      variant={
                        selected?.id === earned.id ? 'secondary' : 'default'
                      }
                      disabled={busy || selected?.id === earned.id}
                      onClick={() => void choose(earned.id)}
                    >
                      {t(
                        selected?.id === earned.id
                          ? 'Título em uso'
                          : 'Usar título: {0}',
                        t(earned.title),
                      )}
                    </Button>
                  ) : (
                    <small className="achievement-locked">
                      {t('Seu próximo título está a caminho.')}
                    </small>
                  )}
                </article>
              );
            })}
          </div>
          <p className="achievement-rules">
            {t(
              'Maratonas contam marcações individuais novas no mesmo dia, no fuso do navegador. Lotes e registros antigos não contam. Posse e leitura são independentes. Conquistas desbloqueadas permanecem com você.',
            )}
          </p>
        </>
      )}
    </section>
  );
}
