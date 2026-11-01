import Settings from './Settings';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import IconAction from './IconAction';
import { Camera, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, authRequest, type AuthUser } from './auth';
import { t } from './i18n';

async function preparePhoto(file: File): Promise<string> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error(t('Escolha uma foto JPG, PNG ou WebP de até 10 MB.'));
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error();
    const size = Math.min(bitmap.width, bitmap.height);
    ctx.fillStyle = '#211a2d';
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(
      bitmap,
      (bitmap.width - size) / 2,
      (bitmap.height - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256,
    );
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    bitmap.close();
  }
}

export default function Account({
  user,
  onSaved,
  onExpired,
}: {
  user: AuthUser;
  onSaved: (user: AuthUser) => void;
  onExpired: () => void;
}) {
  const [name, setName] = useState(user.displayName || '');
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const emailChanged = email.trim().toLowerCase() !== user.email;
  return (
    <section className="account-page">
      <h1>{t(' Minha conta ')}</h1>
      <p>{t('Sua foto e seus dados, do seu jeito.')}</p>
      <form
        className="item-form account-form"
        onChange={() => setSaved(false)}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || processing) return;
          setBusy(true);
          setError('');
          setSaved(false);
          try {
            const result = await authRequest<{ user: AuthUser }>('profile', {
              displayName: name.trim(),
              email: email.trim(),
              ...(avatar !== (user.avatar || '') ? { avatar } : {}),
              ...(emailChanged ? { currentPassword: password } : {}),
            });
            onSaved(result.user);
            setName(result.user.displayName || '');
            setEmail(result.user.email);
            setAvatar(result.user.avatar || '');
            setPassword('');
            setSaved(true);
          } catch (reason) {
            if (reason instanceof ApiError && reason.status === 401)
              onExpired();
            else
              setError(
                reason instanceof Error
                  ? reason.message
                  : t('Não foi possível salvar.'),
              );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || processing}>
          <legend>{t('Perfil')}</legend>
          <div className="account-photo-row">
            <div className="account-photo">
              {avatar ? (
                <img src={avatar} alt={t('Foto do perfil')} />
              ) : (
                <UserRound aria-hidden="true" />
              )}
            </div>
            <div className="account-photo-actions">
              <label htmlFor="profile-photo">
                <Camera aria-hidden="true" /> {t('Escolher foto')}
              </label>
              <Input
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  setProcessing(true);
                  setError('');
                  setSaved(false);
                  try {
                    setAvatar(await preparePhoto(file));
                  } catch (reason) {
                    setError(
                      reason instanceof Error && reason.message
                        ? reason.message
                        : t('Foto inválida. Escolha outra imagem.'),
                    );
                  } finally {
                    setProcessing(false);
                  }
                }}
              />
              <small>
                {t(
                  'JPG, PNG ou WebP, até 10 MB. A foto será recortada ao centro.',
                )}
              </small>
              {avatar && (
                <IconAction
                  icon={Trash2}
                  label={t('Remover foto')}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setAvatar('');
                    setSaved(false);
                  }}
                />
              )}
            </div>
          </div>
          <label htmlFor="profile-name">{t('Nome de exibição')}</label>
          <Input
            id="profile-name"
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
          />
          <small>{t('Este nome também aparece no ranking de amigos.')}</small>
          <label htmlFor="profile-email">{t('E-mail')}</label>
          <Input
            id="profile-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
          {emailChanged && (
            <>
              <label htmlFor="profile-password">{t('Senha atual')}</label>
              <Input
                id="profile-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={128}
              />
              <small>
                {t('Confirme sua senha para alterar o e-mail de acesso.')}
              </small>
            </>
          )}
        </fieldset>
        <output className="home-error" aria-live="polite">
          {error}
        </output>
        <output className="account-success" aria-live="polite">
          {saved
            ? t('Perfil atualizado.')
            : processing
              ? t('Preparando foto…')
              : ''}
        </output>
        <Button type="submit" disabled={busy || processing}>
          {t(busy ? 'Salvando…' : 'Salvar alterações')}
        </Button>
      </form>
      <div className="account-settings">
        <Settings />
      </div>
    </section>
  );
}
