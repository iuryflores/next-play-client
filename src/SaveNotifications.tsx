import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { t } from './i18n';
import './notifications.css';
type Notice = { id: number; message: string };
let nextId = 0;
function NoticeCard({
  notice,
  dismiss,
}: {
  notice: Notice;
  dismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismiss(notice.id), 4500);
    return () => window.clearTimeout(timer);
  }, [notice.id, dismiss, paused]);
  return (
    <div
      className="save-notification"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <CheckCircle2 aria-hidden="true" />
      <span>{notice.message}</span>
      <button
        type="button"
        aria-label={t('Fechar notificação')}
        onClick={() => dismiss(notice.id)}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
export default function Notifications() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const dismiss = useCallback(
    (id: number) =>
      setNotices((current) => current.filter((value) => value.id !== id)),
    [],
  );
  useEffect(() => {
    const receive = (event: Event) => {
      const message = (event as CustomEvent<unknown>).detail;
      if (typeof message === 'string' && message)
        setNotices((current) => [
          ...current.slice(-2),
          { id: ++nextId, message },
        ]);
    };
    window.addEventListener('nextplay:notification', receive);
    const pendingTimer = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem('nextplay:saved-preferences')) {
          sessionStorage.removeItem('nextplay:saved-preferences');
          receive(
            new CustomEvent('nextplay:notification', {
              detail: t('Alterações salvas.'),
            }),
          );
        }
      } catch {
        /* Notifications do not require browser storage. */
      }
    }, 0);
    return () => {
      window.clearTimeout(pendingTimer);
      window.removeEventListener('nextplay:notification', receive);
    };
  }, []);
  return (
    <aside
      className="save-notifications"
      aria-label={t('Notificações')}
      aria-live="polite"
      aria-relevant="additions"
    >
      {notices.map((notice) => (
        <NoticeCard key={notice.id} notice={notice} dismiss={dismiss} />
      ))}
    </aside>
  );
}
