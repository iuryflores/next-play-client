import { useId } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { t } from './i18n';

export default function MaxAgeFilter({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="catalog-filter-field">
      <label htmlFor={id}>{t('Classificação máxima (Brasil)')}</label>
      <NativeSelect id={id} value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{t('Todas as classificações')}</option>
        <option value="0">{t('Livre')}</option>
        {/* O catálogo e as telas de obras salvas compartilham as faixas brasileiras. */}
        {[6, 10, 12, 14, 16, 18].map(age => (
          <option key={age} value={age}>{t('Até {0} anos', age)}</option>
        ))}
      </NativeSelect>
    </div>
  );
}
