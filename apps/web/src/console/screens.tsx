import type { ReactElement } from 'react';
import type { Route } from '../lib/router';
import { classicScreen } from '../screens/classicScreen';
import { ClassicInFrame } from './ClassicInFrame';
import { ConsoleGame } from './ConsoleGame';
import { ConsoleHome } from './ConsoleHome';
import { ConsoleLibrary } from './ConsoleLibrary';
import { placeForRoute } from './consoleTabs';
import { Gallery } from './Gallery';

/**
 * Konsolen-Bildschirm für eine Route oder `null`, wenn die klassische Seite ohne Rahmen gilt (#607). Seit #638
 * steht jede Route mit einem Platz in der Navigation im Rahmen der Konsole – als eigener Bildschirm oder, bis
 * sie neu gebaut ist (#635, U5–U15), als klassische Seite in `ClassicInFrame`.
 */
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
    case 'gallery':
      return <Gallery />;
    // Der Raum legt den Rahmen selbst um die Lobby; die Partie im Raum steht ohne Rahmen da.
    case 'room':
      return null;
    default: {
      const place = placeForRoute(route.name);
      if (!place) return null;
      return <ClassicInFrame tab={place.tab}>{classicScreen(route)}</ClassicInFrame>;
    }
  }
}
