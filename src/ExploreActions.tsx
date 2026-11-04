import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CatalogTitle } from './CatalogSearch';
import type { LibraryItem } from './library';
import QuickActions from './QuickActions';
import { t } from './i18n';

export default function ExploreActions({
  title,
  owned,
  changed,
  edit,
  onExpired,
  markWatched,
  showEdit = false,
}: {
  title: CatalogTitle;
  owned?: LibraryItem;
  changed: (item: LibraryItem) => void;
  edit: (item: LibraryItem) => void;
  onExpired: () => void;
  markWatched: () => void;
  showEdit?: boolean;
}) {
  // O card continua ocupando o mesmo lugar. Estado salvo vira feedback local,
  // em vez de remover a sugestão e deslocar todos os cards seguintes.
  return (
    <>
      {title.kind === 'movie' && owned ? (
        <div className="quick-actions">
          <Button className="home-primary" disabled>
            <CheckCheck aria-hidden="true" />
            {t('Adicionado')}
          </Button>
        </div>
      ) : (
        <QuickActions
          title={title}
          owned={owned}
          changed={changed}
          edit={edit}
          onExpired={onExpired}
        />
      )}
      {title.kind === 'movie' && (
        <Button
          variant="outline"
          className="explore-complete-action"
          disabled={owned?.status === 'completed'}
          onClick={markWatched}
        >
          <CheckCheck aria-hidden="true" />
          <span>
            {t(
              owned?.status === 'completed'
                ? 'Assistido'
                : owned
                  ? 'Marcar como assistido'
                  : 'Adicionar como assistido',
            )}
          </span>
        </Button>
      )}
      {showEdit && title.kind === 'movie' && owned?.status === 'completed' && (
        <Button variant="link" onClick={() => edit(owned)}>
          {t('Editar avaliação')}
        </Button>
      )}
    </>
  );
}
