import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startAppUpdates } from './lib/appUpdate';
import './lib/look';
import { registerWebPassBlocks } from './lib/passBlocks';
import { startClassProgressSync } from './lib/classLearning';
import { startClassCardSync } from './lib/classes';
import { onGameRecorded } from './lib/passRecorder';
import { passSyncSoon, syncPassEntry } from './lib/playerPass';
import { disablePinchZoom } from './lib/preventZoom';
import './styles.css';

// Spielerpass (#137): Blöcke anmelden und beim Start einmal abgleichen.
registerWebPassBlocks();
startClassProgressSync();
// Klassenkarten nach jeder Partie nachführen (#151); hier statt in classes.ts, damit kein Importkreis entsteht (#361).
startClassCardSync(onGameRecorded);
syncPassEntry();
passSyncSoon(3000);

// Service Worker: speichert die App für die Nutzung ohne Internet; Updates holt und meldet `appUpdate` (#175).
startAppUpdates();

// Pinch-to-Zoom unterbinden, damit sich das Layout nicht versehentlich verschiebt (#267).
disablePinchZoom();

const root = document.getElementById('root');
if (!root) throw new Error('Element #root fehlt.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
