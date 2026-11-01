import { useEffect, useState, type ReactNode } from 'react';
import { Bookmark, Compass, LayoutGrid, Menu, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { t } from './i18n';

type Destination = 'all' | 'planned' | 'add' | 'explore';
const shortcuts = [
  { id: 'all', label: 'Coleção', icon: LayoutGrid },
  { id: 'planned', label: 'Para depois', icon: Bookmark },
  { id: 'add', label: 'Adicionar', icon: Plus },
  { id: 'explore', label: 'Explorar', icon: Compass },
] as const;

export default function MobileNavigation({
  view,
  navigate,
  children,
}: {
  view: string;
  navigate: (destination: Destination) => void;
  children: (closeMenu: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Ao girar um tablet ou ampliar a janela, não deixa um menu invisível prender o foco.
    const query = window.matchMedia('(max-width: 760px)');
    const closeOnDesktop = () => {
      if (!query.matches) setOpen(false);
    };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <nav className="mobile-navigation" aria-label={t('Navegação principal')}>
        {shortcuts.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? 'page' : undefined}
            className={id === 'add' ? 'mobile-add' : undefined}
            onClick={() => navigate(id)}
          >
            <Icon aria-hidden="true" />
            <span>{t(label)}</span>
          </button>
        ))}
        <DialogTrigger
          aria-current={
            !shortcuts.some(({ id }) => id === view) ? 'page' : undefined
          }
        >
          <Menu aria-hidden="true" />
          <span>{t('Menu')}</span>
        </DialogTrigger>
      </nav>
      <DialogContent className="mobile-menu" showCloseButton={false}>
        <DialogTitle>{t('Biblioteca')}</DialogTitle>
        <DialogDescription>
          {t('Escolha o que você quer acompanhar.')}
        </DialogDescription>
        <DialogClose
          className="mobile-menu-close"
          aria-label={t('Fechar menu')}
        >
          <X aria-hidden="true" />
        </DialogClose>
        {/* Reutiliza os mesmos destinos e contadores da navegação desktop. */}
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}
