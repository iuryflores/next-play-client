import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { authRequest } from './auth';
import { language, rememberLanguage, t, validLanguage } from './i18n';
export default function Settings() {
  const [selected, setSelected] = useState(language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="manual-title-page">
      <h2>{t('Configurações')}</h2>
      <form
        className="item-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          try {
            await authRequest('preferences', { language: selected });
            rememberLanguage(selected);
            try {
              sessionStorage.setItem('nextplay:saved-preferences', '1');
            } catch {
              /* Saving preferences still succeeds without browser storage. */
            }
            window.location.reload();
          } catch {
            setError(t('Não foi possível alterar o idioma.'));
            setBusy(false);
          }
        }}
      >
        <label htmlFor="app-language">{t('Idioma do aplicativo')}</label>
        <NativeSelect
          id="app-language"
          value={selected}
          disabled={busy}
          onChange={(event) => setSelected(validLanguage(event.target.value))}
        >
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en-US">English</option>
          <option value="es-ES">Español</option>
        </NativeSelect>
        <p>
          {t(
            'Textos e títulos seguem o idioma escolhido, quando houver tradução no catálogo. Suas anotações e comentários permanecem como foram escritos.',
          )}
        </p>
        <Button type="submit" disabled={busy}>
          {t(busy ? 'Salvando…' : 'Salvar idioma')}
        </Button>
        <output className="home-error" aria-live="polite">
          {error}
        </output>
      </form>
    </section>
  );
}
