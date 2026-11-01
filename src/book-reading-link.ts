import type { LibraryItem } from './library';
import type { OwnedCopy } from './collector-client';

const titleKey = (title: string) => title.trim().toLocaleLowerCase('pt-BR');

export function readingForCopy(items: LibraryItem[], copy: OwnedCopy) {
  if (copy.kind !== 'book') return undefined;
  // Uma edição identificada não é confundida com outra só porque compartilham o título.
  // Sem catálogo, usamos a mesma identidade por título do cadastro manual da biblioteca.
  return items.find(
    (item) =>
      item.kind === 'book' &&
      (copy.catalogId
        ? item.catalogId === copy.catalogId
        : !item.catalogId && titleKey(item.title) === titleKey(copy.title)),
  );
}
