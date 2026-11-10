import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startAppUpdates } from './lib/appUpdate';
import './lib/look';
import { registerWebPassBlocks } from './lib/passBlocks';
import { startClassProgressSync } from './lib/classLearning';
import { passSyncSoon, syncPassEntry } from './lib/playerPass';
import './styles.css';

// Spielerpass (#137): Blöcke anmelden und beim Start einmal abgleichen.
registerWebPassBlocks();
startClassProgressSync();
syncPassEntry();
passSyncSoon(3000);

// Service Worker: speichert die App für die Nutzung ohne Internet; Updates holt und meldet `appUpdate` (#175).
startAppUpdates();

const root = document.getElementById('root');
if (!root) throw new Error('Element #root fehlt.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
