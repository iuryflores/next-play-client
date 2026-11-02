import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { t, language } from './i18n';
import { gameActivity } from './game-activity';
import type { LibraryItem } from './library';
import './game-activity.css';

export default function GameActivity({ items }: { items: LibraryItem[] }) {
  const data = gameActivity(items);
  const [expanded, setExpanded] = useState(false);
  const duration = (minutes: number) =>
    `${Math.floor(minutes / 60).toLocaleString(language)}h ${minutes % 60}min`;
  return (
    <section className="game-activity" aria-label={t('Seu tempo nos jogos')}>
      <h2>{t('Seu tempo nos jogos')}</h2>
      <p className="stats-note">
        {t(
          'A taxa de conclusão compara jogos concluídos com o total cadastrado, incluindo arquivados.',
        )}
      </p>
      <p className="stats-note">
        {t(
          'Tempo informado por você no acompanhamento, incluindo jogos arquivados. Jogos sem tempo registrado ficam fora destes rankings.',
        )}
      </p>
      <div className="game-activity-grid">
        <article>
          <h3>{t('Jogos mais jogados')}</h3>
          {data.mostPlayed.length ? (
            <ol>
              {data.mostPlayed
                .slice(0, expanded ? undefined : 5)
                .map((game) => (
                  <li key={game.id}>
                    <a
                      href={`/biblioteca?categoria=game&titulo=${encodeURIComponent(game.id)}`}
                    >
                      {game.coverUrl && (
                        <img
                          src={game.coverUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span>
                        <strong>{game.title}</strong>
                        <small>{game.platform || t('Não informada')}</small>
                      </span>
                    </a>
                    <span>{duration(game.minutes)}</span>
                  </li>
                ))}
            </ol>
          ) : (
            <p>{t('Edite um jogo e informe as horas jogadas para começar.')}</p>
          )}
          {data.mostPlayed.length > 5 && (
            <Button
              variant="outline"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {t(expanded ? 'Mostrar menos' : 'Ver todos')}
            </Button>
          )}
        </article>
        <article>
          <h3>{t('Tempo por plataforma')}</h3>
          {data.platforms.length ? (
            <ul>
              {data.platforms.map((platform) => (
                <li className="game-platform-time" key={platform.name}>
                  <span>{platform.name || t('Não informada')}</span>
                  <strong>{duration(platform.minutes)}</strong>
                  <progress
                    aria-label={platform.name || t('Não informada')}
                    value={platform.minutes}
                    max={data.totalMinutes}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('Nenhum tempo jogado registrado ainda.')}</p>
          )}
        </article>
      </div>
    </section>
  );
}
