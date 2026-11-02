import PageLoading from './PageLoading';
import ThemePicker from './ThemePicker';
import PageBoundary from './PageBoundary';
import PasswordRecovery from './PasswordRecovery';
import EmailConfirmation from './EmailConfirmation';
import { t } from './i18n';
import { lazy, useEffect, useState, type SubmitEvent } from 'react';
import { ApiError, authRequest, type AuthUser } from './auth';
import { language, rememberLanguage, validLanguage } from './i18n';
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  Film,
  Gamepad2,
  BookOpen,
  LockKeyhole,
  Mail,
  Smartphone,
  Tv,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// A biblioteca e as telas internas só são baixadas quando existe uma sessão.
const Home = lazy(() => import('./Home'));

type LoginMethod = 'email' | 'phone';

export default function LoginPage() {
  // O segredo fica apenas na memória após remover o fragmento da barra de endereço.
  const [resetToken, setResetToken] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get(
        'reset-password',
      ) || '',
  );
  const [recovering, setRecovering] = useState(() =>
    window.location.hash.startsWith('#reset-password='),
  );
  const [verificationToken, setVerificationToken] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get('verify-email') ||
      '',
  );
  const [verifyingEmail, setVerifyingEmail] = useState(() =>
    window.location.hash.startsWith('#verify-email='),
  );
  const [pendingEmail, setPendingEmail] = useState('');
  const [method, setMethod] = useState<LoginMethod>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  // Links de recuperação/confirmação abrem seu fluxo diretamente, sem outra renderização de sessão.
  const [checking, setChecking] = useState(
    () => !recovering && !verifyingEmail,
  );
  const [registering, setRegistering] = useState(false);
  // O login pode aparecer antes dos provedores; cadastro só é oferecido após confirmação da API.
  const [canRegister, setCanRegister] = useState(false);
  function acceptUser(value: AuthUser) {
    if (value.requiresVerification) {
      setUser(null);
      setPendingEmail(value.email);
      setVerifyingEmail(true);
      return;
    }
    const selected = validLanguage(value.language);
    if (selected !== language) {
      rememberLanguage(selected);
      window.location.reload();
      return;
    }
    setUser(value);
  }

  useEffect(() => {
    if (recovering || verifyingEmail) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
      return;
    }
    let active = true;
    async function restore() {
      // As formas de cadastro não precisam atrasar a consulta da sessão existente.
      void authRequest<{ registration: boolean }>('providers')
        .then((providers) => {
          if (active) setCanRegister(providers.registration);
        })
        .catch(() => {
          /* Uma falha nos provedores não impede entrar por e-mail. */
        });
      try {
        const result = await authRequest<{ user: AuthUser }>('me');
        if (active) acceptUser(result.user);
      } catch (error) {
        if (active && !(error instanceof ApiError && error.status === 401))
          setNotice(
            error instanceof Error
              ? error.message
              : t('Não foi possível consultar sua sessão.'),
          );
      } finally {
        if (active) setChecking(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [recovering, verifyingEmail]);

  function switchMethod(next: LoginMethod) {
    if (busy) return;
    setMethod(next);
    setRegistering(false);
    setShowPassword(false);
    setNotice('');
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setNotice('');
    try {
      if (method === 'phone')
        await authRequest('phone/start', { phone: data.get('phone') });
      else {
        const result = await authRequest<{
          user?: AuthUser;
          requiresVerification?: boolean;
        }>(registering ? 'register' : 'login', {
          email: data.get('email'),
          password: data.get('password'),
        });
        form.reset();
        setShowPassword(false);
        if (result.requiresVerification) {
          const emailValue = data.get('email');
          setPendingEmail(typeof emailValue === 'string' ? emailValue : '');
          setVerifyingEmail(true);
        } else if (result.user) acceptUser(result.user);
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : t('Não foi possível entrar.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function googleLogin() {
    setBusy(true);
    setNotice('');
    try {
      await authRequest('google/start', {});
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : t('Google indisponível.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setNotice('');
    try {
      await authRequest('logout', {});
      setUser(null);
      setRegistering(false);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : t('Não foi possível sair.'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (verifyingEmail)
    return (
      <EmailConfirmation
        token={verificationToken}
        initialEmail={pendingEmail}
        back={() => {
          setVerificationToken('');
          setVerifyingEmail(false);
          setRegistering(false);
          setNotice('');
        }}
      />
    );
  if (recovering)
    return (
      <PasswordRecovery
        token={resetToken}
        back={() => {
          setResetToken('');
          setRecovering(false);
          setNotice('');
        }}
      />
    );
  if (checking)
    return <PageLoading fullScreen label={t('Preparando o NextPlay…')} />;
  if (user)
    return (
      <PageBoundary fullScreen>
        <Home
          user={user}
          onUserChanged={acceptUser}
          logout={logout}
          busy={busy}
          notice={notice}
          onExpired={() => {
            setUser(null);
            setNotice(t('Entre novamente para acessar sua coleção.'));
          }}
        />
      </PageBoundary>
    );

  return (
    <main className="login-shell">
      <section
        className="brand-panel"
        aria-label={t('NextPlay, sua biblioteca pessoal')}
      >
        <div className="brand">
          <img src="/nextplay-symbol.svg" width={40} height={40} alt="" />
          <span>NextPlay</span>
        </div>
        <div className="brand-story">
          <div className="eyebrow">
            <span /> {t(' SUA PRÓXIMA HISTÓRIA COMEÇA AQUI ')}
          </div>
          <h1>
            {t(' Tanta coisa boa. ')}
            <br />
            {t(' Um lugar para ')}
            <br />
            <span>{t(' guardar tudo. ')}</span>
          </h1>
          <p>
            {t(' Os filmes que marcaram. As séries que viciaram. ')}
            <br className="desktop-break" />{' '}
            {t(' Os jogos e livros que ainda vêm por aí. ')}
          </p>
          <div
            className="media-types"
            aria-label={t('Filmes, séries, jogos e livros')}
          >
            <span>
              <Film aria-hidden="true" /> {t(' Filmes ')}
            </span>
            <span>
              <Tv aria-hidden="true" /> {t(' Séries ')}
            </span>
            <span>
              <Gamepad2 aria-hidden="true" /> {t(' Jogos ')}
            </span>
            <span>
              <BookOpen aria-hidden="true" /> {t('Livros')}
            </span>
          </div>
        </div>
        <div className="brand-footer">
          <span>{t(' Sua coleção. Seu ritmo. ')}</span>
          <ArrowUpRight aria-hidden="true" />
        </div>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="mobile-brand brand">
          <img src="/nextplay-symbol.svg" width={36} height={36} alt="" />
          <span>NextPlay</span>
        </div>
        <div className="login-content">
          <>
            <span className="section-number">{t(' 01 / ENTRAR ')}</span>
            <h2 id="login-heading">
              {t(' Seu próximo play ')}
              <br />
              {t(' está te esperando. ')}
            </h2>
            <p className="login-description">
              {checking
                ? t('Consultando sua sessão…')
                : registering
                  ? t('Crie sua conta para começar sua coleção.')
                  : t('Entre para encontrar tudo no seu lugar.')}
            </p>
            <Button
              type="button"
              variant="outline"
              className="google-button"
              onClick={() => void googleLogin()}
              disabled={busy || checking}
            >
              <span className="google-letter" aria-hidden="true">
                G
              </span>{' '}
              {t(' Continuar com Google ')}
            </Button>
            <div className="separator">
              <span />
              {t(' ou entre com ')}
              <span />
            </div>
            <fieldset
              className="method-picker"
              aria-label={t('Forma de login')}
              disabled={busy || checking}
            >
              <Button
                type="button"
                variant="ghost"
                aria-pressed={method === 'email'}
                onClick={() => switchMethod('email')}
              >
                <Mail aria-hidden="true" /> {t(' E-mail ')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-pressed={method === 'phone'}
                onClick={() => switchMethod('phone')}
              >
                <Smartphone aria-hidden="true" /> {t(' Telefone ')}
              </Button>
            </fieldset>
            <form
              key={`${method}-${registering}`}
              onSubmit={submit}
              className="login-form"
              aria-busy={busy}
            >
              {method === 'email' ? (
                <>
                  <div className="field">
                    <label htmlFor="email">{t(' E-mail ')}</label>
                    <Input
                      className="login-input"
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="voce@exemplo.com"
                      required
                      maxLength={254}
                      onChange={() => setNotice('')}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="password">{t(' Senha ')}</label>
                    <div className="password-field">
                      <Input
                        className="login-input"
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={
                          registering ? 'new-password' : 'current-password'
                        }
                        placeholder={
                          registering
                            ? t('Pelo menos 12 caracteres')
                            : t('Sua senha')
                        }
                        minLength={registering ? 12 : 1}
                        maxLength={128}
                        required
                        onChange={() => setNotice('')}
                      />
                      <Button
                        variant="ghost"
                        type="button"
                        className="password-toggle"
                        aria-label={
                          showPassword ? t('Ocultar senha') : t('Mostrar senha')
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="field phone-field">
                  <label htmlFor="phone">{t(' Número de celular ')}</label>
                  <Input
                    className="login-input"
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+55 (11) 99999-9999"
                    required
                    pattern={
                      '\\+[1-9](?:[ \\(\\)\\-]*[0-9]){6,14}[ \\(\\)\\-]*'
                    }
                    maxLength={25}
                    title={t(
                      'Informe o código do país com +, DDD e número. Exemplo: +55 (11) 99999-9999.',
                    )}
                    onChange={() => setNotice('')}
                    aria-describedby="phone-help"
                  />
                  <p id="phone-help" className="field-help">
                    {t(
                      ' Inclua o código do país e o DDD. Você entrará usando um código recebido por SMS. ',
                    )}
                  </p>
                </div>
              )}
              <div
                id="login-error"
                className="form-notice"
                role="alert"
                aria-atomic="true"
              >
                {notice && (
                  <>
                    <CircleAlert aria-hidden="true" />
                    <span>{notice}</span>
                  </>
                )}
              </div>
              <Button
                className="submit-button"
                aria-describedby={notice ? 'login-error' : undefined}
                type="submit"
                disabled={busy || checking}
              >
                {busy
                  ? t('Aguarde…')
                  : method === 'email'
                    ? registering
                      ? t('Criar minha conta')
                      : t('Entrar na minha conta')
                    : t('Receber código por SMS')}
                <ArrowRight aria-hidden="true" />
              </Button>
            </form>
            {method === 'email' && !registering && (
              <Button
                variant="link"
                className="register-toggle"
                disabled={busy || checking}
                onClick={() => setRecovering(true)}
              >
                {t('Esqueci minha senha')}
              </Button>
            )}
            {method === 'email' && !registering && (
              <Button
                variant="link"
                className="register-toggle"
                disabled={busy || checking}
                onClick={() => {
                  setPendingEmail('');
                  setVerificationToken('');
                  setVerifyingEmail(true);
                }}
              >
                {t('Reenviar confirmação')}
              </Button>
            )}
            {method === 'email' && canRegister && (
              <Button
                type="button"
                variant="link"
                className="register-toggle"
                disabled={busy || checking}
                onClick={() => {
                  setRegistering(!registering);
                  setShowPassword(false);
                  setNotice('');
                }}
              >
                {registering
                  ? t('Já tenho conta. Entrar')
                  : t('Primeiro acesso? Criar conta')}
              </Button>
            )}
          </>
          <div className="private-note">
            <LockKeyhole aria-hidden="true" />
            <span>{t(' Um espaço só seu para o que você curte. ')}</span>
          </div>
        </div>
        <footer className="login-footer">
          <ThemePicker />
          {t(' Qual é o seu próximo play? ')}
          <span>NextPlay © {new Date().getFullYear()}</span>
          <small className="development-credit">
            {t('Desenvolvido por {0}', 'IMJ Sistemas e Tecnologia Ltda')}
          </small>
        </footer>
      </section>
    </main>
  );
}
