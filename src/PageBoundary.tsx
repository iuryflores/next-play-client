import { Component, Suspense, type ReactNode } from 'react';
import PageLoading from './PageLoading';
import { Button } from '@/components/ui/button';
import { t } from './i18n';

// Um arquivo indisponível após queda de rede/deploy não deve apagar toda a navegação.
// A recarga é explícita para não interromper o usuário com atualizações automáticas.
export default class PageBoundary extends Component<
  { children: ReactNode; fullScreen?: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="collection-empty" role="alert">
          <h2>{t('Não foi possível abrir esta tela.')}</h2>
          <Button onClick={() => window.location.reload()}>
            {t('Recarregar aplicativo')}
          </Button>
        </section>
      );
    return (
      <Suspense
        fallback={
          <PageLoading
            fullScreen={this.props.fullScreen}
            compact={!this.props.fullScreen}
            label={t('Preparando o NextPlay…')}
          />
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
