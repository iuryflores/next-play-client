import { useId, useState } from 'react';
import { t } from './i18n';
import { Input } from '@/components/ui/input';

export default function WatchDateField({
  initialUnknown = false,
  initialDate,
  withDate = false,
  disabled = false,
}: {
  initialUnknown?: boolean;
  initialDate?: string;
  withDate?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [unknown, setUnknown] = useState(initialUnknown);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return (
    <fieldset disabled={disabled} className="watch-date-field">
      <legend>{t('Data em que assistiu')}</legend>
      {/* Campo explícito permite preservar a escolha ao editar sem inventar uma data. */}
      <input type="hidden" name="watchedDateUnknown" value={String(unknown)} />
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={unknown}
          onChange={(event) => setUnknown(event.target.checked)}
        />{' '}
        {t('Não sei a data')}
      </label>
      {withDate && !unknown && (
        <Input
          aria-label={t('Assistido em')}
          type="date"
          name="completedOn"
          defaultValue={initialDate || today}
          max={today}
          required
        />
      )}
      {unknown && (
        <small>
          {t('Conta como assistido, sem atribuir uma data ao consumo.')}
        </small>
      )}
    </fieldset>
  );
}
