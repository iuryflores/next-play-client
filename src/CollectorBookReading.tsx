import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from './auth';
import {
  libraryRequest,
  statusNames,
  type LibraryItem,
  type Status,
} from './library';
import type { OwnedCopy } from './collector-client';
import { readingForCopy } from './book-reading-link';
import { t } from './i18n';

export default function CollectorBookReading({
  copy,
  items,
  disabled,
  changed,
  onExpired,
}: {
  copy: OwnedCopy;
  items: LibraryItem[];
  disabled: boolean;
  changed: (item: LibraryItem) => void;
  onExpired: () => void;
}) {
  const item = readingForCopy(items, copy);
  const [selected, setSelected] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  async function save() {
    if (pending.current || disabled || !selected) return;
    const status = selected;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      // Relê antes de salvar: outra cópia ou aba pode já ter iniciado o acompanhamento.
      // Notas de posse nunca são copiadas para as anotações privadas da leitura.
      const current = await libraryRequest<{ items: LibraryItem[] }>();
      const existing = readingForCopy(current.items, copy);
      const result = await libraryRequest<{ item: LibraryItem }>(
        existing ? 'PATCH' : 'POST',
        existing?.id,
        {
          title: existing?.title || copy.title,
          kind: 'book',
          status,
          ...(existing
            ? { notes: existing.notes }
            : copy.catalogId
              ? { catalogId: copy.catalogId }
              : {}),
          // A API define a data de hoje para uma nova conclusão e preserva a avaliação
          // e a data existentes quando o livro já está lido. O atalho não envia campos vazios.
        },
      );
      changed(result.item);
      setSelected(null);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="collector-reading">
      <small>
        {t('Leitura')}
        {item ? ` · ${statusNames.book[item.status]}` : ''}
        {item?.archived ? ` · ${t('Arquivados')}` : ''}
      </small>
      <div
        className="collector-reading-actions"
        aria-label={t('Leitura de {0}', copy.title)}
      >
        {(['planned', 'active', 'completed'] as const).map((status) => (
          <Button
            key={status}
            variant={item?.status === status ? 'default' : 'outline'}
            aria-pressed={item?.status === status}
            disabled={disabled || saving}
            onClick={() => {
              setError('');
              setSelected(status);
            }}
          >
            {statusNames.book[status]}
          </Button>
        ))}
      </div>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setSelected(null);
        }}
      >
        <DialogContent className="collector-dialog" showCloseButton={!saving}>
          <DialogTitle>
            {selected &&
              t(
                'Marcar “{0}” como “{1}”?',
                copy.title,
                statusNames.book[selected],
              )}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Atualiza seu acompanhamento de leitura sem alterar os exemplares da coleção.',
            )}
          </DialogDescription>
          {item?.status === 'completed' && selected !== 'completed' && (
            <p className="collector-hint">
              {t(
                'Ao salvar este status, a data, a avaliação e o voto de conclusão serão removidos. Seus comentários continuam publicados.',
              )}
            </p>
          )}
          {error && (
            <div className="home-error" role="alert">
              {error}
            </div>
          )}
          <div className="collector-dialog-actions">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setSelected(null)}
            >
              {t('Não')}
            </Button>
            <Button
              type="button"
              disabled={saving || disabled}
              onClick={() => void save()}
            >
              {t(saving ? 'Salvando…' : 'Sim')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
