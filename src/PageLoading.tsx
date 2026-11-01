import { t } from './i18n';
import './page-loading.css';

export default function PageLoading({
  label = t('Carregando…'),
  compact = false,
  fullScreen = false,
}: {
  label?: string;
  compact?: boolean;
  fullScreen?: boolean;
}) {
  return (
    <output
      className={`page-loading${compact ? ' page-loading-compact' : ''}${fullScreen ? ' page-loading-screen' : ''}`}
      aria-live="polite"
    >
      <span className="page-loading-emblem" aria-hidden="true">
        <span className="page-loading-orbit" />
        <img src="/nextplay-symbol.svg" alt="" width="64" height="64" />
      </span>
      <span className="page-loading-copy">
        <strong aria-hidden="true">
          Next<span>Play</span>
        </strong>
        <span className="page-loading-label">{label}</span>
      </span>
      <span className="page-loading-track" aria-hidden="true">
        <span />
      </span>
    </output>
  );
}
