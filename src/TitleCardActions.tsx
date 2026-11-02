import { useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  LoaderCircle,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  libraryRequest,
  priorityLabels,
  type Priority,
  type LibraryItem,
} from './library';
import { ApiError } from './auth';
import { t } from './i18n';

export default function TitleCardActions({
  item,
  edit,
  changed,
  onExpired,
  onError,
}: {
  item: LibraryItem;
  edit: (item: LibraryItem) => void;
  changed: (item: LibraryItem) => void;
  onExpired: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function priority(value: string) {
    if (pending.current || value === (item.priority || 'none')) return;
    pending.current = true;
    setBusy(true);
    onError('');
    try {
      const result = await libraryRequest<{ item: LibraryItem }>(
        'PATCH',
        item.id,
        { priority: value },
        'priority',
      );
      // A resposta isolada não inclui o resumo de episódios já carregado no cartão.
      changed({ ...item, priority: result.item.priority, updatedAt: result.item.updatedAt });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        onError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function archive() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    onError('');
    try {
      // Arquivar muda apenas a visibilidade; o mesmo registro preserva status e progresso.
      const result = await libraryRequest<{ item: LibraryItem }>(
        'POST',
        item.id,
        { archived: !item.archived },
        'archive',
      );
      changed(result.item);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        onError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar.'),
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="edit-item title-card-menu-trigger"
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={t('Opções de {0}', item.title)}
            title={t('Opções de {0}', item.title)}
          />
        }
      >
        {busy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Ellipsis aria-hidden="true" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="title-card-menu"
        sideOffset={6}
      >
        <DropdownMenuItem onClick={() => edit(item)}>
          <Pencil aria-hidden="true" />
          {t('Editar título')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {item.status === 'planned' && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {t('Prioridade em Para depois')}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={item.priority || 'none'}
                onValueChange={(value) => void priority(value)}
              >
                {(Object.keys(priorityLabels) as Priority[]).map((value) => (
                  <DropdownMenuRadioItem
                    key={value}
                    value={value}
                    disabled={busy}
                  >
                    {t(priorityLabels[value])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => void archive()}>
          <span aria-hidden="true">
            {item.archived ? <ArchiveRestore /> : <Archive />}
          </span>
          {t(item.archived ? 'Restaurar ao acompanhamento' : 'Arquivar título')}
        </DropdownMenuItem>
        <p className="title-card-menu-hint">
          {t(
            item.archived
              ? 'O título volta às listas com o progresso preservado.'
              : 'Oculta das listas sem apagar seu progresso. Você pode restaurar em Arquivados.',
          )}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
