import { useState, type FormEvent } from 'react';
import { CircleAlert, Mail, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authRequest } from './auth';
import { t } from './i18n';

export default function PasswordRecovery({ token, back }: { token: string; back: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    if (token && data.get('password') !== data.get('confirm')) {
      setError(t('As senhas não coincidem.')); return;
    }
    setBusy(true); setError('');
    try {
      await authRequest(token ? 'reset-password' : 'forgot-password', token
        ? { token, password: data.get('password') }
        : { email: data.get('email') });
      setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('Não foi possível conectar à API. Confira se o servidor está rodando.')); }
    finally { setBusy(false); }
  }
  return <main className="recovery-shell">
    <section className="recovery-card" aria-labelledby="recovery-title">
      <p className="eyebrow">NextPlay</p>
      <h1 id="recovery-title">{t(token ? 'Definir nova senha' : 'Recuperar senha')}</h1>
      {done ? <div className="recovery-success" role="status">
        <CheckCircle2 aria-hidden="true" />
        <p>{t(token ? 'Senha atualizada. Entre com sua nova senha.' : 'Se houver uma conta com esse e-mail, enviaremos um link de recuperação.')}</p>
        {!token && <p>{t('O link vale por 15 minutos. Confira também a pasta de spam.')}</p>}
      </div> : <>
        <p>{t(token ? 'Escolha uma senha de 12 a 128 caracteres.' : 'Informe o e-mail da sua conta para receber um link de recuperação.')}</p>
        <form className="login-form" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy} className="recovery-fields">
            {token ? <>
              <label htmlFor="new-password">{t('Nova senha')}</label>
              <Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
              <label htmlFor="confirm-password">{t('Confirmar nova senha')}</label>
              <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
            </> : <>
              <label htmlFor="recovery-email">{t('E-mail')}</label>
              <Input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} />
            </>}
          </fieldset>
          <div className="form-notice" role="alert">{error && <><CircleAlert aria-hidden="true" /><span>{error}</span></>}</div>
          <Button className="submit-button" type="submit" disabled={busy}>{busy ? t('Aguarde…') : t(token ? 'Salvar nova senha' : 'Enviar link')}<Mail aria-hidden="true" /></Button>
        </form>
      </>}
      <Button variant="link" className="register-toggle" disabled={busy} onClick={back}>{t('Voltar ao login')}</Button>
    </section>
  </main>;
}
