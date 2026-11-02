import { Star } from 'lucide-react';
import { t } from './i18n';

export default function AchievementStars({
  level,
  total,
  progressionLevel = level,
  cycleStars = 0,
}: {
  level: number;
  total: number;
  progressionLevel?: number;
  cycleStars?: number;
}) {
  // Conquistas únicas, como Primeiro play, não possuem ciclos nem níveis.
  if (total <= 1) return null;
  const stars = Math.min(5, Math.max(0, cycleStars));
  return (
    <span
      className="achievement-stars"
      aria-label={t('Nível {0}', progressionLevel)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.min(1, Math.max(0, stars - index));
        return (
          <span className="achievement-star" key={index} aria-hidden="true">
            <Star />
            <Star
              className="is-lit"
              style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
            />
          </span>
        );
      })}
      <small aria-hidden="true">{t('Nível {0}', progressionLevel)}</small>
    </span>
  );
}
