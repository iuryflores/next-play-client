import { Star } from 'lucide-react';
import { t } from './i18n';

export default function AchievementStars({
  level,
  total,
}: {
  level: number;
  total: number;
}) {
  if (total <= 1) return null;
  // Famílias longas usam um contador; vinte estrelas esconderiam a hierarquia no celular.
  const compact = total > 5;
  return (
    <span
      className="achievement-stars"
      aria-label={t('Nível {0} de {1}', level, total)}
    >
      {Array.from({ length: compact ? 1 : total }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={index < level ? 'is-lit' : ''}
        />
      ))}
      <small aria-hidden="true">
        {level}/{total}
      </small>
    </span>
  );
}
