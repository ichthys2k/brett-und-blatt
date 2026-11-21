import type { ReactElement } from 'react';
import type { Route } from '../lib/router';
import { ConsoleHome } from './ConsoleHome';
import { ConsoleLibrary } from './ConsoleLibrary';
import { ConsoleGame } from './ConsoleGame';
import { ClassicInFrame } from './ClassicInFrame';
import { Online } from '../screens/Online';
import { BoardScreen } from '../screens/Board';
import { SoundSettingsScreen } from '../screens/SoundSettings';
import { PassScreen } from '../screens/Pass';

/** Konsolen-Bildschirm für eine Route oder `null`, wenn die klassische Seite gilt (#607). */
export function consoleScreen(route: Route): ReactElement | null {
  switch (route.name) {
    case 'menu':
      return <ConsoleHome />;
    case 'setup':
      // Der Sofortstart (`?autostart=1`) läuft weiter über die klassische Seite, ohne Zwischenbild.
      if (route.params?.autostart === '1') return null;
      return <ConsoleGame key={`${route.gameId}-${JSON.stringify(route.params ?? {})}`} gameId={route.gameId} params={route.params} />;
    case 'home':
      return <ConsoleLibrary initialFilter={route.filter} initialPlayers={route.players} />;
    // Seltene Seiten bleiben klassisch, stehen aber im Rahmen der Konsole (K9). Der Raum legt den Rahmen selbst um die Lobby.
    case 'online':
      return (
        <ClassicInFrame tab="online">
          <Online />
        </ClassicInFrame>
      );
    case 'board':
      return (
        <ClassicInFrame tab="online">
          <BoardScreen />
        </ClassicInFrame>
      );
    case 'sound':
      return (
        <ClassicInFrame tab="options">
          <SoundSettingsScreen />
        </ClassicInFrame>
      );
    case 'pass':
      return (
        <ClassicInFrame tab={null}>
          <PassScreen />
        </ClassicInFrame>
      );
    default:
      return null;
  }
}
