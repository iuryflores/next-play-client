import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Notifications from './SaveNotifications';
// As cores compartilhadas precedem os temas mesmo quando a tela chega por importação dinâmica.
import './collector.css';
import './book-search.css';
import './title-details.css';
import './home.css';
import './mobile.css';
import './explore-details.css';
import './achievements.css';
import './index.css';
import './motion.css';
import './surfaces.css';
import './theme.css';
import { initializeTheme } from './theme';
import { language, t } from './i18n';
document.documentElement.lang = language;
document.title = t('Entrar · NextPlay');
initializeTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz do NextPlay não encontrado.');

createRoot(root).render(
  <StrictMode>
    <App />
    <Notifications />
  </StrictMode>,
);
