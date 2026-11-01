import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Notifications from './SaveNotifications';
import './index.css';
import './motion.css';
import './surfaces.css';
import { language, t } from './i18n';
document.documentElement.lang = language;
document.title = t('Entrar · NextPlay');

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz do NextPlay não encontrado.');

createRoot(root).render(
  <StrictMode>
    <App />
    <Notifications />
  </StrictMode>,
);
