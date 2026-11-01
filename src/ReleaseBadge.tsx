import { CalendarClock } from 'lucide-react';
import { dateLabel, t } from './i18n';
import { upcomingRelease, type ReleaseInfo } from './release-status';
export default function ReleaseBadge({ item }: { item: ReleaseInfo }) {
  const release = upcomingRelease(item);
  if (!release) return null;
  return (
    <span className="release-badge">
      <CalendarClock aria-hidden="true" />
      {release.date ? (
        <time dateTime={release.date}>
          {t('Estreia em {0}', dateLabel(release.date))}
        </time>
      ) : (
        t('Em breve')
      )}
    </span>
  );
}
