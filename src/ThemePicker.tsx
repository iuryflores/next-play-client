import { useEffect, useId, useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { readTheme, rememberTheme, validTheme, type Theme } from './theme';
import { t } from './i18n';
import { authRequest } from './auth';

export default function ThemePicker({
  compact = false,
  account = false,
}: {
  compact?: boolean;
  account?: boolean;
}) {
  const id = useId();
  const [theme, setTheme] = useState(readTheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    // Mantém os controles do cabeçalho e do perfil sincronizados na mesma aba.
    const syncLocal = (event: Event) =>
      setTheme((event as CustomEvent<Theme>).detail);
    window.addEventListener('nextplay:theme', syncLocal);
    return () => {
      window.removeEventListener('nextplay:theme', syncLocal);
    };
  }, []);
  return (
    <div className={`theme-picker${compact ? ' theme-picker-compact' : ''}`}>
      <label htmlFor={id}>{t('Aparência')}</label>
      <NativeSelect
        id={id}
        value={theme}
        disabled={saving}
        onChange={async (event) => {
          const selected = validTheme(event.target.value);
          setSaving(true);
          setError('');
          try {
            if (account) await authRequest('preferences', { theme: selected });
            // Só confirma a aparência da conta após o banco aceitar a alteração.
            rememberTheme(selected);
          } catch {
            setError(
              t('Não foi possível salvar a aparência. Tente novamente.'),
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <option value="system">{t('Usar tema do dispositivo')}</option>
        <option value="light">{t('Claro')}</option>
        <option value="dark">{t('Escuro')}</option>
      </NativeSelect>
      {!compact && (
        <small>
          {t(
            account
              ? 'Salvo na sua conta e aplicado ao entrar em qualquer dispositivo.'
              : 'Entre na sua conta para salvar a aparência. Antes de entrar, a escolha vale apenas nesta sessão.',
          )}
        </small>
      )}
      <output className="home-error" aria-live="polite">
        {error}
      </output>
    </div>
  );
}
