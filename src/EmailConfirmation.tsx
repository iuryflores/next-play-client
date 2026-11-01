import { useState, type FormEvent } from 'react';
import { CircleAlert, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authRequest } from './auth';
import { t } from './i18n';

export default function EmailConfirmation({ token, initialEmail = '', back }: { token: string; initialEmail?: string; back: () => void }) {
  const [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  async function confirm() {
    setBusy(true); setError('');
    // A ação explícita evita consumir o token ao abrir o link ou examinar o e-mail.
    try { await authRequest('confirm-email', { token }); setConfirmed(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('Não foi possível confirmar o e-mail.')); }
    finally { setBusy(false); }
  }
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    if (Date.now() < cooldown) { setError(t('Aguarde um minuto antes de solicitar outro e-mail.')); return; }
    const data = new FormData(event.currentTarget); setBusy(true); setError(''); setNotice('');
    try { await authRequest('resend-confirmation', { email: data.get('email') }); setCooldown(Date.now() + 60000); setNotice(t('Se houver uma conta aguardando confirmação, enviaremos um novo link.')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('Não foi possível enviar o e-mail.')); }
    finally { setBusy(false); }
  }
  return <main className="recovery-shell"><section className="recovery-card" aria-labelledby="confirmation-title">
    <p className="eyebrow">NextPlay</p>
    <h1 id="confirmation-title">{t(confirmed ? 'E-mail confirmado' : 'Confirme seu e-mail')}</h1>
    {confirmed ? <div className="recovery-success" role="status"><MailCheck aria-hidden="true" /><p>{t('E-mail confirmado. Você já pode entrar na sua conta.')}</p></div> : <>
      <p>{t(token ? 'Confirme este endereço para ativar sua conta NextPlay.' : 'Enviamos um link para confirmar seu e-mail. Confira sua caixa de entrada e a pasta de spam.')}</p>
      {token && <Button className="submit-button" disabled={busy} onClick={() => void confirm()}>{t(busy ? 'Aguarde…' : 'Confirmar meu e-mail')}</Button>}
      <p>{t('O link vale por 24 horas. Precisa de outro?')}</p>
      <form className="login-form" onSubmit={resend} aria-busy={busy}>
        <label htmlFor="confirmation-email">{t('E-mail')}</label>
        <Input id="confirmation-email" name="email" type="email" autoComplete="email" defaultValue={initialEmail} required maxLength={254} disabled={busy} />
        <Button variant="outline" type="submit" disabled={busy}>{t('Reenviar confirmação')}</Button>
      </form>
      <div className="form-notice" role="alert">{error && <><CircleAlert aria-hidden="true" /><span>{error}</span></>}</div>
      {notice && <p role="status" className="recovery-success">{notice}</p>}
    </>}
    <Button variant="link" className="register-toggle" disabled={busy} onClick={back}>{t('Voltar ao login')}</Button>
  </section></main>;
}
