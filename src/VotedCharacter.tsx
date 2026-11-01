import { useEffect, useState } from 'react';
import { t } from './i18n';
type CastMember = { character: string; actor: string; photo: string };
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
export default function VotedCharacter({
  itemId,
  name,
  title,
  count,
}: {
  itemId: string;
  name: string;
  title: string;
  count: number;
}) {
  const [member, setMember] = useState<CastMember | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/library/${encodeURIComponent(itemId)}/cast`, {
      credentials: 'same-origin',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { cast?: CastMember[] };
        if (!controller.signal.aborted && Array.isArray(data.cast))
          setMember(
            data.cast.find(
              (candidate) => normalize(candidate.character) === normalize(name),
            ) || null,
          );
      })
      .catch(() => {
        /* Keep the character's initials when cast information is unavailable. */
      });
    return () => controller.abort();
  }, [itemId, name]);
  return (
    <div className="voted-character">
      <span className="voted-character-photo" aria-hidden="true">
        {member?.photo && !imageFailed ? (
          <img
            src={member.photo}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>
      <div className="voted-character-info">
        <strong>{name}</strong>
        {member?.actor && (
          <small className="voted-character-actor">{member.actor}</small>
        )}
        <small className="voted-character-series">{title}</small>
      </div>
      <span className="voted-character-count">
        {count} {t(count === 1 ? 'voto' : 'votos')}
      </span>
    </div>
  );
}
