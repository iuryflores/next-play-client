import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from './i18n';
import './back-button.css';

export default function BackButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  // O retorno mantém o contexto de origem, que nem sempre é a visão geral.
  return (
    <Button
      type="button"
      variant="outline"
      className="app-back-button"
      onClick={onClick}
      disabled={disabled}
    >
      <ArrowLeft aria-hidden="true" />
      {t('Voltar')}
    </Button>
  );
}
