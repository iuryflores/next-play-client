import { useState, type SubmitEvent } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Film,
  Gamepad2,
  LockKeyhole,
  Mail,
  Smartphone,
  Tv,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LoginMethod = 'email' | 'phone';

export default function LoginPage() {
  const [method, setMethod] = useState<LoginMethod>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  function switchMethod(next: LoginMethod) {
    setMethod(next);
    setShowPassword(false);
    setNotice('');
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // Never persist or transmit credentials until a provider is connected.
    setNotice(
      method === 'email'
        ? 'O acesso por e-mail ainda não está disponível. Tente novamente mais tarde.'
        : 'O acesso por SMS ainda não está disponível. Nenhum código foi enviado.',
    );
  }

  return (
    <main className="login-shell">
      <section
        className="brand-panel"
        aria-label="NextPlay, sua biblioteca pessoal"
      >
        <div className="brand">
          <img src="/nextplay-symbol.svg" width={40} height={40} alt="" />
          <span>NextPlay</span>
        </div>
        <div className="brand-story">
          <div className="eyebrow">
            <span /> SUA PRÓXIMA HISTÓRIA COMEÇA AQUI
          </div>
          <h1>
            Tanta coisa boa.
            <br />
            Um lugar para
            <br />
            <span>guardar tudo.</span>
          </h1>
          <p>
            Os filmes que marcaram. As séries que viciaram.
            <br className="desktop-break" /> Os jogos que ainda vêm por aí.
          </p>
          <div className="media-types" aria-label="Filmes, séries e jogos">
            <span>
              <Film aria-hidden="true" /> Filmes
            </span>
            <span>
              <Tv aria-hidden="true" /> Séries
            </span>
            <span>
              <Gamepad2 aria-hidden="true" /> Jogos
            </span>
          </div>
        </div>
        <div className="brand-footer">
          <span>Sua coleção. Seu ritmo.</span>
          <ArrowUpRight aria-hidden="true" />
        </div>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="mobile-brand brand">
          <img src="/nextplay-symbol.svg" width={36} height={36} alt="" />
          <span>NextPlay</span>
        </div>
        <div className="login-content">
          <span className="section-number">01 / ENTRAR</span>
          <h2 id="login-heading">
            Seu próximo play
            <br />
            está te esperando.
          </h2>
          <p className="login-description">
            Entre para encontrar tudo no seu lugar.
          </p>
          <Button
            type="button"
            variant="outline"
            className="google-button"
            onClick={() =>
              setNotice(
                'O acesso com Google ainda não está disponível. Tente novamente mais tarde.',
              )
            }
          >
            <span className="google-letter" aria-hidden="true">
              G
            </span>{' '}
            Continuar com Google
          </Button>
          <div className="separator">
            <span />
            ou entre com
            <span />
          </div>
          <fieldset className="method-picker" aria-label="Forma de login">
            <Button
              type="button"
              variant="ghost"
              aria-pressed={method === 'email'}
              onClick={() => switchMethod('email')}
            >
              <Mail aria-hidden="true" /> E-mail
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={method === 'phone'}
              onClick={() => switchMethod('phone')}
            >
              <Smartphone aria-hidden="true" /> Telefone
            </Button>
          </fieldset>
          <form key={method} onSubmit={submit} className="login-form">
            {method === 'email' ? (
              <>
                <div className="field">
                  <label htmlFor="email">E-mail</label>
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
                  <label htmlFor="password">Senha</label>
                  <div className="password-field">
                    <Input
                      className="login-input"
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Sua senha"
                      required
                      onChange={() => setNotice('')}
                    />
                    <Button
                      variant="ghost"
                      type="button"
                      className="password-toggle"
                      aria-label={
                        showPassword ? 'Ocultar senha' : 'Mostrar senha'
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
                <label htmlFor="phone">Número de celular</label>
                <Input
                  className="login-input"
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+55 (11) 99999-9999"
                  required
                  pattern={'\\+[1-9](?:[ \\(\\)\\-]*[0-9]){6,14}[ \\(\\)\\-]*'}
                  maxLength={25}
                  title="Informe o código do país com +, DDD e número. Exemplo: +55 (11) 99999-9999."
                  onChange={() => setNotice('')}
                  aria-describedby="phone-help"
                />
                <p id="phone-help" className="field-help">
                  Inclua o código do país e o DDD. Você entrará usando um código
                  recebido por SMS.
                </p>
              </div>
            )}
            <Button className="submit-button" type="submit">
              {method === 'email'
                ? 'Entrar na minha conta'
                : 'Receber código por SMS'}
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>
          <output className="form-notice" aria-live="polite" aria-atomic="true">
            {notice}
          </output>
          <div className="private-note">
            <LockKeyhole aria-hidden="true" />
            <span>Um espaço só seu para o que você curte.</span>
          </div>
        </div>
        <footer className="login-footer">
          Qual é o seu próximo play?
          <span>NextPlay © {new Date().getFullYear()}</span>
        </footer>
      </section>
    </main>
  );
}
