import { useState } from 'react';
import { Trophy, LockKeyhole, Check, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AchievementIcon,
  useAchievements,
  AchievementTitle,
} from './AchievementProvider';
import PageLoading from './PageLoading';
import { t } from './i18n';
import type { Achievement } from './achievement-client';
import AchievementStars from './AchievementStars';
import AchievementEvidence from './AchievementEvidence';

export default function Achievements() {
  const { data, loading, error, refresh, selectTitle } = useAchievements();
  const [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState('');
  const groups = new Map<string, Achievement[]>();
  data?.achievements.forEach((item) =>
    groups.set(item.family, [...(groups.get(item.family) || []), item]),
  );
  // Famílias com alguma meta desbloqueada aparecem primeiro; empates mantêm a ordem original.
  const orderedGroups = [...groups].sort(
    ([, a], [, b]) =>
      Number(b.some((item) => item.unlockedAt)) -
      Number(a.some((item) => item.unlockedAt)),
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
      <details className="achievement-guide">
        <summary>{t('Como funcionam os níveis e as estrelas?')}</summary>
        <p>
          {t(
            'Maratonas diárias e variedade de plataformas têm metas fixas, sem níveis infinitos. Só mais um episódio termina em 10 episódios no mesmo dia. As demais regras de ciclos valem para conquistas acumulativas.',
          )}
        </p>
        <p>
          {t(
            'As estrelas mostram o progresso do ciclo atual. Ao completar cinco estrelas, você ganha um nível. O nível indica quantas vezes você completou esse ciclo.',
          )}
        </p>
        <p>
          {t(
            'Cada estrela vale a maior meta inicial da conquista. No Cinéfilo, cada estrela vale 100 filmes: com 338 filmes, você tem 3,38 estrelas e nível 0; com 500, completa cinco estrelas e chega ao nível 1; com 1.000, chega ao nível 2.',
          )}
        </p>
        <p>
          {t(
            'O nível conta apenas ciclos completos. Em Temporada encerrada, cada estrela vale 25 temporadas: 125 completam o nível 1 e 250 completam o nível 2. Com 249, você ainda está no nível 1, com a quinta estrela do próximo ciclo quase preenchida. O número abaixo das estrelas mostra exatamente quanto falta.',
          )}
        </p>
        <p>
          {t(
            'Ao fechar um ciclo, as cinco estrelas ficam preenchidas até você começar o próximo. Depois, elas voltam a mostrar o avanço do novo ciclo. Seu maior progresso fica salvo, mesmo se você remover registros.',
          )}
        </p>
        <p>
          {t(
            'As cinco metas abaixo de cada conquista representam as estrelas do ciclo atual. O histórico dos desbloqueios anteriores fica em Por que ganhei? Conquistas únicas, como Primeiro play, não têm níveis nem estrelas.',
          )}
        </p>
      </details>
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
            {orderedGroups.map(([family, history]) => {
              const levels = history.filter((item) => !item.legacy);
              const earned = levels.filter((item) => item.unlockedAt).at(-1),
                next = levels.find((item) => !item.unlockedAt),
                display = next || earned!;
              const target = display.nextLevelTarget;
              const value = Math.min(target, display.current);
              // No fechamento exato, os marcos acompanham as cinco estrelas completas até começar outro ciclo.
              const starTarget = levels.at(-1)!.target;
              const cycleIndex = Math.max(
                0,
                display.progressionLevel - (display.cycleStars === 5 ? 1 : 0),
              );
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
                    progressionLevel={display.progressionLevel}
                    cycleStars={display.cycleStars}
                    progressionMode={display.progressionMode}
                  />
                  <p>{t(display.description, target)}</p>
                  {display.progressionMode === 'continuous' && (
                    <p>
                      {t(
                        display.metric === 'gameHours'
                          ? 'Cada estrela vale {0} horas jogadas. Cinco estrelas completam um nível.'
                          : 'Cada estrela vale {0} registros. Cinco estrelas completam um nível.',
                        levels.at(-1)!.target,
                      )}
                    </p>
                  )}
                  <label
                    className="achievement-progress-label"
                    htmlFor={`achievement-${family}`}
                  >
                    <span>
                      {t(
                        display.levels === 1
                          ? earned
                            ? 'Conquistado'
                            : 'Próxima meta'
                          : display.progressionMode === 'finite'
                            ? display.cycleStars === 5
                              ? 'Todas as metas conquistadas'
                              : 'Próxima meta'
                            : 'Próximo nível',
                      )}
                    </span>
                    <strong>
                      {value} / {target}
                    </strong>
                  </label>
                  <progress
                    id={`achievement-${family}`}
                    value={value}
                    max={target}
                  />
                  {display.levels > 1 && (
                    <div
                      className="achievement-levels"
                      aria-label={t('Metas de {0}', t(display.name))}
                    >
                      {(display.progressionMode === 'finite'
                        ? levels.map((item) => item.target)
                        : Array.from(
                            { length: 5 },
                            (_, index) =>
                              (cycleIndex * 5 + index + 1) * starTarget,
                          )
                      ).map((milestone, index) => {
                        const reached =
                          display.progressionMode === 'finite'
                            ? Boolean(levels[index].unlockedAt) ||
                              display.cycleStars >=
                                ((index + 1) / levels.length) * 5
                            : display.cycleStars >= index + 1;
                        return (
                          <span
                            key={milestone}
                            className={reached ? 'is-earned' : ''}
                            title={t('Meta: {0}', milestone)}
                          >
                            {reached ? (
                              <Check aria-hidden="true" />
                            ) : (
                              <Flag aria-hidden="true" />
                            )}
                            {milestone}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {earned && (
                    <AchievementEvidence item={earned} history={history} />
                  )}
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
