import { useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ApiError } from './auth';
import { libraryRequest, type LibraryItem } from './library';
import { t } from './i18n';

export default function SeriesRating({
  item,
  changed,
  onExpired,
}: {
  item: LibraryItem;
  changed: (item: LibraryItem) => void;
  onExpired: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(item.stars || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const labels = [
    t('Ruim'),
    t('Regular'),
    t('Bom'),
    t('Muito bom'),
    t('Excelente'),
  ];
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await libraryRequest<{ item: LibraryItem }>(
        'PATCH',
        item.id,
        { stars },
        'rating',
      );
      // A resposta da nota não traz o resumo de episódios; mantém o progresso já exibido na página.
      changed({ ...item, ...result.item });
      setOpen(false);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : t('Não foi possível salvar. Tente novamente.'),
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        className="series-rating-trigger"
        onClick={() => {
          setStars(item.stars || 0);
          setError('');
          setOpen(true);
        }}
      >
        <Star aria-hidden="true" />
        {t(item.stars ? 'Editar avaliação' : 'Avaliar série')}
        {!!item.stars && <span>{item.stars}/5</span>}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending.current) setOpen(value);
        }}
      >
        <DialogContent
          className="item-dialog series-rating-dialog"
          overlayClassName="review-dialog-backdrop"
        >
          <DialogTitle>{t('Avaliar série')}</DialogTitle>
          <DialogDescription>
            {item.title} ·{' '}
            {t('Sua nota geral, sem alterar o progresso dos episódios.')}
          </DialogDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset className="star-rating" disabled={busy}>
              <legend>{t('De ruim a excelente')}</legend>
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} title={labels[value - 1]}>
                  <input
                    type="radio"
                    name="stars"
                    value={value}
                    checked={stars === value}
                    onChange={() => setStars(value)}
                    aria-label={t(
                      '{0} estrelas: {1}',
                      value,
                      labels[value - 1],
                    )}
                  />
                  <span
                    className={stars >= value ? 'filled' : ''}
                    aria-hidden="true"
                  >
                    ★
                  </span>
                </label>
              ))}
              <Button type="button" variant="ghost" onClick={() => setStars(0)}>
                {t('Sem nota')}
              </Button>
              <p aria-live="polite">
                {stars ? labels[stars - 1] : t('Avaliação opcional')}
              </p>
            </fieldset>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="item-form-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t('Cancelar')}
              </Button>
              <Button type="submit" disabled={busy}>
                {t(busy ? 'Salvando…' : 'Salvar avaliação')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
