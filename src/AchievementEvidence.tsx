import type { Achievement } from './achievement-client';
import { t } from './i18n';

function earnedReason(item: Achievement) {
  // O grupo salvo no desbloqueio identifica o favorito; não usamos preferências atuais para explicar o passado.
  const favorite = item.evidence?.[0]?.split(' — ')[0];
  if (favorite && item.metric === 'favoriteCharacter')
    return t(
      'Marcou {0} {1} vezes como personagem favorito.',
      favorite,
      item.target,
    );
  if (favorite && item.metric === 'favoriteActor')
    return t(
      'Escolheu {0} {1} vezes como ator favorito.',
      favorite,
      item.target,
    );
  if (item.metric === 'loved')
    return t('Marcou Amei em {0} avaliações distintas.', item.target);
  return t('Meta conquistada: {0}', t(item.description, item.target));
}

export default function AchievementEvidence({
  item,
  history = [item],
}: {
  item: Achievement;
  history?: Achievement[];
}) {
  if (!item.unlockedAt) return null;
  return (
    <>
      <p className="achievement-earned-reason">{earnedReason(item)}</p>
      <details className="achievement-evidence">
        <summary>{t('Por que ganhei?')}</summary>
        {history
          .filter((level) => level.unlockedAt)
          .map((level) => (
            <section key={level.id}>
              <p>
                <strong>
                  {t('Marco {0} de {1}', level.level, level.levels)}
                </strong>
              </p>
              <p>{t(level.description, level.target)}</p>
              {level.evidence?.length ? (
                <>
                  <p>{t('Itens que contaram no desbloqueio:')}</p>
                  <ul>
                    {level.evidence.map((title, index) => (
                      <li key={index}>{title}</li>
                    ))}
                  </ul>
                </>
              ) : (
                // Conquistas antigas não guardavam os itens; o histórico atual não comprova a origem.
                <p>
                  {t(
                    'Os itens desta conquista não foram registrados no desbloqueio.',
                  )}
                </p>
              )}
            </section>
          ))}
      </details>
    </>
  );
}
