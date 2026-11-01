import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import IconAction from './IconAction';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { libraryRequest, type LibraryItem } from './library';
import { ApiError } from './auth';
import { t } from './i18n';
export default function CollectionActions({
  item,
  changed,
  removed,
  back,
  onExpired,
}: {
  item: LibraryItem;
  changed: (item: LibraryItem) => void;
  removed: (id: string) => void;
  back: () => void;
  onExpired: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(remove: boolean) {
    if (busy || (!remove && !item.archived && item.status === 'completed'))
      return;
    setBusy(true);
    setError('');
    try {
      if (remove) {
        await libraryRequest('DELETE', item.id);
        removed(item.id);
      } else {
        const result = await libraryRequest<{ item: LibraryItem }>(
          'POST',
          item.id,
          { archived: !item.archived },
          'archive',
        );
        changed(result.item);
      }
      setConfirm(false);
      back();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {item.archived && <p>{t('Arquivado')}</p>}
      <div className="title-details-actions">
        <IconAction
          icon={item.archived ? ArchiveRestore : Archive}
          label={t(item.archived ? 'Restaurar à coleção' : 'Arquivar título')}
          variant="ghost"
          disabled={busy || (!item.archived && item.status === 'completed')}
          onClick={() => void run(false)}
        />
        <IconAction
          icon={Trash2}
          label={t('Remover da coleção')}
          variant="ghost"
          className="remove-item"
          disabled={busy}
          onClick={() => setConfirm(true)}
        />
      </div>
      <output className="home-error" aria-live="polite">
        {!confirm && error}
      </output>
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogTitle>
            {t('Remover da coleção')} · {item.title}
          </DialogTitle>
          <DialogDescription>
            {t(
              'A remoção apaga seu acompanhamento e suas avaliações deste título. Para guardar seu progresso e apenas ocultar o título, use Arquivar.',
            )}
          </DialogDescription>
          <output className="home-error" aria-live="polite">
            {error}
          </output>
          <div className="item-form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              {t('Cancelar')}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void run(true)}
            >
              {t(busy ? 'Salvando…' : 'Confirmar remoção')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
