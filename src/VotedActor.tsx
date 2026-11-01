import { useState } from 'react';
import { t } from './i18n';
import type { ActorVoteSource } from './stats-summary';
import { Button } from '@/components/ui/button';
import { Film, Tv } from 'lucide-react';

export default function VotedActor({
  name,
  photo,
  count,
  sources,
}: {
  name: string;
  photo: string;
  count: number;
  sources?: ActorVoteSource[];
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [sourceLimit, setSourceLimit] = useState(3);
  return (
    <div>
      <div className="voted-character">
        <span className="voted-character-photo" aria-hidden="true">
          {photo && !imageFailed ? (
            <img
              src={photo}
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
        </div>
        <span className="voted-character-count">
          {count} {t(count === 1 ? 'voto' : 'votos')}
        </span>
      </div>
      {!!sources?.length && (
        <div className="actor-vote-sources" aria-label={t('Origem dos votos')}>
          {sources.slice(0, sourceLimit).map((source) => (
            <div className="actor-vote-source" key={source.itemId}>
              {source.kind === 'movie' ? (
                <Film aria-label={t('Filmes')} />
              ) : (
                <Tv aria-label={t('Séries')} />
              )}
              <span>{source.title}</span>
              <span>
                {source.count} {t(source.count === 1 ? 'voto' : 'votos')}
              </span>
            </div>
          ))}
          {sourceLimit < sources.length && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSourceLimit((value) => value + 5)}
            >
              {t('Ver mais títulos')}
            </Button>
          )}
          {sourceLimit > 3 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSourceLimit(3)}
            >
              {t('Ver menos')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
