import { UpdateBanner } from './components/UpdateBanner';
import { useRoute } from './lib/router';
import { DisplayScreen } from './screens/Display';
import { Home } from './screens/Home';
import { Datenschutz, Impressum } from './screens/Legal';
import { Online } from './screens/Online';
import { PassScreen } from './screens/Pass';
import { Play } from './screens/Play';
import { RoomScreen } from './screens/Room';
import { TournamentScreen } from './screens/Tournament';
import { Setup } from './screens/Setup';
import { SoundSettingsScreen } from './screens/SoundSettings';

export function App() {
  return (
    <>
      <Screen />
      <UpdateBanner />
    </>
  );
}

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case 'setup':
      return <Setup key={`${route.gameId}-${JSON.stringify(route.params ?? {})}`} gameId={route.gameId} params={route.params} />;
    case 'play':
      return <Play />;
    case 'online':
      return <Online />;
    case 'room':
      return <RoomScreen key={route.code} code={route.code} />;
    case 'display':
      return <DisplayScreen key={route.code} code={route.code} />;
    case 'tournament':
      return <TournamentScreen key={route.code} code={route.code} claim={route.claim} helper={route.helper} />;
    case 'sound':
      return <SoundSettingsScreen />;
    case 'pass':
      return <PassScreen />;
    case 'imprint':
      return <Impressum />;
    case 'privacy':
      return <Datenschutz />;
    default:
      return <Home initialFilter={route.filter} initialPlayers={route.players} />;
  }
}
