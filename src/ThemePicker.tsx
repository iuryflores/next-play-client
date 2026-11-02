import { useEffect, useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { readTheme, rememberTheme, validTheme } from './theme';
import { t } from './i18n';

export default function ThemePicker() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return (
    <div className="theme-picker">
      <label htmlFor="app-theme">{t('Aparência')}</label>
      <NativeSelect
        id="app-theme"
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
      <small>{t('Aplicado imediatamente e salvo neste navegador.')}</small>
    </div>
  );
}
