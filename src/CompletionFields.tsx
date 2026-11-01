import { t } from './i18n';
import { useState } from 'react';
import { ReviewFields } from './Review';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  statusNames,
  type Kind,
  type Status,
  type LibraryItem,
} from './library';
export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export default function CompletionFields({
  item,
  kind,
  initialStatus,
}: {
  item: LibraryItem | null;
  kind: Kind;
  initialStatus: Status;
}) {
  const [selectedStatus, setStatus] = useState(initialStatus);
  const status =
    kind === 'movie' && selectedStatus === 'active'
      ? 'planned'
      : selectedStatus;

  return (
    <div className="completion-fields">
      <label htmlFor="item-status">{t(' Acompanhamento ')}</label>
      <NativeSelect
        id="item-status"
        name="status"
        value={status}
        onChange={(event) => setStatus(event.target.value as Status)}
      >
        {(Object.keys(statusNames[kind]) as Status[])
          .filter((value) => kind !== 'movie' || value !== 'active')
          .map((value) => (
            <option key={value} value={value}>
              {statusNames[kind][value]}
            </option>
          ))}
      </NativeSelect>
      {item?.status === 'completed' && status !== 'completed' && (
        <small>
          {t(
            ' Ao salvar este status, a data, a avaliação e o voto de conclusão serão removidos. Seus comentários continuam publicados. ',
          )}
        </small>
      )}
      {status === 'completed' && kind === 'series' && (
        <small>
          {t(
            ' Ao salvar como concluída, todos os episódios regulares já lançados serão marcados como assistidos e somados às estatísticas. A importação pode levar alguns instantes. ',
          )}
        </small>
      )}
      {status === 'completed' && (
        <fieldset className="completion-review">
          <legend>{t(' Sua experiência ')}</legend>
          <label htmlFor="completed-on">
            {kind === 'book'
              ? t('Lido em')
              : kind === 'movie'
                ? t('Assistido em')
                : t('Concluído em')}
          </label>
          <Input
            type="date"
            lang="pt-BR"
            id="completed-on"
            name="completedOn"
            defaultValue={item?.completedOn || today()}
            max={today()}
            required
          />
          <ReviewFields
            showCharacter={kind !== 'book'}
            initial={item || undefined}
            target={item ? { itemId: item.id } : undefined}
          />
        </fieldset>
      )}
    </div>
  );
}
