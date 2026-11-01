import { BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OwnedCopy } from './collector-client';
import type { LibraryItem } from './library';
import { statusNames } from './library';
import { readingForCopy } from './book-reading-link';
import { t, genreLabel } from './i18n';

export default function CollectorBookDetails({
  copy,
  items,
  close,
}: {
  copy: OwnedCopy | null;
  items: LibraryItem[];
  close: () => void;
}) {
  const reading = copy ? readingForCopy(items, copy) : undefined;
  // A consulta usa os dados já carregados: abrir detalhes não altera posse nem leitura.
  const fields = copy
    ? [
        [t('Autor(es)'), copy.authors?.join(' · ')],
        [t('Editora'), copy.publisher],
        [t('Ano'), copy.year],
        ['ISBN', copy.isbn],
        [t('Idioma'), copy.language],
        [t('Formato'), t(copy.format === 'physical' ? 'Físico' : 'Digital')],
        [t('Edição'), copy.edition],
        [t('Plataforma'), copy.platform],
        [t('Gêneros'), copy.genres?.map(genreLabel).join(' · ')],
        [
          t('Leitura'),
          reading
            ? statusNames.book[reading.status]
            : t('Ainda não acompanhado'),
        ],
      ].filter(([, value]) => value?.trim())
    : [];
  return (
    <Dialog
      open={copy !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="collector-dialog collector-book-details">
        <DialogTitle>{copy?.title}</DialogTitle>
        <DialogDescription>
          {t('Detalhes do livro e do seu exemplar.')}
        </DialogDescription>
        {copy && (
          <>
            <div className="collector-details-cover">
              {copy.coverUrl ? (
                <img src={copy.coverUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <BookOpen aria-hidden="true" />
              )}
            </div>
            <dl>
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {copy.notes.trim() && (
              <section>
                <h3>{t('Anotações do exemplar')}</h3>
                <p className="collector-notes">{copy.notes}</p>
              </section>
            )}
            {copy.catalogId?.startsWith('googlebooks:book:') && (
              <a
                className="collector-book-source"
                href={`https://books.google.com/books?id=${encodeURIComponent(copy.catalogId.slice(17))}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('Ver no Google Books')} ↗
              </a>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
