import { useRoute } from './lib/router';
import { Home } from './screens/Home';
import { Datenschutz, Impressum } from './screens/Legal';
import { Online } from './screens/Online';
import { Play } from './screens/Play';
import { RoomScreen } from './screens/Room';
import { Setup } from './screens/Setup';
import { SoundSettingsScreen } from './screens/SoundSettings';

export function App() {
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
    case 'sound':
      return <SoundSettingsScreen />;
    case 'imprint':
      return <Impressum />;
    case 'privacy':
      return <Datenschutz />;
    default:
      return <Home initialFilter={route.filter} />;
  }
}
