import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './lib/look';
import './styles.css';

// Service Worker: speichert die App für die Nutzung ohne Internet und holt Updates automatisch.
registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('Element #root fehlt.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
