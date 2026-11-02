import { useEffect, useId, useRef, useState } from 'react';
import { Sun, Moon, Monitor, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
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
  const pending = useRef(false);
  async function select(selected: Theme) {
    if (pending.current || selected === theme) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      if (account) await authRequest('preferences', { theme: selected });
      // Só confirma a aparência da conta após o banco aceitar a alteração.
      rememberTheme(selected);
    } catch {
      setError(t('Não foi possível salvar a aparência. Tente novamente.'));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    // Mantém os controles do cabeçalho e do perfil sincronizados na mesma aba.
    const syncLocal = (event: Event) =>
      setTheme((event as CustomEvent<Theme>).detail);
    window.addEventListener('nextplay:theme', syncLocal);
    return () => {
      window.removeEventListener('nextplay:theme', syncLocal);
    };
  }, []);
  if (compact) {
    const Icon = saving
      ? LoaderCircle
      : theme === 'dark'
        ? Moon
        : theme === 'light'
          ? Sun
          : Monitor;
    const currentLabel = t(
      theme === 'dark'
        ? 'Escuro'
        : theme === 'light'
          ? 'Claro'
          : 'Usar tema do dispositivo',
    );
    return (
      <div className="theme-picker-icon">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="theme-icon-button"
                disabled={saving}
                aria-busy={saving}
                aria-label={t('Aparência: {0}', currentLabel)}
                title={t('Aparência: {0}', currentLabel)}
              />
            }
          >
            <Icon
              aria-hidden="true"
              className={saving ? 'animate-spin' : undefined}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            className="theme-options-menu"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('Aparência')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => void select(validTheme(value))}
              >
                <DropdownMenuRadioItem value="light" disabled={saving}>
                  <Sun aria-hidden="true" />
                  {t('Claro')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" disabled={saving}>
                  <Moon aria-hidden="true" />
                  {t('Escuro')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" disabled={saving}>
                  <Monitor aria-hidden="true" />
                  {t('Usar tema do dispositivo')}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <output className="theme-picker-error" aria-live="polite">
          {error}
        </output>
      </div>
    );
  }
  return (
    <div className={`theme-picker${compact ? ' theme-picker-compact' : ''}`}>
      <label htmlFor={id}>{t('Aparência')}</label>
      <NativeSelect
        id={id}
        value={theme}
        disabled={saving}
        onChange={(event) => void select(validTheme(event.target.value))}
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
