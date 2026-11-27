import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { t } from './i18n';
import './catalog-preview.css';

export type TitleGroups = { franchise: string; universe: string };

export default function TitleGroupFilters({ value, allowUniverse, onApply }: {
  value: TitleGroups;
  allowUniverse: boolean;
  onApply: (value: TitleGroups) => void;
}) {
  const id = useId();
  const [franchise, setFranchise] = useState(value.franchise);
  const [universe, setUniverse] = useState(value.universe);
  const appliedUniverse = allowUniverse ? value.universe : '';
  const count = Number(Boolean(value.franchise)) + Number(Boolean(appliedUniverse));
  const valid = (term: string) => !term.trim() || (term.trim().length >= 2 && /[\p{L}\p{N}]/u.test(term));
  return (
    <details className="catalog-genre-filter title-group-filter">
      <summary>
        {t(allowUniverse ? 'Franquia e universo' : 'Franquia')}{count ? ` (${count})` : ''}
      </summary>
      <form className="catalog-group-fields" onSubmit={event => {
        event.preventDefault();
        // Aplica os termos juntos para evitar consultas enquanto o usuário digita.
        if (valid(franchise) && (!allowUniverse || valid(universe)))
          onApply({ franchise: franchise.trim(), universe: allowUniverse ? universe.trim() : value.universe });
      }}>
        <div className="catalog-origin-fields">
          <div className="catalog-filter-field">
            <label htmlFor={id + '-franchise'}>{t('Franquia')}</label>
            <Input id={id + '-franchise'} value={franchise} maxLength={100}
              onChange={event => setFranchise(event.target.value)} />
          </div>
          {allowUniverse && (
            <div className="catalog-filter-field">
              <label htmlFor={id + '-universe'}>{t('Universo')}</label>
              <Input id={id + '-universe'} value={universe} maxLength={100} placeholder={t('Ex.: MCU')}
                onChange={event => setUniverse(event.target.value)} />
            </div>
          )}
        </div>
        <div className="catalog-group-actions">
          <Button type="submit" variant="outline" disabled={!valid(franchise) || (allowUniverse && !valid(universe))}>
            {t('Aplicar filtros')}
          </Button>
          {count > 0 && <Button type="button" variant="ghost" onClick={() => {
            setFranchise('');
            if (allowUniverse) setUniverse('');
            onApply({ franchise: '', universe: allowUniverse ? '' : value.universe });
          }}>{t('Limpar filtros')}</Button>}
        </div>
      </form>
    </details>
  );
}
