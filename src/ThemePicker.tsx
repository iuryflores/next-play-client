import { useEffect, useId, useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { readTheme, rememberTheme, validTheme, type Theme } from './theme';
import { t } from './i18n';

export default function ThemePicker({
  compact = false,
}: {
  compact?: boolean;
}) {
  const id = useId();
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    // Mantém os controles do cabeçalho e do perfil sincronizados na mesma aba.
    const syncLocal = (event: Event) =>
      setTheme((event as CustomEvent<Theme>).detail);
    window.addEventListener('storage', sync);
    window.addEventListener('nextplay:theme', syncLocal);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('nextplay:theme', syncLocal);
    };
  }, []);
  return (
    <div className={`theme-picker${compact ? ' theme-picker-compact' : ''}`}>
      <label htmlFor={id}>{t('Aparência')}</label>
      <NativeSelect
        id={id}
        value={theme}
        onChange={(event) => {
          const selected = validTheme(event.target.value);
          setTheme(selected);
          rememberTheme(selected);
        }}
      >
        <option value="system">{t('Usar tema do dispositivo')}</option>
        <option value="light">{t('Claro')}</option>
        <option value="dark">{t('Escuro')}</option>
      </NativeSelect>
      {!compact && (
        <small>{t('Aplicado imediatamente e salvo neste navegador.')}</small>
      )}
    </div>
  );
}
